// Shared binary-to-text helpers for browser-local parsers.

// `String.fromCharCode(...bytes)` passes one argument per byte and throws
// `RangeError: too many arguments` once the array exceeds the engine's argument
// limit (roughly 100 KB in practice). Embedded artwork routinely exceeds that,
// so binary payloads are converted in fixed-size chunks instead.
const CHUNK_SIZE = 0x8000;

/**
 * Convert bytes to a Latin-1 (binary) string without spreading the whole array.
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function bytesToBinaryString(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let result = '';
  for (let offset = 0; offset < view.length; offset += CHUNK_SIZE) {
    result += String.fromCharCode(...view.subarray(offset, offset + CHUNK_SIZE));
  }
  return result;
}

/**
 * Base64-encode bytes of any size.
 * @param {Uint8Array | number[]} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  return btoa(bytesToBinaryString(bytes));
}

/**
 * Build a `data:` URL for embedded binary media.
 * @param {Uint8Array | number[]} bytes
 * @param {string} mimeType
 * @returns {string}
 */
export function bytesToDataUrl(bytes, mimeType) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}
