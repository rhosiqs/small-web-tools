import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MediaSeparatorFormatSelect from './MediaSeparatorFormatSelect';
import MediaSeparatorWaveform from './MediaSeparatorWaveform';
import { AUDIO_FORMATS, VIDEO_FORMATS } from './mediaSeparatorEngine';

export default function MediaSeparatorQueueItem({ item, onAudioFormatChange, onVideoFormatChange, onRemove, onRetry }) {
  const { t, i18n } = useTranslation(['tools', 'errors']);
  // For raw video preview playback (native browser decoding, unrelated to ffmpeg processing)
  const [sourcePreviewURL, setSourcePreviewURL] = useState('');

  useEffect(() => {
    if (!item.file) return undefined;
    const url = URL.createObjectURL(item.file);
    setSourcePreviewURL(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [item.file]);

  const isBusy = item.status === 'processing';
  const canEdit = item.status === 'ready' || item.status === 'error';

  return (
    <li className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5 shadow-card relative">
      {/* Top right actions & status */}
      <div className="absolute top-5 right-5 flex items-center gap-3">
        {item.status === 'ready' && (
          <span className="inline-flex items-center px-2.5 py-1 text-[0.725rem] font-bold rounded-full uppercase tracking-[0.05em] leading-none bg-app text-text-muted border border-border">
            {t('tools:tool-mediasplit.ui.ready')}
          </span>
        )}
        {isBusy && (
          <span className="inline-flex items-center px-2.5 py-1 text-[0.725rem] font-bold rounded-full uppercase tracking-[0.05em] leading-none bg-accent/10 text-accent border border-accent/20 animate-[mediasplit-pulse_2.5s_infinite]">
            {t('tools:tool-mediasplit.ui.processing', { progress: item.progress })}
          </span>
        )}
        {item.status === 'done' && (
          <span className="inline-flex items-center px-2.5 py-1 text-[0.725rem] font-bold rounded-full uppercase tracking-[0.05em] leading-none bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.2)]">
            {t('tools:tool-mediasplit.ui.done')}
          </span>
        )}
        {item.status === 'error' && (
          <span className="inline-flex items-center px-2.5 py-1 text-[0.725rem] font-bold rounded-full uppercase tracking-[0.05em] leading-none bg-red-50 text-red-500 border border-red-200">
            {t('tools:tool-mediasplit.ui.error')}
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={isBusy}
          className="inline-flex items-center justify-center px-3 py-1.5 text-[0.8rem] font-semibold rounded-md border border-transparent cursor-pointer bg-transparent text-text-muted transition-all duration-150 hover:enabled:bg-red-50 hover:enabled:text-red-500 disabled:text-text-muted disabled:cursor-not-allowed"
        >
          {t('tools:tool-mediasplit.ui.remove')}
        </button>
      </div>

      <div className="flex items-center gap-4 pr-[180px]">
        <video
          src={sourcePreviewURL}
          controls
          muted
          className="w-32 h-[4.5rem] rounded-md object-cover bg-app border border-border"
        />
        <div className="flex-1 min-w-0">
          <p className="m-0 mb-1 text-[0.95rem] font-semibold text-text-main overflow-hidden text-ellipsis whitespace-nowrap">
            {item.file.name}
          </p>
          <p className="m-0 text-[0.8rem] text-text-muted">
            {formatBytes(item.file.size, i18n.language)}
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-wrap p-4 bg-app rounded-lg">
        <MediaSeparatorFormatSelect
          label={t('tools:tool-mediasplit.ui.audioFormat')}
          value={item.audioFormat}
          options={AUDIO_FORMATS}
          onChange={(v) => onAudioFormatChange(item.id, v)}
          disabled={!canEdit}
        />
        <MediaSeparatorFormatSelect
          label={t('tools:tool-mediasplit.ui.videoFormat')}
          value={item.videoFormat}
          options={VIDEO_FORMATS}
          onChange={(v) => onVideoFormatChange(item.id, v)}
          disabled={!canEdit}
        />
      </div>

      {isBusy && (
        <div className="flex items-center gap-3">
          <progress
            value={item.progress}
            max={100}
            className="flex-1 h-2 rounded overflow-hidden border-none [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
          />
        </div>
      )}

      {item.status === 'error' && (
        <div className="flex items-center gap-3 text-red-500 bg-red-50/50 px-3 py-2 rounded-md border border-red-100">
          <span>{t('tools:tool-mediasplit.ui.errorMessage', {
            message: item.errorCode ? t('errors:processingFailed') : item.error,
          })}</span>
          {import.meta.env.DEV && item.developmentDetail && (
            <details className="text-xs">
              <summary>{t('tools:tool-mediasplit.ui.developmentDetails')}</summary>
              <pre className="whitespace-pre-wrap">{item.developmentDetail}</pre>
            </details>
          )}
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-semibold rounded-lg border border-border cursor-pointer bg-card text-text-main transition-all duration-150 hover:bg-app hover:border-border-hover"
          >
            {t('tools:tool-mediasplit.ui.retry')}
          </button>
        </div>
      )}

      {item.status === 'done' && (
        <div className="flex flex-col gap-6 pt-4 border-t border-dashed border-border">
          <div className="flex flex-col gap-2 w-full">
            <p className="m-0 mb-1 text-[0.85rem] font-bold text-text-main uppercase tracking-[0.05em]">{t('tools:tool-mediasplit.ui.audioTrack')}</p>
            <MediaSeparatorWaveform
              audioURL={item.audioURL}
              className="bg-app border border-border rounded-lg p-3"
            />
            <a
              href={item.audioURL}
              download={buildDownloadName(item, 'audio')}
              className="inline-flex items-center justify-center py-2 px-4 text-[0.85rem] font-semibold no-underline rounded-md bg-accent-light text-accent-hover border border-transparent transition-all duration-200 text-center hover:bg-accent-fill hover:text-accent-on-fill"
            >
              {t('tools:tool-mediasplit.ui.downloadAudio')}
            </a>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[560px] mx-auto items-center">
            <p className="m-0 mb-1 text-[0.85rem] font-bold text-text-main uppercase tracking-[0.05em]">{t('tools:tool-mediasplit.ui.silentVideo')}</p>
            <video
              src={item.videoURL}
              controls
              className="w-full h-[315px] bg-black rounded-lg border border-border object-contain shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            />
            <a
              href={item.videoURL}
              download={buildDownloadName(item, 'video')}
              className="inline-flex items-center justify-center py-2 px-4 text-[0.85rem] font-semibold no-underline rounded-md bg-accent-light text-accent-hover border border-transparent transition-all duration-200 text-center hover:bg-accent-fill hover:text-accent-on-fill w-full max-w-[240px]"
            >
              {t('tools:tool-mediasplit.ui.downloadVideo')}
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

function buildDownloadName(item, kind) {
  const base = item.file.name.replace(/\.[^.]+$/, '');
  const format =
    kind === 'audio'
      ? AUDIO_FORMATS.find((f) => f.value === item.audioFormat)
      : VIDEO_FORMATS.find((f) => f.value === item.videoFormat);
  const ext = format?.outputExt || item.file.name.split('.').pop();
  return `${base}-${kind}.${ext}`;
}

function formatBytes(bytes, locale) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}
