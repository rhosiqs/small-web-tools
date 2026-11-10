import { File as NodeFile } from 'node:buffer';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A Worker-like stand-in for @ffmpeg/ffmpeg that models the pinned core's
// behaviour observed with the real 0.12.6 wasm: every call settles on a later
// task, `-i` without an output only logs the input streams, a missing stream
// an unknown output container or a codec the container rejects exits
// non-zero, and libvpx-vp9 traps.
// Each input file's text is a JSON description of its streams.
const runtime = vi.hoisted(() => ({ instances: [] }));
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const KNOWN_MUXERS = new Set(['mp4', 'mov', 'mkv', 'mka', 'm4a', 'mp3', 'wav', 'ogg', 'opus', 'flac', 'webm']);

class FakeFFmpeg {
  constructor() {
    this.loaded = false;
    this.poisoned = false;
    this.files = new Map();
    this.listeners = { log: new Set(), progress: new Set() };
    this.commands = [];
    runtime.instances.push(this);
  }

  on(event, handler) { this.listeners[event].add(handler); }

  off(event, handler) { this.listeners[event].delete(handler); }

  log(message) { for (const handler of this.listeners.log) handler({ type: 'stderr', message }); }

  async load() { await tick(); this.loaded = true; return true; }

  async writeFile(name, data) { await tick(); this.files.set(name, new Uint8Array(data)); return true; }

  async readFile(name) {
    await tick();
    if (!this.files.has(name)) throw new Error('ENOENT');
    return this.files.get(name);
  }

  async deleteFile(name) { await tick(); if (!this.files.delete(name)) throw new Error('ENOENT'); return true; }

  async exec(args) {
    await tick();
    this.commands.push(args);
    if (this.poisoned) throw new RuntimeError('memory access out of bounds');
    const input = JSON.parse(new TextDecoder().decode(this.files.get(args[args.indexOf('-i') + 1])));
    const streamLines = [
      input.video && `  Stream #0:0: Video: ${input.video}, yuv420p, 320x240`,
      input.audio && `  Stream #0:1: Audio: ${input.audio}, 48000 Hz, stereo`,
    ].filter(Boolean);
    streamLines.forEach((line) => this.log(line));
    const output = args.at(-1);
    if (output === args[args.indexOf('-i') + 1]) {
      this.log('At least one output file must be specified');
      return 1;
    }
    if (args.includes('libvpx-vp9') || input.trap) {
      this.poisoned = true;
      throw new RuntimeError('memory access out of bounds');
    }
    const ext = output.split('.').pop();
    if (!KNOWN_MUXERS.has(ext)) {
      this.log(`Unable to find a suitable output format for '${output}'`);
      return 1;
    }
    const wantsAudio = args.includes('-vn');
    if (ext === 'webm' && !wantsAudio && args.includes('copy') && !['vp8', 'vp9', 'av1'].includes(input.video)) {
      this.log('Only VP8 or VP9 or AV1 video and Vorbis or Opus audio and WebVTT subtitles are supported for WebM.');
      return 1;
    }
    if ((wantsAudio && !input.audio) || (!wantsAudio && !input.video)) {
      this.log(`Output file #0 does not contain any stream`);
      return 1;
    }
    this.files.set(output, new TextEncoder().encode(`${ext} payload`));
    return 0;
  }

  terminate() { this.loaded = false; this.terminated = true; }
}

class RuntimeError extends Error {}

vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: FakeFFmpeg }));

const { useMediaSeparator } = await import('../components/useMediaSeparator.js');
const { default: MediaSeparatorQueueItem } = await import('../components/MediaSeparatorQueueItem.jsx');
const { terminateFFmpeg } = await import('../components/mediaSeparatorEngine.js');

let container;
let root;
let api;

function Probe() {
  api = useMediaSeparator();
  return null;
}

// jsdom's File has no arrayBuffer(); browsers and Node's File do.
function mediaFile(name, streams) {
  return new NodeFile([JSON.stringify(streams)], name);
}

async function runFiles(files, formats = []) {
  act(() => { api.addFiles(files); });
  const ids = api.items.map((item) => item.id);
  act(() => {
    ids.forEach((id, index) => {
      const [audio = 'source', video = 'source'] = formats[index] || [];
      api.setAudioFormat(id, audio);
      api.setVideoFormat(id, video);
    });
  });
  // The queue reads React state between items, so it runs outside act() with
  // real scheduling, as it does in the browser.
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await api.runQueue();
  await tick();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return api.items;
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  runtime.instances.length = 0;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1]))));
  URL.createObjectURL = vi.fn(() => 'blob:media-test');
  URL.revokeObjectURL = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Probe />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  terminateFFmpeg();
  vi.unstubAllGlobals();
});

// The pinned asset hashes cannot match the stub bytes, so verify nothing here.
vi.mock('../../config/ffmpeg-assets.json', () => ({
  default: {
    assets: {
      core: { url: 'https://unpkg.com/core.js', contentType: 'text/javascript', bytes: 1, sha256: '4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a' },
      wasm: { url: 'https://unpkg.com/core.wasm', contentType: 'application/wasm', bytes: 1, sha256: '4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a' },
    },
  },
}));

describe('Media Splitter queue conversions', () => {
  it('finishes a WebM conversion instead of running the trapping VP9 encoder', async () => {
    const [item] = await runFiles([mediaFile('clip.mp4', { video: 'h264', audio: 'aac' })], [['wav', 'webm']]);
    expect(item.status).toBe('done');
    expect(item.videoExt).toBe('webm');
    expect(item.videoBlob.type).toBe('video/webm');
  });

  it('keeps processing the queue on a fresh runtime after a WebAssembly trap', async () => {
    const items = await runFiles([
      mediaFile('broken.mp4', { video: 'h264', audio: 'aac', trap: true }),
      mediaFile('next.mp4', { video: 'h264', audio: 'aac' }),
    ]);
    expect(items.map((item) => item.status)).toEqual(['error', 'done']);
    expect(runtime.instances[0].terminated).toBe(true);
  });

  it('extracts only the video from a file without an audio track', async () => {
    const [item] = await runFiles([mediaFile('screen.mp4', { video: 'h264' })]);
    expect(item.status).toBe('done');
    expect(item.audioBlob).toBeNull();
    expect(item.videoExt).toBe('mp4');
  });

  it('extracts only the audio from a file without a video track', async () => {
    const [item] = await runFiles([mediaFile('voice.mp3', { audio: 'mp3' })], [['source', 'mp4']]);
    expect(item.status).toBe('done');
    expect(item.videoBlob).toBeNull();
    expect(item.audioExt).toBe('mp3');
    expect(item.audioBlob.type).toBe('audio/mpeg');
  });

  it('copies tracks from a container FFmpeg cannot write into files that open elsewhere', async () => {
    const [qt, bare] = await runFiles([
      mediaFile('clip.qt', { video: 'h264', audio: 'aac' }),
      mediaFile('clip', { video: 'h264', audio: 'aac' }),
    ]);
    expect([qt.status, bare.status]).toEqual(['done', 'done']);
    expect([qt.audioExt, qt.videoExt]).toEqual(['m4a', 'mkv']);
    expect([bare.audioExt, bare.videoExt]).toEqual(['m4a', 'mkv']);
  });

  it('does not pick a failed item again when it failed before React re-rendered', async () => {
    // A file read that rejects without yielding a task used to leave the
    // un-rendered queue snapshot showing the item as ready, so the loop retried
    // it forever and froze the tab. Stop after three reads to keep the old
    // behaviour observable instead of hanging the test run.
    const unreadable = mediaFile('gone.mp4', { video: 'h264' });
    let reads = 0;
    unreadable.arrayBuffer = () => {
      reads += 1;
      if (reads >= 3) api.stopQueue();
      return Promise.reject(new Error('NotReadableError'));
    };
    const [item] = await runFiles([unreadable]);
    expect(reads).toBe(1);
    expect(item.status).toBe('error');
  });

  it('falls back to Matroska when the source container rejects the copied codec', async () => {
    // e.g. an H.264 MediaRecorder file saved as .webm: the WebM muxer refuses H.264.
    const [item] = await runFiles([mediaFile('rec.webm', { video: 'h264', audio: 'opus' })]);
    expect(item.status).toBe('done');
    expect(item.videoExt).toBe('mkv');
  });
});

describe('Media Splitter queue item downloads', () => {
  function renderItem(item) {
    act(() => {
      root.render(
        <MediaSeparatorQueueItem
          item={item}
          onAudioFormatChange={() => {}}
          onVideoFormatChange={() => {}}
          onRemove={() => {}}
          onRetry={() => {}}
        />,
      );
    });
    return [...container.querySelectorAll('a[download]')].map((link) => link.getAttribute('download'));
  }

  const doneItem = {
    id: 'item-1',
    status: 'done',
    progress: 100,
    audioFormat: 'source',
    videoFormat: 'source',
    audioURL: 'blob:audio',
    videoURL: 'blob:video',
  };

  it('names downloads with the extension of the container actually written', () => {
    const names = renderItem({ ...doneItem, file: new File(['x'], 'clip'), audioExt: 'm4a', videoExt: 'mkv' });
    expect(names).toEqual(['clip-audio.m4a', 'clip-video.mkv']);
  });

  it('offers no audio download for a file without an audio track', () => {
    const names = renderItem({
      ...doneItem,
      file: new File(['x'], 'screen.mp4'),
      audioURL: null,
      audioExt: null,
      videoExt: 'mp4',
    });
    expect(names).toEqual(['screen-video.mp4']);
    expect(container.textContent).toContain('This file has no audio track');
  });
});
