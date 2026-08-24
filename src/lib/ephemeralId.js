let fallbackSequence = 0;

/**
 * Creates an in-memory identity without coupling UI records to React render IDs.
 * Browser cryptography is preferred; the final fallback combines time, a
 * process-local sequence, and randomness so repeated calls remain distinct.
 *
 * @param {string} [prefix]
 * @returns {string}
 */
export function createEphemeralId(prefix = 'item') {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const randomBytes = new Uint32Array(4);
    cryptoApi.getRandomValues(randomBytes);
    return `${prefix}-${Array.from(randomBytes, (value) => value.toString(36)).join('')}`;
  }

  fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
