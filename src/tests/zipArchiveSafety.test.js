import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  inspectZipCentralDirectory,
  readZipEntryText,
  validateZipArchive,
} from '../lib/resourceLimits.js';

// Hand-built fixtures prove the parser's edge cases; these exercise it against
// archives produced by the same library that later reads them.
const asFile = (buffer) => ({ arrayBuffer: async () => buffer });

// Deflate barely shrinks pseudo-random bytes, so this stands in for ordinary
// document content rather than tripping the compression-ratio guard.
const incompressible = (length) => {
  const bytes = new Uint8Array(length);
  let state = 0x2545f491;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
};

const archive = (build, options = {}) => {
  const zip = new JSZip();
  build(zip);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', ...options });
};

describe('ZIP safeguards against real archives', () => {
  it('summarizes a genuine archive from its central directory', async () => {
    const buffer = await archive((zip) => {
      zip.file('docProps/core.xml', '<coreProperties><title>Hi</title></coreProperties>');
      zip.file('big.bin', incompressible(200_000));
    });

    const summary = inspectZipCentralDirectory(buffer);
    // Two files plus the implicit `docProps/` folder entry JSZip writes.
    expect(summary).toMatchObject({ entries: 3, malformed: null });
    expect(summary.totalUncompressedBytes).toBeGreaterThan(200_000);
    expect(await validateZipArchive(asFile(buffer))).toMatchObject({ valid: true });
  });

  it('reads a metadata part that stays within the cap', async () => {
    const buffer = await archive((zip) => {
      zip.file('docProps/core.xml', '<coreProperties><title>Hi</title></coreProperties>');
    });
    const loaded = await JSZip.loadAsync(buffer);

    await expect(readZipEntryText(loaded.file('docProps/core.xml'), 1024 * 1024))
      .resolves.toContain('<title>Hi</title>');
  });

  it('aborts an entry that inflates past the cap regardless of what it declared', async () => {
    const buffer = await archive((zip) => zip.file('bomb.txt', 'A'.repeat(5_000_000)));
    const loaded = await JSZip.loadAsync(buffer);

    await expect(readZipEntryText(loaded.file('bomb.txt'), 64 * 1024))
      .rejects.toThrow('expands beyond');
  });

  it('rejects a highly compressible archive before any entry is decompressed', async () => {
    const buffer = await archive((zip) => zip.file('bomb.txt', 'A'.repeat(20_000_000)));

    const check = await validateZipArchive(asFile(buffer));
    expect(check.valid).toBe(false);
    expect(check.error).toMatch(/compression ratio/u);
  });

  it('rejects a truncated archive whose end record was cut off', async () => {
    const buffer = await archive((zip) => zip.file('a.txt', 'hello'));

    const check = await validateZipArchive(asFile(buffer.slice(0, buffer.byteLength - 10)));
    expect(check.valid).toBe(false);
    expect(check.error).toMatch(/central directory/u);
  });
});
