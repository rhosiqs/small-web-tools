import ipaddr from 'ipaddr.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DNS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const METADATA_HOSTNAMES = new Set([
  'instance-data',
  'metadata',
  'metadata.google',
  'metadata.google.internal',
]);

export class SafeFetchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new SafeFetchError(code, message);
}

function parseIpv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}

function isIpv6Literal(host) {
  return host.includes(':') && /^[0-9a-f:.]+$/i.test(host);
}

export function isPrivateHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (
    host === 'localhost'
    || METADATA_HOSTNAMES.has(host)
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host.endsWith('.internal')
  ) {
    return true;
  }

  const ipv4 = parseIpv4(host);
  if (ipv4) {
    const [a, b, c] = ipv4;
    return (
      a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
      || a >= 224
    );
  }

  if (isIpv6Literal(host)) {
    const embeddedIpv4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(host)?.[1];
    if (embeddedIpv4 && isPrivateHost(embeddedIpv4)) return true;

    // Classify by parsed value rather than by textual prefix. Prefix matching
    // misses every equivalent spelling of a reserved address — `::1` written out
    // as `0000:0000:0000:0000:0000:0000:0000:0001` reads as public.
    try {
      const parsed = ipaddr.IPv6.parse(host);
      if (parsed.isIPv4MappedAddress()) return true;
      return parsed.range() !== 'unicast';
    } catch {
      // An IPv6-shaped host that will not parse is never treated as public.
      return true;
    }
  }

  return false;
}

export function validateTargetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail('INVALID_TARGET', 'Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('BLOCKED_TARGET', 'Only HTTP and HTTPS protocols are allowed');
  }
  if (parsed.username || parsed.password) {
    fail('BLOCKED_TARGET', 'URLs with user credentials are not allowed');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    fail('BLOCKED_TARGET', 'Only standard HTTP (80) and HTTPS (443) ports are allowed');
  }
  if (isPrivateHost(parsed.hostname)) {
    fail('BLOCKED_TARGET', 'Access to internal, loopback, or local IP addresses is prohibited');
  }

  return parsed;
}

/**
 * @param {string} hostname
 * @param {{ fetchImpl?: typeof fetch, signal?: AbortSignal }} [options]
 */
export async function resolveHostname(hostname, { fetchImpl = fetch, signal } = {}) {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  if (parseIpv4(normalizedHostname) || isIpv6Literal(normalizedHostname)) {
    return [normalizedHostname];
  }

  const query = async (type) => {
    const url = new URL(DNS_ENDPOINT);
    url.searchParams.set('name', normalizedHostname);
    url.searchParams.set('type', type);
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/dns-json' },
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error('DNS lookup failed with status ' + response.status);
    const result = await response.json();
    if (result.Status !== 0 && result.Status !== 3) {
      throw new Error('DNS lookup failed with code ' + result.Status);
    }
    return (result.Answer || [])
      .filter((answer) => answer.type === 1 || answer.type === 28)
      .map((answer) => answer.data);
  };

  const addresses = (await Promise.all([query('A'), query('AAAA')])).flat();
  if (!addresses.length) throw new Error('Target hostname did not resolve to a public address');
  return addresses;
}

export async function assertPublicResolution(hostname, options = {}) {
  const resolver = options.resolveHostname || resolveHostname;
  const addresses = await resolver(hostname, options);
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('Target hostname did not resolve to an address');
  }
  if (addresses.some((address) => isPrivateHost(address))) {
    throw new Error('Target hostname resolves to a private or reserved IP address');
  }
  return addresses;
}

function normalizeContentType(value) {
  return (value || '').split(';', 1)[0].trim().toLowerCase();
}

function assertAllowedContentType(response, allowedContentTypes) {
  if (!allowedContentTypes?.length) return;
  const actual = normalizeContentType(response.headers.get('content-type'));
  const allowed = allowedContentTypes.some((entry) => {
    const expected = entry.toLowerCase();
    return expected.endsWith('/*')
      ? actual.startsWith(expected.slice(0, -1))
      : actual === expected;
  });
  if (!allowed) throw new Error('Unexpected response Content-Type: ' + (actual || 'missing'));
}

function abortError(signal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Request aborted', 'AbortError');
}

function awaitWithAbort(value, signal) {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(value).then(
      (result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export async function safeExternalFetch(rawUrl, options = {}) {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxRedirects = options.maxRedirects ?? 3;
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(
    () => controller.abort(new SafeFetchError('UPSTREAM_TIMEOUT', 'External request deadline exceeded')),
    timeoutMs,
  );
  let currentUrl = rawUrl;

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const validatedUrl = validateTargetUrl(currentUrl);
      await awaitWithAbort(assertPublicResolution(validatedUrl.hostname, {
        fetchImpl,
        resolveHostname: options.resolveHostname,
        signal: controller.signal,
      }), controller.signal);

      const response = await awaitWithAbort(fetchImpl(validatedUrl.href, {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Small-Web-Tools/1.0 (+https://small-web-tools.pages.dev)',
          ...options.headers,
        },
        redirect: 'manual',
        signal: controller.signal,
      }), controller.signal);

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location) fail('UPSTREAM_INVALID', 'Redirect missing Location header');
        if (redirectCount === maxRedirects) fail('TOO_MANY_REDIRECTS', 'Too many redirects');
        currentUrl = new URL(location, validatedUrl.href).href;
        continue;
      }
      if (!response.ok) {
        throw new Error('Remote server responded with status ' + response.status);
      }

      assertAllowedContentType(response, options.allowedContentTypes);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > maxBytes) {
        throw new Error('Response size exceeds limit of ' + maxBytes + ' bytes');
      }

      if (!response.body) {
        const buffer = await awaitWithAbort(response.arrayBuffer(), controller.signal);
        if (buffer.byteLength > maxBytes) {
          throw new Error('Response size exceeds limit of ' + maxBytes + ' bytes');
        }
        return { response, buffer, url: validatedUrl.href };
      }

      const reader = response.body.getReader();
      const cancelReader = () => reader.cancel('External request aborted').catch(() => {});
      controller.signal.addEventListener('abort', cancelReader, { once: true });
      const chunks = [];
      let totalRead = 0;
      try {
        while (true) {
          const { done, value } = await awaitWithAbort(reader.read(), controller.signal);
          if (done) break;
          totalRead += value.byteLength;
          if (totalRead > maxBytes) {
            await reader.cancel('Response size limit exceeded');
            throw new Error('Response size exceeds limit of ' + maxBytes + ' bytes');
          }
          chunks.push(value);
        }
      } finally {
        controller.signal.removeEventListener('abort', cancelReader);
      }

      const fullBuffer = new Uint8Array(totalRead);
      let offset = 0;
      for (const chunk of chunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { response, buffer: fullBuffer.buffer, url: validatedUrl.href };
    }
    fail('TOO_MANY_REDIRECTS', 'Too many redirects');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
