import { describe, expect, it } from 'vitest';
import { bytesToBase64, bytesToBinaryString, bytesToDataUrl } from '../lib/binaryEncoding.js';

describe('binaryEncoding', () => {
  it('round-trips a small payload', () => {
    const bytes = Uint8Array.from([0x68, 0x69]);
    expect(bytesToBinaryString(bytes)).toBe('hi');
    expect(bytesToBase64(bytes)).toBe('aGk=');
    expect(bytesToDataUrl(bytes, 'image/png')).toBe('data:image/png;base64,aGk=');
  });

  it('encodes payloads far past the argument-spread limit', () => {
    // `String.fromCharCode(...bytes)` throws RangeError around 100 KB, which is
    // ordinary for embedded cover art.
    const bytes = new Uint8Array(2 * 1024 * 1024).fill(0x41);
    const encoded = bytesToBase64(bytes);
    expect(encoded).toBe(btoa('A'.repeat(bytes.length)));
    expect(bytesToBinaryString(bytes)).toHaveLength(bytes.length);
  });

  it('preserves every byte value across chunk boundaries', () => {
    const bytes = new Uint8Array(0x8000 + 16);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 256;
    const decoded = bytesToBinaryString(bytes);
    expect(decoded).toHaveLength(bytes.length);
    expect(decoded.charCodeAt(0x8000)).toBe(0x8000 % 256);
    expect(decoded.charCodeAt(bytes.length - 1)).toBe((bytes.length - 1) % 256);
  });

  it('accepts a plain number array', () => {
    expect(bytesToBinaryString([0x41, 0x42])).toBe('AB');
  });
});
