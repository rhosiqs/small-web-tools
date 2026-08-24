import { describe, expect, it, vi } from 'vitest';
import {
  estimateMp3Duration,
  parseID3v1,
  parseID3v2,
} from '../components/AudioMeta/lib/id3.js';
import { parseFlac, parseWav } from '../components/AudioMeta/lib/audioFormats.js';
import { parseAudioFile } from '../components/AudioMeta/lib/parseAudioFile.js';
import { stripMp3Metadata } from '../components/AudioMeta/lib/stripMetadata.js';
import { getTagLabel } from '../components/AudioMeta/lib/tagLabels.js';
import {
  attachAudioPreviewUrl,
  createReplacementAudioUrl,
  revokeAudioFileUrls,
} from '../components/AudioMeta/lib/audioObjectUrls.js';
import { formatBytes, formatDuration } from '../lib/mediaMetadataFormatters.js';

function writeAscii(target, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function representativeWav() {
  const bytes = new Uint8Array(48);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, 40, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 48_000, true);
  view.setUint32(28, 192_000, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, 4, true);
  return bytes;
}

function representativeFlac() {
  const bytes = new Uint8Array(42);
  writeAscii(bytes, 0, 'fLaC');
  bytes[4] = 0x80;
  bytes[7] = 34;
  const sampleRate = 48_000;
  const channelsMinusOne = 1;
  const bitsMinusOne = 15;
  const totalSamples = 96_000;
  bytes[18] = sampleRate >> 12;
  bytes[19] = sampleRate >> 4;
  bytes[20] = ((sampleRate & 0x0f) << 4) | (channelsMinusOne << 1) | (bitsMinusOne >> 4);
  bytes[21] = ((bitsMinusOne & 0x0f) << 4) | ((totalSamples / 4294967296) & 0x0f);
  new DataView(bytes.buffer).setUint32(22, totalSamples);
  return bytes;
}

describe('audio metadata domain', () => {
  it('parses ID3v1 fields and track numbers', () => {
    const bytes = new Uint8Array(128);
    writeAscii(bytes, 0, 'TAG');
    writeAscii(bytes, 3, 'Example title');
    writeAscii(bytes, 33, 'Example artist');
    bytes[125] = 0;
    bytes[126] = 7;
    bytes[127] = 17;

    expect(parseID3v1(bytes)).toMatchObject({
      hasV1: true,
      tags: {
        TIT2: 'Example title',
        TPE1: 'Example artist',
        TRCK: '7',
        TCON: 'Rock',
      },
    });
  });

  it('parses representative UTF-8 ID3v2 text frames', () => {
    const text = new TextEncoder().encode('Example song');
    const frameSize = text.length + 1;
    const bytes = new Uint8Array(10 + 10 + frameSize);
    writeAscii(bytes, 0, 'ID3');
    bytes[3] = 3;
    bytes[9] = 10 + frameSize;
    writeAscii(bytes, 10, 'TIT2');
    bytes[17] = frameSize;
    bytes[20] = 3;
    bytes.set(text, 21);

    expect(parseID3v2(bytes).tags).toEqual({ TIT2: 'Example song' });
  });

  it('returns empty metadata for malformed input', () => {
    expect(parseID3v2(new Uint8Array([1, 2, 3]))).toEqual({ tags: {}, coverArt: null });
    expect(parseWav(new Uint8Array([1, 2, 3]))).toEqual({ tags: {}, technical: {}, coverArt: null });
  });

  it('parses representative WAV and FLAC technical metadata', () => {
    expect(parseWav(representativeWav()).technical).toMatchObject({
      numChannels: 2,
      sampleRate: 48_000,
      bitsPerSample: 16,
      durationSec: 4 / 192_000,
    });
    expect(parseFlac(representativeFlac()).technical).toMatchObject({
      numChannels: 2,
      sampleRate: 48_000,
      bitsPerSample: 16,
      durationSec: 2,
    });
  });

  it('dispatches a parsed file and settles HTML audio probing once', async () => {
    const originalAudio = globalThis.Audio;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:probe');
    URL.revokeObjectURL = revokeObjectURL;
    globalThis.Audio = class {
      set src(_value) {
        queueMicrotask(() => this.onerror?.());
      }
    };

    try {
      const bytes = representativeWav();
      const result = await parseAudioFile({
        name: 'sample.wav',
        size: bytes.byteLength,
        type: 'audio/wav',
        arrayBuffer: async () => bytes.buffer,
      });
      expect(result).toMatchObject({ format: 'WAV', ext: 'wav' });
      expect(result.technical.sampleRate).toBe(48_000);
      const emptyBytes = new Uint8Array(16);
      const fallbackFormats = await Promise.all([
        ['voice.opus', 'Opus'],
        ['archive.wma', 'WMA/ASF'],
        ['legacy.aiff', 'AIFF'],
        ['unknown.bin', 'BIN'],
      ].map(async ([name, format]) => {
        const parsed = await parseAudioFile({
          name,
          size: emptyBytes.byteLength,
          type: 'application/octet-stream',
          arrayBuffer: async () => emptyBytes.buffer,
        });
        return [parsed.format, format];
      }));
      expect(fallbackFormats).toEqual([
        ['Opus', 'Opus'],
        ['WMA/ASF', 'WMA/ASF'],
        ['AIFF', 'AIFF'],
        ['BIN', 'BIN'],
      ]);
      expect(revokeObjectURL).toHaveBeenCalledTimes(5);
    } finally {
      globalThis.Audio = originalAudio;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('formats shared metadata values and tag labels defensively', () => {
    expect(formatBytes(1_536)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 6)).toMatch(/TB$/u);
    expect(formatDuration(3_661)).toBe('1:01:01');
    expect(formatDuration(Number.NaN)).toBe('\u2014');
    expect(getTagLabel('TIT2')).toBe('Title');
    expect(getTagLabel('VC_CUSTOM')).toBe('CUSTOM');
  });

  it('estimates constant-bitrate MP3 duration from a valid frame header', () => {
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00]);

    expect(estimateMp3Duration(bytes, 16_000)).toMatchObject({
      bitrate: '128 kbps',
      sampleRate: 44_100,
      durationSec: 1,
    });
  });

  it('strips leading ID3v2 and trailing ID3v1 data without touching audio bytes', () => {
    const bytes = new Uint8Array(10 + 4 + 3 + 128);
    writeAscii(bytes, 0, 'ID3');
    bytes[9] = 4;
    bytes.set([9, 8, 7], 14);
    writeAscii(bytes, 17, 'TAG');

    expect([...new Uint8Array(stripMp3Metadata(bytes.buffer))]).toEqual([9, 8, 7]);
  });

  it('makes preview and derived URL ownership explicit', () => {
    const createObjectUrl = vi.fn()
      .mockReturnValueOnce('blob:preview')
      .mockReturnValueOnce('blob:replacement');
    const revokeObjectUrl = vi.fn();
    const record = attachAudioPreviewUrl(
      { arrayBuffer: new Uint8Array([1]).buffer, strippedInfo: null },
      { type: 'audio/mpeg' },
      createObjectUrl,
    );

    expect(record.objectUrl).toBe('blob:preview');
    expect(createReplacementAudioUrl('blob:old', new Blob(), createObjectUrl, revokeObjectUrl))
      .toBe('blob:replacement');
    revokeAudioFileUrls({ ...record, strippedInfo: { url: 'blob:replacement' } }, revokeObjectUrl);
    expect(revokeObjectUrl.mock.calls).toEqual([
      ['blob:old'],
      ['blob:preview'],
      ['blob:replacement'],
    ]);
  });
});
