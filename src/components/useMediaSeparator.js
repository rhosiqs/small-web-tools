import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ensureFFmpegLoaded,
  terminateFFmpeg,
  discardFFmpeg,
  AUDIO_FORMATS,
  VIDEO_FORMATS,
  FALLBACK_AUDIO_EXT,
  FALLBACK_VIDEO_EXT,
  getExt,
  guessMime,
  parseInputStreams,
  resolveAudioOutputExt,
  resolveVideoOutputExt,
} from './mediaSeparatorEngine';
import { getMediaSeparatorPolicy, validateResourceAddition } from '../lib/resourceLimits';
import useObjectUrlRegistry from '../hooks/useObjectUrlRegistry';
import { toPublicProcessingError } from '../lib/publicErrors';

export const STATUS = {
  PENDING: 'ready', // Renamed internal value to 'ready' to improve UX before starting
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `item-${idCounter}-${Date.now()}`;
}

/**
 * Manage multi-file audio/video splitter queue.
 * Files are processed sequentially to avoid memory overload and worker conflicts.
 */
export function useMediaSeparator() {
  const {
    createObjectUrl,
    revokeObjectUrl,
    revokeAllObjectUrls,
  } = useObjectUrlRegistry();
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  
  const [engineLoading, setEngineLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState('');
  const processingRef = useRef(false);
  const stopRef = useRef(false);

  const updateItem = useCallback((id, patch) => {
    const apply = (list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it));
    // runQueue picks the next item from itemsRef. Mirror the patch there now:
    // when an item fails without yielding to React, an un-rendered ref still
    // shows it as ready and the loop would pick the same item forever.
    itemsRef.current = apply(itemsRef.current);
    setItems(apply);
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList);
    const deviceMemory = /** @type {Navigator & { deviceMemory?: number }} */ (globalThis.navigator)?.deviceMemory;
    const policy = getMediaSeparatorPolicy(deviceMemory);
    const resourceCheck = validateResourceAddition(itemsRef.current, files, policy);
    if (!resourceCheck.valid) {
      setLastError(resourceCheck.reason);
      return [];
    }
    setLastError('');
    const newItems = files.map((file) => ({
      id: nextId(),
      file,
      status: STATUS.PENDING,
      progress: 0,
      audioFormat: 'source',
      videoFormat: 'source',
      audioBlob: null,
      videoBlob: null,
      audioURL: null,
      videoURL: null,
      audioExt: null,
      videoExt: null,
      error: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
    return newItems.map((it) => it.id);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.audioURL) revokeObjectUrl(target.audioURL);
      if (target?.videoURL) revokeObjectUrl(target.videoURL);
      return prev.filter((it) => it.id !== id);
    });
  }, [revokeObjectUrl]);

  const clearDone = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => {
        if (it.status === STATUS.DONE) {
          if (it.audioURL) revokeObjectUrl(it.audioURL);
          if (it.videoURL) revokeObjectUrl(it.videoURL);
        }
      });
      return prev.filter((it) => it.status !== STATUS.DONE);
    });
  }, [revokeObjectUrl]);

  const setAudioFormat = useCallback(
    (id, value) => updateItem(id, { audioFormat: value }),
    [updateItem],
  );
  const setVideoFormat = useCallback(
    (id, value) => updateItem(id, { videoFormat: value }),
    [updateItem],
  );

  const processOne = useCallback(
    async (item) => {
      const ffmpeg = await ensureFFmpegLoaded();

      const sourceExt = getExt(item.file.name);
      const inputName = `input-${item.id}.${sourceExt || 'bin'}`;
      const fileBuffer = new Uint8Array(await item.file.arrayBuffer());
      await ffmpeg.writeFile(inputName, fileBuffer);

      const audioFormat = AUDIO_FORMATS.find((f) => f.value === item.audioFormat);
      const videoFormat = VIDEO_FORMATS.find((f) => f.value === item.videoFormat);

      // Split overall progress between audio stage (0-50%) and video stage (50-100%).
      let stage = 0;
      const onProgress = ({ progress }) => {
        const clamped = Math.min(1, Math.max(0, progress || 0));
        const overall = stage === 0 ? clamped * 50 : 50 + clamped * 50;
        updateItem(item.id, { progress: Math.min(99, Math.round(overall)) });
      };
      ffmpeg.on('progress', onProgress);

      let logs = [];
      const logCollector = ({ message }) => {
        logs.push(message);
      };
      ffmpeg.on('log', logCollector);

      const outputNames = new Set();
      // A thrown exec (a WebAssembly trap, not a non-zero exit code) can leave
      // the runtime corrupted so later queue items fail with the same trap.
      // Discard it so the next item loads a fresh runtime.
      const run = async (args) => {
        logs = [];
        try {
          return await ffmpeg.exec(args);
        } catch (err) {
          discardFFmpeg(ffmpeg);
          throw err;
        }
      };
      // Write one track; a stream copy that the preferred container rejects is
      // retried once in Matroska, which accepts virtually any codec.
      const extract = async (kind, buildArgs, preferredExt, fallbackExt) => {
        const exts = preferredExt === fallbackExt ? [preferredExt] : [preferredExt, fallbackExt];
        for (const ext of exts) {
          const outName = `${kind}-${item.id}.${ext}`;
          outputNames.add(outName);
          if ((await run(['-i', inputName, ...buildArgs(), outName])) === 0) {
            const data = await ffmpeg.readFile(outName);
            if (data.byteLength > 0) {
              const blob = new Blob([data], { type: guessMime(ext, kind) });
              return { blob, ext };
            }
          }
          await safeDelete(ffmpeg, outName);
        }
        throw new Error(`${kind} extraction failed`);
      };

      try {
        await run(['-hide_banner', '-i', inputName]);
        const { audioCodec, videoCodec } = parseInputStreams(logs);
        if (!audioCodec && !videoCodec) {
          throw new Error('No audio or video track detected');
        }

        let audio = null;
        if (audioCodec) {
          stage = 0;
          const copy = audioFormat.value === 'source';
          audio = await extract(
            'audio',
            audioFormat.buildArgs,
            resolveAudioOutputExt(audioFormat, audioCodec),
            copy ? FALLBACK_AUDIO_EXT : audioFormat.outputExt,
          );
        }

        let video = null;
        if (videoCodec) {
          stage = 1;
          const copy = videoFormat.value === 'source';
          video = await extract(
            'video',
            videoFormat.buildArgs,
            resolveVideoOutputExt(videoFormat, sourceExt),
            copy ? FALLBACK_VIDEO_EXT : videoFormat.outputExt,
          );
        }

        updateItem(item.id, {
          status: STATUS.DONE,
          progress: 100,
          audioBlob: audio?.blob || null,
          videoBlob: video?.blob || null,
          audioExt: audio?.ext || null,
          videoExt: video?.ext || null,
          audioURL: audio ? createObjectUrl(audio.blob) : null,
          videoURL: video ? createObjectUrl(video.blob) : null,
        });
      } finally {
        ffmpeg.off('progress', onProgress);
        ffmpeg.off('log', logCollector);
        await safeDelete(ffmpeg, inputName);
        for (const outName of outputNames) await safeDelete(ffmpeg, outName);
      }
    },
    [createObjectUrl, updateItem],
  );

  useEffect(() => () => {
    stopRef.current = true;
    processingRef.current = false;
    terminateFFmpeg();
    revokeAllObjectUrls();
  }, [revokeAllObjectUrls]);

  const runQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }
    processingRef.current = true;
    setIsProcessing(true);
    stopRef.current = false;
 
    try {
      setEngineLoading(true);
      await ensureFFmpegLoaded();
    } catch (err) {
      processingRef.current = false;
      setIsProcessing(false);
      setEngineLoading(false);
 
      // Report engine load failure on the first pending item
      setItems((prev) => {
        const firstPending = prev.find((it) => it.status === STATUS.PENDING);
        if (firstPending) {
          const safeError = toPublicProcessingError(err, import.meta.env.DEV);
          return prev.map((it) =>
            it.id === firstPending.id
              ? {
                  ...it,
                  status: STATUS.ERROR,
                  error: safeError.message,
                  errorCode: safeError.code,
                  developmentDetail: safeError.developmentDetail,
                }
              : it
          );
        }
        return prev;
      });
      return;
    }
    setEngineLoading(false);
 
    while (true) {
      if (stopRef.current) {
        break;
      }
 
      // Read queue item synchronously from itemsRef
      const next = itemsRef.current.find((it) => it.status === STATUS.PENDING);
 
      if (!next) {
        break;
      }
 
      // Update state of the item to processing synchronously in state
      updateItem(next.id, { status: STATUS.PROCESSING, progress: 0, error: null });
 
      try {
        await processOne(next);
      } catch (err) {
        if (stopRef.current) {
          updateItem(next.id, { status: STATUS.PENDING, progress: 0 });
        } else {
          const safeError = toPublicProcessingError(err, import.meta.env.DEV);
          updateItem(next.id, {
            status: STATUS.ERROR,
            error: safeError.message,
            errorCode: safeError.code,
            developmentDetail: safeError.developmentDetail,
          });
        }
      }
    }
 
    processingRef.current = false;
    setIsProcessing(false);
  }, [processOne, updateItem]);

  const stopQueue = useCallback(() => {
    stopRef.current = true;
    terminateFFmpeg();

    setItems((prev) =>
      prev.map((it) =>
        it.status === STATUS.PROCESSING
          ? { ...it, status: STATUS.PENDING, progress: 0 }
          : it
      )
    );

    processingRef.current = false;
    setIsProcessing(false);
  }, []);

  const retryItem = useCallback(
    (id) => {
      updateItem(id, { status: STATUS.PENDING, error: null, errorCode: null, progress: 0 });
      runQueue();
    },
    [updateItem, runQueue],
  );

  const globalProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const doneCount = items.filter((it) => it.status === STATUS.DONE).length;
    const processingItem = items.find((it) => it.status === STATUS.PROCESSING);
    const activeProgress = processingItem ? processingItem.progress : 0;
    return Math.round(((doneCount + activeProgress / 100) / items.length) * 100);
  }, [items]);

  return {
    items,
    engineLoading,
    isProcessing,
    globalProgress,
    lastError,
    addFiles,
    removeItem,
    clearDone,
    setAudioFormat,
    setVideoFormat,
    runQueue,
    stopQueue,
    retryItem,
  };
}

async function safeDelete(ffmpeg, name) {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // File not found, safe to ignore
  }
}
