import { readFile } from 'node:fs/promises';
import { BASELINE_RESPONSE_HEADERS, CONTENT_SECURITY_POLICY } from '../functions/_shared/responseHeaders.js';

const headers = await readFile('public/_headers', 'utf8');
const exceptions = JSON.parse(await readFile('config/csp-exceptions.json', 'utf8'));
const requiredHeaders = Object.entries(BASELINE_RESPONSE_HEADERS).map(([name, value]) => `${name}: ${value}`);

for (const header of requiredHeaders) {
  if (!headers.includes(header)) throw new Error(`Missing security header: ${header}`);
}

if (!headers.includes(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`)) {
  throw new Error('Static and Function CSP policies must remain identical.');
}

const exceptionKeys = new Set(exceptions.map(({ directive, source }) => `${directive} ${source}`));
const expectedExceptionKeys = new Set([
  "script-src 'wasm-unsafe-eval'", 'script-src blob:', "style-src 'unsafe-inline'",
  'font-src data:', 'img-src data:', 'img-src blob:',
  'img-src https://img.shields.io', 'img-src https://badgen.net', 'img-src https://github.com',
  'img-src https://raw.githubusercontent.com', 'img-src https://user-images.githubusercontent.com',
  'connect-src https://speed.cloudflare.com', 'connect-src https://unpkg.com',
  'media-src blob:', 'worker-src blob:', 'frame-src https://www.openstreetmap.org',
]);
if (exceptionKeys.size !== expectedExceptionKeys.size || [...expectedExceptionKeys].some((key) => !exceptionKeys.has(key))) {
  throw new Error('CSP exception inventory must exactly match the reviewed policy exceptions.');
}
for (const exception of exceptions) {
  if (!exception.reason || !exception.removalCondition || !exception.features?.length) {
    throw new Error(`Incomplete CSP exception record: ${exception.directive} ${exception.source}`);
  }
  const directive = CONTENT_SECURITY_POLICY.split(';').find((part) => part.trim().startsWith(`${exception.directive} `));
  if (!directive?.split(/\s+/u).includes(exception.source)) {
    throw new Error(`Inventoried CSP source is absent from policy: ${exception.directive} ${exception.source}`);
  }
}

for (const directive of [
  "default-src 'self'",
  "connect-src 'self' https://speed.cloudflare.com https://unpkg.com",
  'frame-src https://www.openstreetmap.org',
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'none'",
]) {
  if (!headers.includes(directive)) throw new Error(`Missing CSP directive: ${directive}`);
}

if (/connect-src[^;]*\*/u.test(headers) || /frame-src[^;]*\*/u.test(headers)) {
  throw new Error('CSP connect-src and frame-src must not contain wildcards.');
}

const hstsLines = headers.match(/^\s*Strict-Transport-Security:.*$/gimu) || [];
if (hstsLines.length !== 1) {
  throw new Error('The staged HSTS policy must be declared exactly once.');
}
if (/\bincludeSubDomains\b|\bpreload\b/iu.test(hstsLines[0])) {
  throw new Error('HSTS includeSubDomains/preload require a separate audited rollout.');
}

console.log('Static security header policy passed (HSTS stage: max-age=86400).');
