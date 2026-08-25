import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createVerifiedAssetUrl } from '../components/mediaSeparatorEngine.js';

function sha256(bytes) {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
}

describe('FFmpeg runtime integrity', () => {
  it('creates a Blob URL only after size and SHA-256 validation', async () => {
    const bytes = new TextEncoder().encode('verified runtime').buffer;
    const createObjectURL = vi.fn(() => 'blob:verified');
    const result = await createVerifiedAssetUrl({
      url: 'https://unpkg.com/example.js',
      contentType: 'text/javascript',
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }, {
      fetchImpl: vi.fn(async () => new Response(bytes)),
      digestImpl: async (_algorithm, input) => createHash('sha256').update(new Uint8Array(input)).digest(),
      createObjectURL,
    });
    expect(result).toBe('blob:verified');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('rejects tampered bytes without creating an executable URL', async () => {
    const bytes = new TextEncoder().encode('tampered runtime').buffer;
    const createObjectURL = vi.fn();
    await expect(createVerifiedAssetUrl({
      url: 'https://unpkg.com/example.wasm',
      contentType: 'application/wasm',
      bytes: bytes.byteLength,
      sha256: '0'.repeat(64),
    }, {
      fetchImpl: vi.fn(async () => new Response(bytes)),
      digestImpl: async (_algorithm, input) => createHash('sha256').update(new Uint8Array(input)).digest(),
      createObjectURL,
    })).rejects.toThrow('integrity');
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

