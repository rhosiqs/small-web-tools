export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://img.shields.io https://badgen.net https://github.com https://raw.githubusercontent.com https://user-images.githubusercontent.com; connect-src 'self' https://speed.cloudflare.com https://unpkg.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://www.openstreetmap.org; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests;";

export const BASELINE_RESPONSE_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=86400',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
});

export function withBaselineHeaders(additionalHeaders = {}) {
  const headers = new Headers(BASELINE_RESPONSE_HEADERS);
  new Headers(additionalHeaders).forEach((value, name) => headers.set(name, value));
  return headers;
}
