import { createEphemeralId } from '../../../lib/ephemeralId';
import { ensureFFmpegLoaded, guessMime, terminateFFmpeg } from '../../mediaSeparatorEngine';
import { getAudioExtension } from './videoMetadata';

function createAbortError() {
  return new DOMException('Audio extraction was cancelled.', 'AbortError');
}

function throwIfCancelled(signal, disposed) {
  if (disposed || signal?.aborted) throw createAbortError();
}

function safeExtension(value, fallback) {
  return /^[a-z0-9]+$/iu.test(value || '') ? value.toLowerCase() : fallback;
}

export class VideoAudioExtractionService {
  constructor({
    ensureLoaded = ensureFFmpegLoaded,
    mimeFor = guessMime,
    terminate = terminateFFmpeg,
  } = {}) {
    this.ensureLoaded = ensureLoaded;
    this.mimeFor = mimeFor;
    this.terminateEngine = terminate;
    this.disposed = false;
    this.queue = /** @type {Promise<unknown>} */ (Promise.resolve());
  }

  /**
   * @param {File} file
   * @param {number} trackIndex
   * @param {{ codecFourCC?: string, codec?: string }} trackInfo
   * @param {{ onProgress?: (percent: number) => void, signal?: AbortSignal }} [options]
   */
  extract(file, trackIndex, trackInfo, options = {}) {
    const operation = this.queue.then(() => this.runExtraction(file, trackIndex, trackInfo, options));
    this.queue = operation.catch(() => {});
    return operation;
  }

  /**
   * @param {File} file
   * @param {number} trackIndex
   * @param {{ codecFourCC?: string, codec?: string }} trackInfo
   * @param {{ onProgress?: (percent: number) => void, signal?: AbortSignal }} [options]
   */
  async runExtraction(file, trackIndex, trackInfo, { onProgress, signal } = {}) {
    throwIfCancelled(signal, this.disposed);
    const ffmpeg = await this.ensureLoaded();
    throwIfCancelled(signal, this.disposed);

    const operationId = createEphemeralId('video-audio').replace(/[^a-z0-9-]/giu, '');
    const sourceExt = safeExtension(file.name.split('.').pop(), 'mp4');
    const outputExt = safeExtension(getAudioExtension(trackInfo.codecFourCC, trackInfo.codec), 'mka');
    const inputName = `input-${operationId}.${sourceExt}`;
    const outputName = `audio-${operationId}.${outputExt}`;
    let progressListener = null;

    try {
      const fileBuffer = new Uint8Array(await file.arrayBuffer());
      throwIfCancelled(signal, this.disposed);
      await ffmpeg.writeFile(inputName, fileBuffer);

      if (onProgress) {
        progressListener = ({ progress }) => {
          const clamped = Math.min(1, Math.max(0, progress || 0));
          onProgress(Math.round(clamped * 100));
        };
        ffmpeg.on('progress', progressListener);
      }

      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-map', `0:a:${trackIndex}`,
        '-c:a', 'copy',
        outputName,
      ]);
      throwIfCancelled(signal, this.disposed);
      if (exitCode !== 0) throw new Error('FFmpeg execution failed');

      const audioData = await ffmpeg.readFile(outputName);
      throwIfCancelled(signal, this.disposed);
      return {
        blob: new Blob([audioData], { type: this.mimeFor(outputExt, 'audio') }),
        extension: outputExt,
      };
    } finally {
      if (progressListener) ffmpeg.off('progress', progressListener);
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {
        // A cancelled or failed operation may not have written the input.
      }
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // Unsupported tracks may not produce an output.
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.terminateEngine();
  }
}

export function createVideoAudioExtractionService(dependencies) {
  return new VideoAudioExtractionService(dependencies);
}
