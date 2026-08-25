import { safeExternalFetch, validateTargetUrl } from '../_shared/safeExternalFetch';
import { enforceRateLimit } from '../_shared/rateLimit';
import { errorResponse } from '../_shared/errorResponse';
import { evaluateFontExtractionCapability } from '../_shared/fontExtractionCapability';
import { withBaselineHeaders } from '../_shared/responseHeaders.js';
import {
  FONT_EXTRACTION_LIMITS,
  readLimitedJson,
  validateSameSiteJsonRequest,
} from '../_shared/requestPolicy';

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withBaselineHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    }),
  });
}

function sameOriginCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  return origin && origin === new URL(request.url).origin
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

export async function onRequestOptions(context) {
  const corsHeaders = sameOriginCorsHeaders(context.request);
  if (!corsHeaders['Access-Control-Allow-Origin']) return new Response(null, { status: 403, headers: withBaselineHeaders() });
  return new Response(null, {
    status: 204,
    headers: withBaselineHeaders({
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }),
  });
}

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

function resolveRemoteUrl(base, relative) {
  const resolved = resolveUrl(base, relative);
  if (!resolved) return null;
  const parsed = new URL(resolved);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
}

function declarationValue(block, property) {
  const start = new RegExp(`(?:^|[;\\s])${property}\\s*:`, 'iu').exec(block);
  if (!start) return null;
  let cursor = start.index + start[0].length;
  const valueStart = cursor;
  let quote = null;
  let parentheses = 0;
  for (; cursor < block.length; cursor += 1) {
    const character = block[cursor];
    if (quote) {
      if (character === quote && block[cursor - 1] !== '\\') quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === ';' && parentheses === 0) break;
  }
  return block.slice(valueStart, cursor).trim();
}

// `\b` matches between a hyphen and a letter, so a `\bhref` pattern also matches
// `data-href`. Attribute names are delimited by whitespace or the tag opener.
function htmlAttribute(tag, attribute) {
  const pattern = new RegExp(`(?:^|[\\s/])${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'iu');
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function getFormat(url, declaredFormat) {
  if (declaredFormat) return declaredFormat.replace(/['"]/g, '').trim().toUpperCase();
  const extension = url.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase();
  return {
    woff2: 'WOFF2',
    woff: 'WOFF',
    ttf: 'TRUETYPE',
    otf: 'OPENTYPE',
    eot: 'EOT',
    svg: 'SVG',
  }[extension] || 'UNKNOWN';
}

// Descriptor values are copied onto every source in a @font-face block and then
// serialized into the JSON response. Left unbounded, a small stylesheet of long
// declarations expands into a response large enough to exhaust Worker memory.
const MAX_DESCRIPTOR_LENGTH = 128;

function descriptor(block, property) {
  const value = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'iu'))?.[1]?.trim();
  return value ? value.slice(0, MAX_DESCRIPTOR_LENGTH) : 'unknown';
}

function parseCss(css, baseUrl) {
  const sourceCss = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const imports = [];
  const fonts = [];
  const importPattern = /@import\s+(?:url\(\s*)?['"]?([^'")\s]+)['"]?\s*\)?[^;]*;/giu;
  const fontFacePattern = /@font-face\s*\{([\s\S]*?)\}/giu;
  const sourcePattern = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/giu;

  for (const match of sourceCss.matchAll(importPattern)) {
    const resolved = resolveRemoteUrl(baseUrl, match[1]);
    if (resolved) imports.push(resolved);
  }

  for (const faceMatch of sourceCss.matchAll(fontFacePattern)) {
    const block = faceMatch[1];
    const family = block.match(/font-family\s*:\s*['"]?([^'";]+)['"]?/iu)?.[1]?.trim()?.slice(0, MAX_DESCRIPTOR_LENGTH);
    const sourceList = declarationValue(block, 'src');
    if (!family || !sourceList) continue;
    const weight = descriptor(block, 'font-weight');
    const style = descriptor(block, 'font-style');
    const stretch = descriptor(block, 'font-stretch');
    const unicodeRange = descriptor(block, 'unicode-range');
    const variationSettings = descriptor(block, 'font-variation-settings');

    for (const source of sourceList.matchAll(sourcePattern)) {
      const resolved = resolveRemoteUrl(baseUrl, source[1]);
      if (!resolved) continue;
      const parsedSource = new URL(resolved);
      fonts.push({
        name: parsedSource.pathname.split('/').pop()?.slice(0, 160) || `${family}-font`,
        family,
        format: getFormat(resolved, source[2]),
        weight,
        style,
        stretch,
        unicodeRange,
        variationSettings,
        isVariable: /\s/u.test(weight) || variationSettings !== 'unknown',
        sourceHost: parsedSource.hostname.slice(0, 253),
        _sourceKey: resolved,
      });
    }
  }
  return { fonts, imports };
}

function stylesheetUrlsFromHtml(html, baseUrl) {
  const urls = [];
  const linkPattern = /<link\b[^>]*>/giu;
  for (const match of html.matchAll(linkPattern)) {
    const tag = match[0];
    const relTokens = (htmlAttribute(tag, 'rel') || '').toLowerCase().split(/\s+/u).filter(Boolean);
    const href = htmlAttribute(tag, 'href');
    const as = htmlAttribute(tag, 'as')?.toLowerCase();
    if (!href || (!relTokens.includes('stylesheet') && !(relTokens.includes('preload') && as === 'style'))) continue;
    const resolved = resolveRemoteUrl(baseUrl, href);
    if (resolved) urls.push(resolved);
  }
  return urls;
}

function createBudget(limits) {
  const reasons = new Set();
  const consumed = { upstreamBytes: 0, stylesheets: 0, fontFaces: 0 };
  let reservedBytes = 0;
  const deadline = Date.now() + limits.deadlineMs;

  return {
    reasons,
    consumed,
    remainingMs() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) reasons.add('deadline');
      return Math.max(0, remaining);
    },
    reserveBytes(maximum) {
      const remaining = limits.totalUpstreamBytes - consumed.upstreamBytes - reservedBytes;
      if (remaining <= 0) {
        reasons.add('total-upstream-bytes');
        return 0;
      }
      const reservation = Math.min(maximum, remaining);
      reservedBytes += reservation;
      return reservation;
    },
    finishBytes(reservation, actual) {
      reservedBytes -= reservation;
      consumed.upstreamBytes += actual;
      if (actual >= reservation && consumed.upstreamBytes >= limits.totalUpstreamBytes) {
        reasons.add('total-upstream-bytes');
      }
    },
    addFonts(fonts, target) {
      const available = limits.fontFaces - target.length;
      if (available <= 0) {
        reasons.add('font-faces');
        return;
      }
      target.push(...fonts.slice(0, available));
      consumed.fontFaces = target.length;
      if (fonts.length > available) reasons.add('font-faces');
    },
    metadata() {
      return {
        truncated: reasons.size > 0,
        reasons: [...reasons],
        limits,
        consumed,
      };
    },
  };
}

async function fetchBudgeted(url, type, budget, limits) {
  const perResourceLimit = type === 'html' ? limits.htmlBytes : limits.cssBytes;
  const reservation = budget.reserveBytes(perResourceLimit);
  const remainingMs = budget.remainingMs();
  if (!reservation || !remainingMs) return null;
  try {
    const result = await safeExternalFetch(url, {
      maxBytes: reservation,
      timeoutMs: remainingMs,
      allowedContentTypes: type === 'html'
        ? ['text/html', 'application/xhtml+xml']
        : ['text/css'],
    });
    budget.finishBytes(reservation, result.buffer.byteLength);
    return result;
  } catch (error) {
    // A failed fetch may still have streamed bytes before aborting. The actual
    // count is not observable here, so charge the whole reservation rather than
    // returning it to the budget and letting real egress exceed the limit.
    budget.finishBytes(reservation, reservation);
    throw error;
  }
}

async function extractFontMetadata(targetUrl, limits) {
  const budget = createBudget(limits);
  const htmlResult = await fetchBudgeted(targetUrl.href, 'html', budget, limits);
  if (!htmlResult) return { fonts: [], truncation: budget.metadata() };
  const html = new TextDecoder().decode(htmlResult.buffer);
  const allFonts = [];

  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)) {
    const parsed = parseCss(match[1], targetUrl.href);
    budget.addFonts(parsed.fonts, allFonts);
  }

  const queue = stylesheetUrlsFromHtml(html, targetUrl.href).map((url) => ({ url, depth: 0 }));
  const seen = new Set();
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length && budget.remainingMs() > 0) {
      if (budget.consumed.stylesheets >= limits.stylesheets) {
        budget.reasons.add('stylesheets');
        return;
      }
      const job = queue[cursor];
      cursor += 1;
      if (!job || seen.has(job.url)) continue;
      seen.add(job.url);
      budget.consumed.stylesheets += 1;

      let result;
      try {
        result = await fetchBudgeted(job.url, 'css', budget, limits);
      } catch {
        continue;
      }
      if (!result) return;
      const parsed = parseCss(new TextDecoder().decode(result.buffer), result.url || job.url);
      budget.addFonts(parsed.fonts, allFonts);
      for (const importedUrl of parsed.imports) {
        if (job.depth >= limits.importDepth) {
          budget.reasons.add('import-depth');
        } else if (!seen.has(importedUrl)) {
          queue.push({ url: importedUrl, depth: job.depth + 1 });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: limits.concurrency }, () => worker()));
  if (cursor < queue.length) budget.reasons.add('stylesheets');

  const deduplicated = new Map();
  for (const font of allFonts) {
    const key = [
      font._sourceKey,
      font.family.toLowerCase(),
      font.weight,
      font.style,
      font.stretch,
      font.unicodeRange,
    ].join('|');
    if (!deduplicated.has(key)) {
      const { _sourceKey, ...publicFont } = font;
      deduplicated.set(key, publicFont);
    }
  }
  return {
    fonts: [...deduplicated.values()],
    truncation: budget.metadata(),
  };
}

/**
 * A plain-text Workers variable arrives as a string, so spreading the raw value
 * scatters its characters into numeric keys instead of applying an override.
 * Accept both the string and JSON-object binding forms, and take only known keys
 * whose value is a positive finite number.
 */
function resolveLimits(rawOverride) {
  const defaults = { ...FONT_EXTRACTION_LIMITS };
  let override = rawOverride;

  if (typeof override === 'string') {
    if (!override.trim()) return defaults;
    try {
      override = JSON.parse(override);
    } catch {
      return defaults;
    }
  }
  if (!override || typeof override !== 'object' || Array.isArray(override)) return defaults;

  for (const key of Object.keys(FONT_EXTRACTION_LIMITS)) {
    const value = Number(override[key]);
    if (Number.isFinite(value) && value > 0) defaults[key] = value;
  }
  return defaults;
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  const corsHeaders = sameOriginCorsHeaders(request);

  const policyError = validateSameSiteJsonRequest(request, env);
  if (policyError) {
    return errorResponse('VALIDATION_FAILED', policyError.status, {
      headers: corsHeaders,
      diagnostic: 'same-site-policy',
    });
  }

  const capability = evaluateFontExtractionCapability(env);
  if (!capability.enabled) {
    return errorResponse('FEATURE_UNAVAILABLE', 503, {
      headers: corsHeaders,
      diagnostic: capability.reason,
    });
  }

  const limited = await enforceRateLimit(context, { name: 'extract-fonts' });
  if (limited) return limited;

  let parsed;
  try {
    parsed = await readLimitedJson(request);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return errorResponse('VALIDATION_FAILED', status, {
      headers: corsHeaders,
      error,
      diagnostic: 'request-body',
    });
  }

  const rawUrl = typeof parsed.url === 'string' ? parsed.url.trim() : '';
  if (!rawUrl) {
    return errorResponse('VALIDATION_FAILED', 400, {
      headers: corsHeaders,
      diagnostic: 'missing-url',
    });
  }

  let targetUrl;
  try {
    targetUrl = validateTargetUrl(rawUrl);
  } catch (error) {
    return errorResponse('BLOCKED_TARGET', 400, {
      headers: corsHeaders,
      error,
      diagnostic: error.code || 'blocked-target',
    });
  }

  try {
    const limits = resolveLimits(env.FONT_EXTRACTION_LIMITS);
    const result = await extractFontMetadata(targetUrl, limits);
    return jsonResponse({
      ok: true,
      fonts: result.fonts,
      total: result.fonts.length,
      sourceUrl: targetUrl.href,
      truncation: result.truncation,
    }, 200, corsHeaders);
  } catch (error) {
    const timedOut = error?.code === 'UPSTREAM_TIMEOUT' || error?.name === 'AbortError';
    return errorResponse(timedOut ? 'UPSTREAM_TIMEOUT' : 'PROVIDER_UNAVAILABLE', timedOut ? 504 : 502, {
      headers: corsHeaders,
      error,
      diagnostic: error?.code || 'font-analysis',
    });
  }
}
