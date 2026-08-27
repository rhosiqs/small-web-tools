import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeExternalFetch = vi.fn();
const enforceRateLimit = vi.fn(async () => null);

vi.mock('../../functions/_shared/safeExternalFetch.js', async (importOriginal) => ({
  ...(await importOriginal()),
  safeExternalFetch,
}));
vi.mock('../../functions/_shared/rateLimit.js', () => ({ enforceRateLimit }));

const { onRequestOptions, onRequestPost } = await import('../../functions/api/extract-fonts.js');
const { FONT_EXTRACTION_EGRESS_POLICY } = await import('../../functions/_shared/fontExtractionCapability.js');
const ORIGIN = 'https://tools.example.com';

function currentVerification() {
  const now = Date.now();
  return JSON.stringify({
    ...FONT_EXTRACTION_EGRESS_POLICY,
    outcome: 'pass',
    evidenceSha256: 'a'.repeat(64),
    verifiedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    scenarios: [...FONT_EXTRACTION_EGRESS_POLICY.requiredScenarios],
  });
}

function responseBody(text) {
  return {
    response: new Response(text),
    buffer: new TextEncoder().encode(text).buffer,
  };
}

function postContext(body, options = {}) {
  const headers = {
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/json',
    ...options.headers,
  };
  return {
    request: new Request(`${ORIGIN}/api/extract-fonts`, {
      method: 'POST',
      headers,
      body: options.rawBody ?? JSON.stringify(body),
    }),
    env: {
      FONT_EXTRACTION_EGRESS_VERIFICATION: currentVerification(),
      ...(options.env || {}),
    },
  };
}

describe('font extractor handler', () => {
  beforeEach(() => {
    safeExternalFetch.mockReset();
    enforceRateLimit.mockClear();
  });

  it('permits only same-origin preflight requests', async () => {
    const sameOrigin = await onRequestOptions({
      request: new Request(`${ORIGIN}/api/extract-fonts`, {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN },
      }),
    });
    expect(sameOrigin.status).toBe(204);
    expect(sameOrigin.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const crossOrigin = await onRequestOptions({
      request: new Request(`${ORIGIN}/api/extract-fonts`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example' },
      }),
    });
    expect(crossOrigin.status).toBe(403);
  });

  it.each([
    [{ headers: { Origin: '' } }, 403],
    [{ headers: { Origin: 'https://attacker.example' } }, 403],
    [{ headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
    [{ headers: { 'Content-Type': 'text/plain' } }, 415],
  ])('rejects invalid browser request policy before rate limiting', async (options, status) => {
    const response = await onRequestPost(postContext({ url: 'https://example.com' }, options));
    expect(response.status).toBe(status);
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(safeExternalFetch).not.toHaveBeenCalled();
  });

  it('rate limits before parsing or upstream work', async () => {
    enforceRateLimit.mockResolvedValueOnce(new Response('limited', { status: 429 }));
    const response = await onRequestPost(postContext({ url: 'https://example.com' }));
    expect(response.status).toBe(429);
    expect(safeExternalFetch).not.toHaveBeenCalled();
  });

  it('rejects bodies over 4 KiB', async () => {
    const response = await onRequestPost(postContext(null, {
      rawBody: JSON.stringify({ url: 'https://example.com', padding: 'x'.repeat(4096) }),
    }));
    expect(response.status).toBe(413);
    expect(safeExternalFetch).not.toHaveBeenCalled();
  });

  it('returns metadata without source URLs, tokens, or proxy fields', async () => {
    const html = [
      '<style>',
      '@font-face { font-family: "Demo"; src: url("/demo.woff2") format("woff2");',
      'font-weight: 600; font-style: italic; }',
      '</style>',
    ].join('');
    safeExternalFetch.mockResolvedValue(responseBody(html));

    const response = await onRequestPost(postContext({ url: 'https://example.com/page' }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.fonts).toEqual([
      expect.objectContaining({
        family: 'Demo',
        format: 'WOFF2',
        weight: '600',
        style: 'italic',
        sourceHost: 'example.com',
      }),
    ]);
    expect(JSON.stringify(result.fonts)).not.toMatch(/url|token|proxy/iu);
  });

  it('deduplicates stylesheet jobs and stops at the configured job cap', async () => {
    const html = [
      '<link rel="stylesheet" href="/a.css">',
      '<link rel="stylesheet" href="/a.css">',
      '<link rel="stylesheet" href="/b.css">',
    ].join('');
    const css = '@font-face { font-family: Demo; src: url("/demo.woff2") format("woff2"); }';
    safeExternalFetch
      .mockResolvedValueOnce(responseBody(html))
      .mockResolvedValueOnce(responseBody(css));

    const response = await onRequestPost(postContext(
      { url: 'https://example.com' },
      { env: { FONT_EXTRACTION_LIMITS: { stylesheets: 1, concurrency: 1 } } },
    ));
    const result = await response.json();
    expect(safeExternalFetch).toHaveBeenCalledTimes(2);
    expect(result.truncation).toMatchObject({
      truncated: true,
      reasons: expect.arrayContaining(['stylesheets']),
      consumed: { stylesheets: 1, fontFaces: 1 },
    });
  });

  it('caps @font-face descriptor lengths so a small stylesheet cannot amplify the response', async () => {
    // Every descriptor is copied onto each src, so unbounded values multiply.
    const filler = 'x'.repeat(50_000);
    const html = [
      '<style>@font-face {',
      `font-family: ${filler};`,
      `font-weight: ${filler};`,
      `font-style: ${filler};`,
      `font-stretch: ${filler};`,
      `unicode-range: ${filler};`,
      `font-variation-settings: ${filler};`,
      'src: url("/a.woff2"), url("/b.woff2"), url("/c.woff2");',
      '}</style>',
    ].join('');
    safeExternalFetch.mockResolvedValue(responseBody(html));

    const result = await (await onRequestPost(postContext({ url: 'https://example.com' }))).json();

    expect(result.fonts).toHaveLength(3);
    for (const font of result.fonts) {
      for (const field of ['family', 'weight', 'style', 'stretch', 'unicodeRange', 'variationSettings']) {
        expect(font[field].length).toBeLessThanOrEqual(128);
      }
    }
    expect(JSON.stringify(result).length).toBeLessThan(10_000);
  });

  it('does not read data-* attributes as link attributes', async () => {
    const html = [
      '<link data-rel="stylesheet" data-href="/tracker.css">',
      '<link rel="stylesheet" href="/real.css">',
    ].join('');
    const css = '@font-face { font-family: Demo; src: url("/demo.woff2"); }';
    safeExternalFetch
      .mockResolvedValueOnce(responseBody(html))
      .mockResolvedValueOnce(responseBody(css));

    await onRequestPost(postContext({ url: 'https://example.com' }));

    const fetched = safeExternalFetch.mock.calls.map(([url]) => url);
    expect(fetched).toContain('https://example.com/real.css');
    expect(fetched).not.toContain('https://example.com/tracker.css');
  });

  it('applies a string-encoded limits override the way Workers deliver plain-text vars', async () => {
    const html = [
      '<style>',
      '@font-face { font-family: A; src: url("/a.woff2"); }',
      '@font-face { font-family: B; src: url("/b.woff2"); }',
      '</style>',
    ].join('');
    safeExternalFetch.mockResolvedValue(responseBody(html));

    const result = await (await onRequestPost(postContext(
      { url: 'https://example.com' },
      { env: { FONT_EXTRACTION_LIMITS: JSON.stringify({ fontFaces: 1 }) } },
    ))).json();

    expect(result.fonts).toHaveLength(1);
    expect(result.truncation.reasons).toContain('font-faces');
    expect(result.truncation.limits).not.toHaveProperty('0');
  });

  it('charges the reserved bytes when an upstream fetch fails mid-stream', async () => {
    const html = ['<link rel="stylesheet" href="/a.css">', '<link rel="stylesheet" href="/b.css">'].join('');
    safeExternalFetch
      .mockResolvedValueOnce(responseBody(html))
      .mockRejectedValue(new Error('Response size exceeds limit'));

    const result = await (await onRequestPost(postContext(
      { url: 'https://example.com' },
      { env: { FONT_EXTRACTION_LIMITS: JSON.stringify({ cssBytes: 1024, totalUpstreamBytes: 2048 }) } },
    ))).json();

    expect(result.truncation.consumed.upstreamBytes).toBeGreaterThanOrEqual(1024);
  });

  it('returns machine-readable truncation when the face cap is reached', async () => {
    const html = [
      '<style>',
      '@font-face { font-family: A; src: url("/a.woff2"); }',
      '@font-face { font-family: B; src: url("/b.woff2"); }',
      '</style>',
    ].join('');
    safeExternalFetch.mockResolvedValue(responseBody(html));
    const result = await (await onRequestPost(postContext(
      { url: 'https://example.com' },
      { env: { FONT_EXTRACTION_LIMITS: { fontFaces: 1 } } },
    ))).json();
    expect(result.fonts).toHaveLength(1);
    expect(result.truncation.reasons).toContain('font-faces');
  });
});
