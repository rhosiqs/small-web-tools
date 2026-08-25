import { errorResponse } from './errorResponse';
import { getRateLimitPolicy } from '../../config/rateLimitPolicies.js';

const developmentBuckets = new Map();
const WINDOW_MS = 60_000;
const SERVICE_TIMEOUT_MS = 1500;

function limiterError(status, code, extraHeaders = {}, log = false, diagnostic = 'rate-limiter-boundary') {
  return errorResponse(code, status, {
    headers: extraHeaders,
    log,
    diagnostic,
  });
}

/**
 * Only `CF-Connecting-IP` is trustworthy here: Cloudflare sets it on every edge
 * request and strips any client-supplied copy. `X-Forwarded-For` is attacker
 * controlled, and accepting it means a client can mint a fresh limiter bucket
 * per request simply by rotating the header. Off the edge, the limiter fails
 * closed instead, matching how this module handles every other missing
 * precondition.
 */
function getNetworkIdentifier(request, developmentMode) {
  const edgeIdentifier = request.headers.get('CF-Connecting-IP')?.trim();
  if (edgeIdentifier) return edgeIdentifier;
  if (!developmentMode) return null;
  return request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

async function hmacClientKey(secret, networkIdentifier, period) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${networkIdentifier}:${period}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function developmentLimit(name, clientKey, limit, now) {
  const bucket = Math.floor(now / WINDOW_MS);
  const key = `${name}:${clientKey}:${bucket}`;
  const count = (developmentBuckets.get(key) || 0) + 1;
  developmentBuckets.set(key, count);
  if (developmentBuckets.size > 5000) {
    for (const existingKey of developmentBuckets.keys()) {
      if (!existingKey.endsWith(`:${bucket}`)) developmentBuckets.delete(existingKey);
    }
  }
  return count <= limit;
}

export function resetDevelopmentRateLimits() {
  developmentBuckets.clear();
}

export async function enforceRateLimit(context, options) {
  const env = context.env || {};
  const developmentMode = env.RATE_LIMIT_DEVELOPMENT_MODE === 'true';
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  const policy = getRateLimitPolicy(options.name);
  if (!policy) {
    return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true, 'rate-limiter-unknown-route');
  }
  if (!secret || secret.length < 32) {
    return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true);
  }

  const networkIdentifier = getNetworkIdentifier(context.request, developmentMode);
  if (!networkIdentifier) {
    return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true, 'rate-limiter-unidentified-client');
  }

  const now = options.now?.() ?? Date.now();
  const period = Math.floor(now / 86_400_000);
  const clientKey = await hmacClientKey(secret, networkIdentifier, period);

  if (!env.RATE_LIMITER_SERVICE?.fetch) {
    if (developmentMode) {
      const allowed = developmentLimit(policy.route, clientKey, policy.limit, now);
      return allowed
        ? null
        : limiterError(429, 'RATE_LIMITED', { 'Retry-After': '60' });
    }
    return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true);
  }

  const controller = new AbortController();
  const timeoutMs = options.serviceTimeoutMs ?? SERVICE_TIMEOUT_MS;
  const timeoutError = new DOMException('Rate limiter timed out', 'TimeoutError');
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  let removeAbortListener = () => {};
  try {
    const timeout = new Promise((_, reject) => {
      const onAbort = () => reject(timeoutError);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => controller.signal.removeEventListener('abort', onAbort);
    });
    const serviceCall = env.RATE_LIMITER_SERVICE.fetch(
      new Request('https://rate-limiter.internal/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: policy.route, clientKey }),
        signal: controller.signal,
      }),
    );
    const response = await Promise.race([serviceCall, timeout]);
    if (!response.ok) {
      return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true, 'rate-limiter-service-failure');
    }
    const result = await response.json();
    if (typeof result?.allowed !== 'boolean') {
      return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true, 'rate-limiter-malformed-response');
    }
    return result.allowed
      ? null
      : limiterError(429, 'RATE_LIMITED', { 'Retry-After': '60' });
  } catch (error) {
    const diagnostic = controller.signal.aborted || (error instanceof Error && error.name === 'TimeoutError')
      ? 'rate-limiter-timeout'
      : 'rate-limiter-service-failure';
    return limiterError(503, 'RATE_LIMIT_UNAVAILABLE', {}, true, diagnostic);
  } finally {
    clearTimeout(timer);
    removeAbortListener();
  }
}
