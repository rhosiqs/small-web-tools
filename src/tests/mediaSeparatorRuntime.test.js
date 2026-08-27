import { afterEach, describe, expect, it, vi } from 'vitest';

// `@ffmpeg/ffmpeg` resolves to a stub that refuses to construct outside a
// browser, so the runtime lifecycle is exercised against a minimal fake.
class FakeFFmpeg {
  constructor() {
    this.loaded = false;
    this.listeners = new Map();
  }

  on(event, handler) {
    const existing = this.listeners.get(event) || [];
    this.listeners.set(event, [...existing, handler]);
  }

  emit(event, payload) {
    for (const handler of this.listeners.get(event) || []) handler(payload);
  }

  async load() {
    throw new Error('runtime unavailable');
  }

  terminate() {}
}

vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: FakeFFmpeg }));

const { ensureFFmpegLoaded, getFFmpeg, terminateFFmpeg } = await import(
  '../components/mediaSeparatorEngine.js'
);

describe('FFmpeg runtime lifecycle', () => {
  afterEach(() => {
    terminateFFmpeg();
    vi.unstubAllGlobals();
  });

  const failingFetch = () => vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 502 })),
  );

  it('keeps a single log listener across repeated failed loads', async () => {
    failingFetch();
    const ffmpeg = getFFmpeg();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(ensureFFmpegLoaded(() => {})).rejects.toThrow('could not be loaded');
    }

    expect(ffmpeg.listeners.get('log')).toHaveLength(1);
  });

  it('delivers each log line once, to the current callback only', async () => {
    failingFetch();
    const ffmpeg = getFFmpeg();
    const stale = vi.fn();
    const current = vi.fn();

    await expect(ensureFFmpegLoaded(stale)).rejects.toThrow();
    await expect(ensureFFmpegLoaded(current)).rejects.toThrow();
    ffmpeg.emit('log', { message: 'frame=1' });

    expect(stale).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
    expect(current).toHaveBeenCalledWith('frame=1');
  });

  it('detaches the log sink once the runtime is terminated', () => {
    const ffmpeg = getFFmpeg();
    terminateFFmpeg();
    ffmpeg.emit('log', { message: 'ignored' });
    expect(getFFmpeg()).not.toBe(ffmpeg);
  });
});
