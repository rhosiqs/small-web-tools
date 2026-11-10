import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_FORMATS,
  FALLBACK_AUDIO_EXT,
  FALLBACK_VIDEO_EXT,
  VIDEO_FORMATS,
  createVerifiedAssetUrl,
  guessMime,
  parseInputStreams,
  resolveAudioOutputExt,
  resolveVideoOutputExt,
} from '../components/mediaSeparatorEngine.js';

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


describe('Media Splitter output arguments', () => {
  const videoArgs = (value) => VIDEO_FORMATS.find((f) => f.value === value).buildArgs();

  it('does not encode WebM with libvpx-vp9, which traps in the pinned core', () => {
    // The pinned @ffmpeg/core 0.12.6 throws "RuntimeError: memory access out of
    // bounds" for every multi-frame libvpx-vp9 encode, so WebM output never finished.
    const args = videoArgs('webm');
    expect(args).not.toContain('libvpx-vp9');
    expect(args).toEqual(expect.arrayContaining(['-vcodec', 'libvpx']));
  });

  it('forces playable 8-bit 4:2:0 H.264 with even dimensions for MP4 output', () => {
    // Without it, RGB, 4:2:2, and 10-bit sources became High 4:4:4 / 4:2:2 /
    // High 10 streams that desktop players cannot open, and odd sizes failed.
    const args = videoArgs('mp4');
    expect(args.join(' ')).toContain('-pix_fmt yuv420p');
    expect(args.join(' ')).toContain('-vf scale=trunc(iw/2)*2:trunc(ih/2)*2');
  });
});

describe('Media Splitter input probing and output containers', () => {
  it('reads the first audio and video codec, ignoring cover art', () => {
    expect(parseInputStreams([
      "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input-1.mp4':",
      '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 320x240',
      '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, mono, fltp, 69 kb/s (default)',
      '  Stream #0:2[0x3](eng): Audio: ac3, 48000 Hz, 5.1(side), fltp, 384 kb/s',
    ])).toEqual({ audioCodec: 'aac', videoCodec: 'h264' });
    expect(parseInputStreams([
      '  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 128 kb/s',
      '  Stream #0:1: Video: mjpeg (Baseline), yuvj420p(pc), 300x300, 90k tbr, 90k tbn (attached pic)',
    ])).toEqual({ audioCodec: 'mp3', videoCodec: null });
    expect(parseInputStreams(['At least one output file must be specified']))
      .toEqual({ audioCodec: null, videoCodec: null });
  });

  it('copies audio into a container desktop players open, Matroska otherwise', () => {
    const source = AUDIO_FORMATS.find((f) => f.value === 'source');
    expect(resolveAudioOutputExt(source, 'aac')).toBe('m4a');
    expect(resolveAudioOutputExt(source, 'mp3')).toBe('mp3');
    expect(resolveAudioOutputExt(source, 'pcm_s16le')).toBe('wav');
    expect(resolveAudioOutputExt(source, 'ac3')).toBe(FALLBACK_AUDIO_EXT);
    expect(resolveAudioOutputExt(AUDIO_FORMATS.find((f) => f.value === 'ogg'), 'aac')).toBe('ogg');
  });

  it('reuses the source container for a video copy only when FFmpeg can write it', () => {
    // ".qt", ".divx", and extensionless names have no muxer: the copy used to
    // fail, or the download got the source name's non-extension.
    const source = VIDEO_FORMATS.find((f) => f.value === 'source');
    expect(resolveVideoOutputExt(source, 'mov')).toBe('mov');
    expect(resolveVideoOutputExt(source, 'qt')).toBe(FALLBACK_VIDEO_EXT);
    expect(resolveVideoOutputExt(source, 'divx')).toBe(FALLBACK_VIDEO_EXT);
    expect(resolveVideoOutputExt(source, '')).toBe(FALLBACK_VIDEO_EXT);
    expect(resolveVideoOutputExt(VIDEO_FORMATS.find((f) => f.value === 'mp4'), 'qt')).toBe('mp4');
  });

  it('labels every container the splitter can write with its MIME type', () => {
    expect(guessMime('m4v', 'video')).toBe('video/mp4');
    expect(guessMime('ts', 'video')).toBe('video/mp2t');
    expect(guessMime('flac', 'audio')).toBe('audio/flac');
    expect(guessMime('opus', 'audio')).toBe('audio/ogg');
  });
});
