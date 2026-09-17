import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const BAR_COUNT = 240;

/**
 * Displays audio waveform with play/pause controls and a seekable timeline.
 * Uses currentColor/rgba(128, 128, 128, 0.5) to inherit colors from the design system.
 */
export default function MediaSeparatorWaveform({ audioURL, className }) {
  const { t } = useTranslation('tools');
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const [peaks, setPeaks] = useState(null); // null = analyzing, [] = decode failed
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    setProgress(0);
    setIsPlaying(false);

    async function decode() {
      try {
        const res = await fetch(audioURL);
        const arrayBuffer = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          if (cancelled) return;
          setDuration(audioBuffer.duration);
          setPeaks(computePeaks(audioBuffer, BAR_COUNT));
        } finally {
          ctx.close();
        }
      } catch {
        if (!cancelled) setPeaks([]);
      }
    }
    decode();
    return () => {
      cancelled = true;
    };
  }, [audioURL]);

  useEffect(() => {
    if (peaks && peaks.length) {
      draw(canvasRef.current, peaks, progress);
    }
  }, [peaks, progress]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio && duration > 0) {
      setProgress(audio.currentTime / duration);
    }
    if (audio && !audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
    }
  }, [duration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [tick]);

  const seekTo = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas || !audio || !duration) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setProgress(ratio);
    },
    [duration],
  );

  return (
    <div className={className}>
      <audio ref={audioRef} src={audioURL} onEnded={() => setIsPlaying(false)} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!peaks || !peaks.length}
          title={t(isPlaying ? 'tool-mediasplit.ui.pause' : 'tool-mediasplit.ui.play')}
          className="bg-accent-fill text-accent-on-fill border-none rounded-full w-8 h-8 inline-flex items-center justify-center cursor-pointer transition-colors duration-200 flex-shrink-0 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '1px' }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <canvas
          ref={canvasRef}
          width={1000}
          height={80}
          onClick={seekTo}
          className="h-12 flex-1 bg-transparent text-accent min-w-0"
          style={{ cursor: peaks && peaks.length ? 'pointer' : 'default' }}
        />
        <span className="font-mono text-xs text-text-muted whitespace-nowrap">
          {formatTime(duration * progress)} / {formatTime(duration)}
        </span>
      </div>
      {peaks === null && <p className="mt-1.5 text-xs text-text-muted italic">{t('tool-mediasplit.ui.analyzingWaveform')}</p>}
      {peaks && peaks.length === 0 && (
        <p className="mt-1.5 text-xs text-text-muted italic">{t('tool-mediasplit.ui.waveformUnavailable')}</p>
      )}
    </div>
  );
}

function computePeaks(audioBuffer, bucketCount) {
  const channelData = audioBuffer.getChannelData(0);
  const bucketSize = Math.floor(channelData.length / bucketCount) || 1;
  const peaks = [];
  for (let i = 0; i < bucketCount; i += 1) {
    let min = 1.0;
    let max = -1.0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, channelData.length);
    for (let j = start; j < end; j += 1) {
      const v = channelData[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (end > start) {
      peaks.push([min, max]);
    } else {
      peaks.push([0, 0]);
    }
  }

  // Normalize peaks so the loudest peak is 1.0 (or close to it)
  // This makes quiet audio track peaks show up clearly instead of looking flat.
  let maxVal = 0.01;
  for (let i = 0; i < peaks.length; i++) {
    const absVal = Math.max(Math.abs(peaks[i][0]), Math.abs(peaks[i][1]));
    if (absVal > maxVal) {
      maxVal = absVal;
    }
  }
  return peaks.map(([min, max]) => [min / maxVal, max / maxVal]);
}

function draw(canvas, peaks, progress) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const barWidth = width / peaks.length;
  const midY = height / 2;
  const playheadX = progress * width;

  peaks.forEach(([min, max], i) => {
    const x = i * barWidth;
    const barHeight = Math.max(1, (max - min) * midY);
    ctx.fillStyle = x <= playheadX ? 'currentColor' : 'rgba(128, 128, 128, 0.5)';
    ctx.fillRect(x, midY - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
  });
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}
