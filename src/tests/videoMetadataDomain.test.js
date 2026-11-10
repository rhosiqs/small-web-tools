import { describe, expect, it, vi } from 'vitest';
import {
  frameCountToTimecode,
  getAudioExtension,
  parseLogFile,
  parseMP4,
} from '../components/VideoMeta/lib/videoMetadata.js';
import { createVideoAudioExtractionService } from '../components/VideoMeta/lib/videoAudioExtraction.js';

function ascii(value) {
  return new TextEncoder().encode(value);
}

function atom(type, payload) {
  const bytes = new Uint8Array(8 + payload.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(ascii(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function concat(...parts) {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function representativeMp4() {
  const ftyp = new Uint8Array(12);
  ftyp.set(ascii('isom'), 0);
  ftyp.set(ascii('isom'), 8);

  const mvhd = new Uint8Array(20);
  const movieView = new DataView(mvhd.buffer);
  movieView.setUint32(4, 100);
  movieView.setUint32(12, 1_000);
  movieView.setUint32(16, 2_500);

  const hdlr = new Uint8Array(30);
  hdlr.set(ascii('soun'), 8);
  hdlr.set(ascii('Audio'), 24);

  const mdhd = new Uint8Array(24);
  const mediaView = new DataView(mdhd.buffer);
  mediaView.setUint32(12, 48_000);
  mediaView.setUint32(16, 96_000);

  const sampleEntry = new Uint8Array(36);
  const sampleView = new DataView(sampleEntry.buffer);
  sampleView.setUint32(0, 36);
  sampleEntry.set(ascii('mp4a'), 4);
  sampleView.setUint16(24, 2);
  sampleView.setUint16(26, 16);
  sampleView.setUint32(32, 48_000 << 16);

  const stsdPayload = new Uint8Array(8 + sampleEntry.length);
  new DataView(stsdPayload.buffer).setUint32(4, 1);
  stsdPayload.set(sampleEntry, 8);

  const track = atom('trak', atom('mdia', concat(
    atom('hdlr', hdlr),
    atom('mdhd', mdhd),
    atom('minf', atom('stbl', atom('stsd', stsdPayload))),
  )));
  return concat(atom('ftyp', ftyp), atom('moov', concat(atom('mvhd', mvhd), track)));
}

describe('video metadata domain', () => {
  it('parses representative MP4 container and audio-track metadata', () => {
    const result = parseMP4(representativeMp4());

    expect(result).toMatchObject({
      brand: 'isom',
      compatibleBrands: ['isom'],
      duration: 2.5,
      timescale: 1_000,
    });
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      type: 'audio',
      codec: 'AAC',
      channels: 2,
      bitsPerSample: 16,
      sampleRate: 48_000,
      duration: 2,
    });
  });

  it('handles malformed atoms without reading outside the supplied bytes', () => {
    expect(parseMP4(new Uint8Array([0, 0, 0, 100, 109, 111, 111, 118]))).toMatchObject({
      brand: null,
      tracks: [],
    });
  });

  it('converts regular and drop-frame SMPTE timecodes', () => {
    expect(frameCountToTimecode(90, 30, false)).toBe('00:00:03:00');
    expect(frameCountToTimecode(1_800, 30, true)).toBe('00:01:00;02');
    expect(frameCountToTimecode(1, 0, false)).toBeNull();
  });

  it('parses log parameters and maps audio extensions', () => {
    expect(parseLogFile('# comment\nCodec: AAC\nRate = 48000').params).toEqual({
      Codec: 'AAC',
      Rate: '48000',
    });
    expect(getAudioExtension('ec-3', '')).toBe('eac3');
    expect(getAudioExtension('', 'unknown')).toBe('mka');
  });
});

// Sample entry for an MPEG audio track: a sound description followed by an
// esds box whose DecoderConfigDescriptor names the real codec. `mp4a` is a
// generic MPEG-4 audio entry; object type 0x6B is MPEG-1 audio (MP3), which the
// M4A muxer rejects, so extraction has to pick the MP3 container instead.
function mpegAudioSampleEntry(objectTypeIndication) {
  const esds = atom('esds', new Uint8Array([
    0, 0, 0, 0,
    0x03, 0x19, 0x00, 0x02, 0x00,
    0x04, 0x11, objectTypeIndication, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0x06, 0x01, 0x02,
  ]));
  const entry = new Uint8Array(36 + esds.length);
  const view = new DataView(entry.buffer);
  view.setUint32(0, entry.length);
  entry.set(ascii('mp4a'), 4);
  view.setUint16(24, 2);
  view.setUint16(26, 16);
  view.setUint32(32, 44_100 << 16);
  entry.set(esds, 36);
  return entry;
}

function handler(componentType, handlerType) {
  const payload = new Uint8Array(25);
  payload.set(ascii(componentType), 4);
  payload.set(ascii(handlerType), 8);
  return atom('hdlr', payload);
}

// QuickTime (.mov) tracks carry a second hdlr inside minf: the data handler
// (component type 'dhlr', subtype 'alis' or 'url '), which says how media is
// stored, not what kind of media the track holds.
function audioMovie(sampleEntry, { dataHandler = false } = {}) {
  const stsdPayload = new Uint8Array(8 + sampleEntry.length);
  new DataView(stsdPayload.buffer).setUint32(4, 1);
  stsdPayload.set(sampleEntry, 8);
  const minf = atom('minf', concat(
    ...(dataHandler ? [handler('dhlr', 'url ')] : []),
    atom('stbl', atom('stsd', stsdPayload)),
  ));
  return concat(atom('moov', atom('trak', atom('mdia', concat(
    atom('mdhd', new Uint8Array(24)),
    handler(dataHandler ? 'mhlr' : '\0\0\0\0', 'soun'),
    minf,
  )))));
}

describe('video audio extraction container choice', () => {
  it('extracts E-AC-3 as .eac3 rather than .ac3 when given the parsed codec name', () => {
    const track = parseMP4(audioMovie(new Uint8Array([0, 0, 0, 8, ...ascii('ec-3')]))).tracks[0];
    expect(getAudioExtension(track.codecFourCC, track.codec)).toBe('eac3');
    expect(getAudioExtension('ac-3', 'Dolby Digital (AC-3)')).toBe('ac3');
  });

  it('extracts MP3 carried in an mp4a sample entry as .mp3', () => {
    const mp3 = parseMP4(audioMovie(mpegAudioSampleEntry(0x6b))).tracks[0];
    expect(mp3.codec).toMatch(/MP3/);
    expect(getAudioExtension(mp3.codecFourCC, mp3.codec)).toBe('mp3');

    const aac = parseMP4(audioMovie(mpegAudioSampleEntry(0x40))).tracks[0];
    expect(aac.codec).toBe('AAC');
    expect(getAudioExtension(aac.codecFourCC, aac.codec)).toBe('m4a');
  });

  it('keeps QuickTime audio tracks typed as audio despite the data handler', () => {
    const track = parseMP4(audioMovie(mpegAudioSampleEntry(0x40), { dataHandler: true })).tracks[0];
    expect(track).toMatchObject({ type: 'audio', handlerType: 'soun', codec: 'AAC', channels: 2 });
  });
});

describe('video audio extraction lifecycle', () => {
  function setup({ exitCode = 0 } = {}) {
    const listeners = new Map();
    const ffmpeg = {
      writeFile: vi.fn(async () => {}),
      exec: vi.fn(async () => {
        listeners.get('progress')?.({ progress: 0.42 });
        return exitCode;
      }),
      readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      deleteFile: vi.fn(async () => {}),
      on: vi.fn((event, listener) => listeners.set(event, listener)),
      off: vi.fn((event, listener) => {
        if (listeners.get(event) === listener) listeners.delete(event);
      }),
    };
    const terminate = vi.fn();
    const service = createVideoAudioExtractionService({
      ensureLoaded: vi.fn(async () => ffmpeg),
      mimeFor: vi.fn(() => 'audio/mp4'),
      terminate,
    });
    return { ffmpeg, listeners, service, terminate };
  }

  it('uses unique temp files and always removes listeners and virtual files', async () => {
    const { ffmpeg, listeners, service } = setup();
    const progress = vi.fn();
    const file = { name: 'sample.mp4', arrayBuffer: async () => new Uint8Array([7, 8]).buffer };
    const first = await service.extract(file, 0, { codecFourCC: 'mp4a' }, { onProgress: progress });
    await service.extract(file, 0, { codecFourCC: 'mp4a' });

    expect(first).toMatchObject({ extension: 'm4a' });
    expect(first.blob.type).toBe('audio/mp4');
    expect(progress).toHaveBeenCalledWith(42);
    expect(ffmpeg.writeFile.mock.calls[0][0]).not.toBe(ffmpeg.writeFile.mock.calls[1][0]);
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(4);
    expect(ffmpeg.off).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('cleans temp files after FFmpeg failure', async () => {
    const { ffmpeg, service } = setup({ exitCode: 1 });
    await expect(service.extract(
      { name: 'broken.mov', arrayBuffer: async () => new Uint8Array([1]).buffer },
      0,
      { codec: 'AAC' },
    )).rejects.toThrow('FFmpeg execution failed');
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('supports cancellation and terminates the engine exactly once on disposal', async () => {
    const { ffmpeg, service, terminate } = setup();
    const controller = new AbortController();
    controller.abort();

    await expect(service.extract(
      { name: 'cancelled.mp4', arrayBuffer: async () => new Uint8Array([1]).buffer },
      0,
      { codec: 'AAC' },
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
    expect(ffmpeg.writeFile).not.toHaveBeenCalled();

    service.dispose();
    service.dispose();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
