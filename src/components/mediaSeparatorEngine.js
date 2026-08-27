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
    buildArgs: () => ['-an', '-vcodec', 'libx264', '-preset', 'veryfast', '-crf', '23'],
  },
  {
    value: 'webm',
    label: 'WebM (VP9 Re-encode)',
    outputExt: 'webm',
    buildArgs: () => ['-an', '-vcodec', 'libvpx-vp9', '-crf', '32', '-b:v', '0'],
  },
];

export function getExt(filename) {
  const match = /\.([a-zA-Z0-9]+)$/u.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

const MIME_MAP = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  mka: 'audio/x-matroska',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
};

export function guessMime(ext, kind) {
  return MIME_MAP[ext] || (kind === 'audio' ? 'audio/octet-stream' : 'video/octet-stream');
}
