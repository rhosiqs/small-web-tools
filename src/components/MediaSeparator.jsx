import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import { useMediaSeparator } from './useMediaSeparator';
import MediaSeparatorQueueItem from './MediaSeparatorQueueItem';

/**
 * Local Media Splitter Tool Component.
 * Runs client-side using ffmpeg.wasm to separate audio & silent video tracks.
 */
export default function MediaSeparator() {
  const { t, i18n } = useTranslation('tools');
  const {
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
  } = useMediaSeparator();

  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList || !fileList.length) return;
      addFiles(fileList);
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const hasPending = items.some((it) => it.status === 'ready');
  const hasDone = items.some((it) => it.status === 'done');

  return (
    <Card
      id="tool-mediasplit"
      variant="tool"
      size="wide"
      className="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <ToolHeader title={t('tool-mediasplit.title')} />

      <aside className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-relaxed text-text-main">
        {t('tool-mediasplit.ui.runtimeDisclosure')}
      </aside>

      {lastError && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {t(`tool-mediasplit.ui.resourceError.${lastError}`)}
        </p>
      )}

      {dragOver && items.length > 0 && (
        <div className="absolute inset-0 bg-accent/15 backdrop-blur-[4px] border-[2.5px] border-dashed border-accent rounded-2xl flex items-center justify-center z-[100] pointer-events-none font-semibold text-accent text-[1.2rem]">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <p>{t('tool-mediasplit.ui.dropToQueue')}</p>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-[14px] py-10 px-5 text-center cursor-pointer transition-all duration-300 flex justify-center items-center bg-accent/[0.02] ${dragOver ? 'border-accent bg-accent/[0.06]' : 'border-border hover:border-accent hover:bg-accent/[0.06]'}`}
          onClick={() => inputRef.current?.click()}
          role="group"
          aria-label={t('tool-mediasplit.ui.uploadAria')}
        >
          <div className="flex flex-col items-center">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`mb-4 transition-colors duration-300 ${dragOver ? 'text-accent' : 'text-text-muted'}`}
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <p className="text-[1.1rem] font-semibold text-text-main m-0 mb-2">{t('tool-mediasplit.ui.dropHere')}</p>
            <p className="text-[0.88rem] text-text-muted m-0 mb-3 uppercase tracking-[0.05em]">{t('tool-mediasplit.ui.or')}</p>
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>{t('tool-mediasplit.ui.browse')}</Button>
            <p className="text-[0.8rem] text-text-muted mt-3 m-0">{t('tool-mediasplit.ui.supportedFormats')}</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 flex-wrap pb-3 border-b border-border">
            {isProcessing ? (
              <button
                type="button"
                onClick={stopQueue}
                className="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-semibold rounded-lg border border-red-400 cursor-pointer bg-card text-red-500 transition-all duration-150 hover:bg-red-50 hover:border-red-500"
              >
                {t('tool-mediasplit.ui.stop')}
              </button>
            ) : (
              <button
                type="button"
                onClick={runQueue}
                disabled={!hasPending && !engineLoading}
                className="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-semibold rounded-lg border border-transparent cursor-pointer bg-accent text-white transition-colors duration-150 hover:enabled:bg-accent-hover disabled:bg-border disabled:text-text-muted disabled:cursor-not-allowed"
              >
                {t(engineLoading ? 'tool-mediasplit.ui.loadingEngine' : 'tool-mediasplit.ui.startQueue')}
              </button>
            )}
            {hasDone && !isProcessing && (
              <button
                type="button"
                onClick={clearDone}
                className="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-semibold rounded-lg border border-border cursor-pointer bg-card text-text-main transition-all duration-150 hover:bg-app hover:border-border-hover"
              >
                {t('tool-mediasplit.ui.clearCompleted')}
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center justify-center px-4 py-2 text-[0.875rem] font-semibold rounded-lg border border-border cursor-pointer bg-card text-text-main transition-all duration-150 hover:bg-app hover:border-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('tool-mediasplit.ui.addFiles')}
            </button>
            <span className="ml-auto text-[0.85rem] font-medium text-text-muted">
              {t('tool-mediasplit.ui.fileCount', {
                count: items.length,
                formattedCount: items.length.toLocaleString(i18n.language),
              })}
            </span>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 bg-app border border-border px-4 py-3 rounded-lg text-[0.9rem] text-text-main">
              <progress
                value={globalProgress}
                max={100}
                className="flex-1 h-2.5 rounded overflow-hidden border-none [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
              />
              <span>{t('tool-mediasplit.ui.overallProgress', { progress: globalProgress })}</span>
            </div>
          )}

          <ul className="list-none m-0 p-0 flex flex-col gap-5">
            {items.map((item) => (
              <MediaSeparatorQueueItem
                key={item.id}
                item={item}
                onAudioFormatChange={setAudioFormat}
                onVideoFormatChange={setVideoFormat}
                onRemove={removeItem}
                onRetry={retryItem}
              />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
