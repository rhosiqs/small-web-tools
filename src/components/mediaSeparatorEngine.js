import { FFmpeg } from '@ffmpeg/ffmpeg';
import ffmpegManifest from '../../config/ffmpeg-assets.json';

let ffmpegInstance = null;
let loadingPromise = null;
let logSink = null;
const runtimeBlobUrls = new Set();

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createVerifiedAssetUrl(asset, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const digestImpl = options.digestImpl || ((algorithm, bytes) => crypto.subtle.digest(algorithm, bytes));
  const createObjectURL = options.createObjectURL || URL.createObjectURL;
  const response = await fetchImpl(asset.url, {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('FFmpeg runtime download failed');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) throw new Error('FFmpeg runtime integrity check failed');
  const actualHash = bytesToHex(await digestImpl('SHA-256', bytes));
  if (actualHash !== asset.sha256) throw new Error('FFmpeg runtime integrity check failed');
  return createObjectURL(new Blob([bytes], { type: asset.contentType }));
}

export function getFFmpeg() {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    // Registered once per instance. Attaching inside the load path would add a
    // duplicate listener on every retry after a failed load, so log lines would
    // be emitted repeatedly and stale callbacks retained.
    ffmpegInstance.on('log', ({ message }) => {
      if (logSink) logSink(message);
    });
  }
  return ffmpegInstance;
}

/**
 * Download and verify the pinned FFmpeg runtime on the first processing action.
 * Media bytes are written only to FFmpeg's in-browser virtual filesystem.
 */
export async function ensureFFmpegLoaded(onLog) {
  const ffmpeg = getFFmpeg();
  logSink = onLog || null;
  if (ffmpeg.loaded) return ffmpeg;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      let coreURL;
      let wasmURL;
      try {
        [coreURL, wasmURL] = await Promise.all([
          createVerifiedAssetUrl(ffmpegManifest.assets.core),
          createVerifiedAssetUrl(ffmpegManifest.assets.wasm),
        ]);
        runtimeBlobUrls.add(coreURL);
        runtimeBlobUrls.add(wasmURL);
        await ffmpeg.load({ coreURL, wasmURL });
        return ffmpeg;
      } catch {
        if (coreURL) URL.revokeObjectURL(coreURL);
        if (wasmURL) URL.revokeObjectURL(wasmURL);
        runtimeBlobUrls.delete(coreURL);
        runtimeBlobUrls.delete(wasmURL);
        loadingPromise = null;
        throw new Error('The verified FFmpeg runtime could not be loaded.');
      }
    })();
  }

  return loadingPromise;
}

export function terminateFFmpeg() {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      // Termination is best-effort; all retained asset URLs are still revoked below.
    }
  }
  for (const url of runtimeBlobUrls) URL.revokeObjectURL(url);
  runtimeBlobUrls.clear();
  ffmpegInstance = null;
  loadingPromise = null;
  logSink = null;
}

/**
 * Terminate `instance` if it is still the shared runtime. Used after a
 * WebAssembly trap, which leaves the runtime unusable for later commands. A
 * stale instance (already replaced after a stop) is left alone so the current
 * runtime is not torn down.
 * @param {unknown} instance
 */
export function discardFFmpeg(instance) {
  if (instance && instance === ffmpegInstance) terminateFFmpeg();
}

export const AUDIO_FORMATS = [
  {
    value: 'source',
    label: 'Keep Original Codec (Lossless, Fastest)',
    outputExt: 'mka',
    buildArgs: () => ['-vn', '-acodec', 'copy'],
  },
  {
    value: 'mp3',
    label: 'MP3',
    outputExt: 'mp3',
    buildArgs: () => ['-vn', '-acodec', 'libmp3lame', '-q:a', '2'],
  },
  {
    value: 'wav',
    label: 'WAV (Uncompressed)',
    outputExt: 'wav',
    buildArgs: () => ['-vn', '-acodec', 'pcm_s16le'],
  },
  {
    value: 'aac',
    label: 'AAC / M4A',
    outputExt: 'm4a',
    buildArgs: () => ['-vn', '-acodec', 'aac', '-b:a', '192k'],
  },
  {
    value: 'ogg',
    label: 'OGG Vorbis',
    outputExt: 'ogg',
    buildArgs: () => ['-vn', '-acodec', 'libvorbis', '-q:a', '5'],
  },
];

export const VIDEO_FORMATS = [
  {
    value: 'source',
    label: 'Keep Original Codec (Lossless, Fastest)',
    outputExt: null,
    buildArgs: () => ['-an', '-vcodec', 'copy'],
  },
  {
    value: 'mp4',
    label: 'MP4 (H.264 Re-encode)',
    outputExt: 'mp4',
    // Without an explicit 8-bit 4:2:0 pixel format, libx264 keeps the source
    // chroma/bit depth and writes High 4:4:4, 4:2:2, or High 10 streams that
    // QuickTime, Windows, and most browsers refuse to play. 4:2:0 also needs
    // even dimensions, so odd-sized sources are trimmed by one pixel.
    buildArgs: () => [
      '-an', '-vcodec', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    ],
  },
  {
    value: 'webm',
    label: 'WebM (VP8 Re-encode)',
    outputExt: 'webm',
    // libvpx-vp9 in the pinned single-thread core traps with "memory access out
    // of bounds" after a few frames, so WebM output uses VP8 (libvpx) instead.
    buildArgs: () => ['-an', '-vcodec', 'libvpx', '-crf', '10', '-b:v', '4M'],
  },
];

/** Matroska accepts virtually any codec, so it is the safe container for stream copies. */
export const FALLBACK_AUDIO_EXT = 'mka';
export const FALLBACK_VIDEO_EXT = 'mkv';

// Containers that common desktop players open natively, keyed by the copied codec.
const AUDIO_COPY_CONTAINERS = {
  aac: 'm4a',
  alac: 'm4a',
  mp3: 'mp3',
  flac: 'flac',
  vorbis: 'ogg',
  opus: 'opus',
  pcm_s16le: 'wav',
  pcm_s24le: 'wav',
  pcm_s32le: 'wav',
  pcm_f32le: 'wav',
  pcm_u8: 'wav',
};

// Source extensions FFmpeg can also write as an output container. Anything else
// (".qt", ".divx", no extension, ...) has no muxer, so the copy goes to Matroska.
const VIDEO_COPY_CONTAINERS = new Set([
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'ts', 'mts', 'm2ts', 'mpg', 'mpeg',
  'flv', 'ogv', '3gp', '3g2', 'wmv', 'asf',
]);

/**
 * Read the first audio and video codec from the log of `ffmpeg -i <input>`.
 * Embedded cover art (`attached pic`) is not a video track.
 * @param {string[]} logLines
 * @returns {{ audioCodec: string | null, videoCodec: string | null }}
 */
export function parseInputStreams(logLines) {
  let audioCodec = null;
  let videoCodec = null;
  for (const line of logLines) {
    const match = /^\s*Stream #\d+:\d+.*?: (Audio|Video): ([A-Za-z0-9_]+)/u.exec(line);
    if (!match) continue;
    if (match[1] === 'Audio' && !audioCodec) audioCodec = match[2];
    if (match[1] === 'Video' && !videoCodec && !line.includes('(attached pic)')) videoCodec = match[2];
  }
  return { audioCodec, videoCodec };
}

/**
 * Output extension for the audio track. A stream copy goes into the codec's own
 * container when one exists so the file opens outside the browser.
 * @param {{ value: string, outputExt: string | null }} format
 * @param {string | null} audioCodec
 */
export function resolveAudioOutputExt(format, audioCodec) {
  if (format.value !== 'source') return format.outputExt;
  return AUDIO_COPY_CONTAINERS[audioCodec] || FALLBACK_AUDIO_EXT;
}

/**
 * Output extension for the video track. A stream copy reuses the source
 * container only when FFmpeg can write it.
 * @param {{ outputExt: string | null }} format
 * @param {string} sourceExt
 */
export function resolveVideoOutputExt(format, sourceExt) {
  if (format.outputExt) return format.outputExt;
  return VIDEO_COPY_CONTAINERS.has(sourceExt) ? sourceExt : FALLBACK_VIDEO_EXT;
}

export function getExt(filename) {
  const match = /\.([a-zA-Z0-9]+)$/u.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

const MIME_MAP = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  mka: 'audio/x-matroska',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  ts: 'video/mp2t',
  mts: 'video/mp2t',
  m2ts: 'video/mp2t',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  flv: 'video/x-flv',
  ogv: 'video/ogg',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  wmv: 'video/x-ms-wmv',
  asf: 'video/x-ms-asf',
};

export function guessMime(ext, kind) {
  return MIME_MAP[ext] || (kind === 'audio' ? 'audio/octet-stream' : 'video/octet-stream');
}
