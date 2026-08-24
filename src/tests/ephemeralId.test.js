import { describe, expect, it, vi } from 'vitest';
import { createEphemeralId } from '../lib/ephemeralId.js';

describe('createEphemeralId', () => {
  it('uses randomUUID when the platform provides it', () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');

    expect(createEphemeralId('image')).toBe('image-00000000-0000-4000-8000-000000000000');
    expect(randomUUID).toHaveBeenCalledOnce();

    randomUUID.mockRestore();
  });

  it('creates distinct prefixed IDs across repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createEphemeralId('image')));

    expect(ids.size).toBe(100);
    expect([...ids].every((id) => id.startsWith('image-'))).toBe(true);
  });
});
