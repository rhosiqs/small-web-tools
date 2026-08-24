import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { FILE_RESOURCE_POLICIES, validateResourceAddition } from '../lib/resourceLimits';
import useObjectUrlRegistry from '../hooks/useObjectUrlRegistry';
import { formatBytes, formatDuration } from '../lib/mediaMetadataFormatters.js';
import { parseAudioFile } from './AudioMeta/lib/parseAudioFile.js';
import { stripMp3Metadata } from './AudioMeta/lib/stripMetadata.js';
import { getTagLabel } from './AudioMeta/lib/tagLabels.js';
import {
  attachAudioPreviewUrl,
  createReplacementAudioUrl,
  revokeAudioFileUrls,
} from './AudioMeta/lib/audioObjectUrls.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mini Audio Player Component
// ─────────────────────────────────────────────────────────────────────────────

function MiniPlayer({ objectUrl }) {
  const { t } = useTranslation('tools');
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [objectUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => setPlaying(false);

  const handleSeek = (e) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, ratio * duration));
  };

  const formatTime = (s) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!objectUrl) return null;

  return (
    <div className="flex items-center gap-4 bg-app border border-border rounded-xl p-3 w-full mt-4">
      <audio
        ref={audioRef}
        src={objectUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button 
        className="flex items-center justify-center w-9 h-9 rounded-full bg-accent text-white border-none cursor-pointer transition-all hover:bg-accent-hover hover:scale-105 shrink-0 shadow-md" 
        onClick={togglePlay} 
        aria-label={t(playing ? 'tool-audiometa.ui.pause' : 'tool-audiometa.ui.play')}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        )}
      </button>
      <div className="flex flex-col gap-1.5 flex-1">
        <div
          className="relative h-1.5 bg-border rounded-full cursor-pointer"
          ref={progressRef}
          onClick={handleSeek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
        >
          <div className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all duration-75" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-accent shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75" style={{ left: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-text-muted font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Cover Art Placeholder
// ─────────────────────────────────────────────────────────────────────────────

function DefaultCoverArt({ format, size = 120 }) {
  const colors = {
    MP3: ['#4ade80', '#16a34a'],
    FLAC: ['#818cf8', '#4338ca'],
    WAV: ['#fb923c', '#c2410c'],
    M4A: ['#f472b6', '#be185d'],
    AAC: ['#f472b6', '#be185d'],
    OGG: ['#34d399', '#059669'],
    OPUS: ['#38bdf8', '#0369a1'],
    AIFF: ['#fbbf24', '#b45309'],
    WMA: ['#a78bfa', '#6d28d9'],
    DEFAULT: ['#94a3b8', '#475569'],
  };
  const [c1, c2] = colors[format] || colors.DEFAULT;
  const id = `grad-${format}-${size}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c1}/>
          <stop offset="100%" stopColor={c2}/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="12" fill={`url(#${id})`}/>
      {/* Vinyl grooves */}
      <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
      <circle cx="60" cy="60" r="32" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
      <circle cx="60" cy="60" r="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      {/* Center label */}
      <circle cx="60" cy="60" r="14" fill="rgba(255,255,255,0.25)"/>
      <circle cx="60" cy="60" r="5" fill="rgba(255,255,255,0.7)"/>
      {/* Format label */}
      <text x="60" y="102" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="11" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.05em">
        {format}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Format-specific badge colors
// ─────────────────────────────────────────────────────────────────────────────

function FormatBadge({ format }) {
  const badgeColors = {
    MP3: 'bg-green-500/15 text-green-700 dark:text-green-400 dark:bg-green-500/10',
    FLAC: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 dark:bg-indigo-500/10',
    WAV: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 dark:bg-orange-500/10',
    M4A: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 dark:bg-pink-500/10',
    AAC: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 dark:bg-pink-500/10',
    OGG: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/10',
    OPUS: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/10',
    AIFF: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 dark:bg-amber-500/10',
    WMA: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 dark:bg-purple-500/10',
    DEFAULT: 'bg-secondary text-text-muted',
  };
  const colorClass = badgeColors[format] || badgeColors.DEFAULT;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[0.68rem] font-bold uppercase tracking-wider ${colorClass}`}>
      {format}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_FIELDS = [
  { labelKey: 'metadata-fields.format', fn: (f) => f.format },
  { labelKey: 'metadata-fields.fileSize', fn: (f) => f.formattedSize },
  { labelKey: 'metadata-fields.title', fn: (f) => f.tags['TIT2'] || '—' },
  { labelKey: 'metadata-fields.artist', fn: (f) => f.tags['TPE1'] || '—' },
  { labelKey: 'metadata-fields.album', fn: (f) => f.tags['TALB'] || '—' },
  { labelKey: 'metadata-fields.year', fn: (f) => f.tags['TDRC'] || '—' },
  { labelKey: 'metadata-fields.genre', fn: (f) => f.tags['TCON'] || '—' },
  { labelKey: 'metadata-fields.track', fn: (f) => f.tags['TRCK'] || '—' },
  { labelKey: 'metadata-fields.duration', fn: (f) => formatDuration(f.technical.durationSec) },
  { labelKey: 'metadata-fields.bitrate', fn: (f) => f.technical.bitrate || '—' },
  { labelKey: 'metadata-fields.sampleRate', fn: (f) => f.technical.sampleRate ? `${f.technical.sampleRate.toLocaleString()} Hz` : '—' },
  { labelKey: 'metadata-fields.channels', fn: (f, t) => f.technical.numChannels ? (f.technical.numChannels === 1 ? t('tool-audiometa.ui.mono') : f.technical.numChannels === 2 ? t('tool-audiometa.ui.stereo') : t('tool-audiometa.ui.channelCount', { count: f.technical.numChannels })) : '—' },
  { labelKey: 'metadata-fields.bitDepth', fn: (f) => f.technical.bitsPerSample ? `${f.technical.bitsPerSample}-bit` : '—' },
  { labelKey: 'metadata-fields.codec', fn: (f) => f.technical.audioFormat || '—' },
];

export default function AudioMeta() {
  const { t } = useTranslation('tools');
  const { createObjectUrl, revokeObjectUrl, revokeAllObjectUrls } = useObjectUrlRegistry();
  const [files, setFiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'all' | 'compare'
  const [searchQuery, setSearchQuery] = useState('');
  const [compareSelectedIds, setCompareSelectedIds] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const fileInputRef = useRef(null);

  const ACCEPTED = '.mp3,.wav,.wave,.flac,.m4a,.aac,.m4b,.m4p,.mp4,.ogg,.oga,.opus,.aiff,.aif,.wma,.asf';

  const activeFile = files.find(f => f.id === selectedId) || null;

  const processFiles = async (fileList) => {
    const resourceCheck = validateResourceAddition(
      files,
      fileList,
      FILE_RESOURCE_POLICIES.audioMetadata,
    );
    if (!resourceCheck.valid) {
      setStatus(t('tool-audiometa.ui.resourceRejected'));
      return;
    }
    setStatus(t('tool-audiometa.ui.parsing'));
    const newFiles = [];
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      const supportedExts = ['mp3', 'wav', 'wave', 'flac', 'm4a', 'aac', 'm4b', 'm4p', 'mp4', 'ogg', 'oga', 'opus', 'aiff', 'aif', 'wma', 'asf'];
      if (!supportedExts.includes(ext)) {
        setStatus(t('tool-audiometa.ui.unsupportedFile', { name: file.name }));
        continue;
      }
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        setStatus(t('tool-audiometa.ui.alreadyLoaded', { name: file.name }));
        continue;
      }
      try {
        const parsed = await parseAudioFile(file);
        newFiles.push(attachAudioPreviewUrl(parsed, file, createObjectUrl));
      } catch (err) {
        console.error('Error parsing', file.name, err);
        setStatus(t('tool-audiometa.ui.parseFailed', { name: file.name }));
      }
    }
    if (newFiles.length > 0) {
      setFiles(prev => {
        const updated = [...prev, ...newFiles];
        setSelectedId(newFiles[0].id);
        setCompareSelectedIds(curr => [...curr, ...newFiles.map(f => f.id)]);
        return updated;
      });
      setStatus(t('tool-audiometa.ui.loadedCount', { count: newFiles.length }));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleRemove = (id) => {
    setFiles(prev => {
      const removed = prev.find(f => f.id === id);
      revokeAudioFileUrls(removed, revokeObjectUrl);
      const updated = prev.filter(f => f.id !== id);
      if (selectedId === id) setSelectedId(updated.length > 0 ? updated[0].id : null);
      return updated;
    });
    setCompareSelectedIds(prev => prev.filter(x => x !== id));
  };

  const handleClearAll = () => {
    revokeAllObjectUrls();
    setFiles([]);
    setSelectedId(null);
    setCompareSelectedIds([]);
    setStatus(t('tool-audiometa.ui.cleared'));
  };

  const handleExportJson = () => {
    if (!activeFile) return;
    const data = {
      filename: activeFile.name,
      format: activeFile.format,
      fileSize: activeFile.size,
      technical: activeFile.technical,
      tags: activeFile.tags,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = createObjectUrl(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.replace(/\.[^/.]+$/, '') + '_metadata.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeObjectUrl(url);
  };

  const handleStripMp3 = () => {
    if (!activeFile || activeFile.ext !== 'mp3') return;
    try {
      const stripped = stripMp3Metadata(activeFile.arrayBuffer);
      const blob = new Blob([stripped], { type: 'audio/mpeg' });
      const strippedUrl = createReplacementAudioUrl(
        activeFile.strippedInfo?.url,
        blob,
        createObjectUrl,
        revokeObjectUrl,
      );
      setFiles(prev => prev.map(f => f.id === activeFile.id ? {
        ...f,
        strippedInfo: {
          blob,
          url: strippedUrl,
          size: blob.size,
          formattedSize: formatBytes(blob.size),
        }
      } : f));
      setStatus(t('tool-audiometa.ui.stripSuccess'));
    } catch {
      setStatus(t('tool-audiometa.ui.stripFailed'));
    }
  };

  const handleDownloadStripped = () => {
    if (!activeFile?.strippedInfo) return;
    const a = document.createElement('a');
    a.href = activeFile.strippedInfo.url;
    const nameBase = activeFile.name.replace(/\.[^/.]+$/, '');
    a.download = `${nameBase}_stripped.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestoreOriginal = () => {
    if (!activeFile) return;
    if (activeFile.strippedInfo?.url) revokeObjectUrl(activeFile.strippedInfo.url);
    setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, strippedInfo: null } : f));
    setStatus(t('tool-audiometa.ui.restored'));
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleCompare = (id) => {
    setCompareSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Build advanced parameter table
  const buildAllParams = (file) => {
    if (!file) return [];
    const groups = [
      {
        key: 'technical',
        label: t('metadata-fields.technicalParameters'),
        icon: '🔧',
        rows: [
          [t('metadata-fields.format'), file.format],
          [t('metadata-fields.duration'), formatDuration(file.technical.durationSec)],
          [t('metadata-fields.bitrate'), file.technical.bitrate],
          [t('metadata-fields.sampleRate'), file.technical.sampleRate ? `${file.technical.sampleRate.toLocaleString()} Hz` : null],
          [t('metadata-fields.channels'), file.technical.numChannels ? `${channelLabel(file.technical.numChannels)} (${file.technical.numChannels})` : null],
          [t('metadata-fields.bitDepth'), file.technical.bitsPerSample ? `${file.technical.bitsPerSample}-bit` : null],
          [t('metadata-fields.codecEncoding'), file.technical.audioFormat],
          [t('metadata-fields.fileSize'), file.formattedSize],
          [t('metadata-fields.filename'), file.name],
        ].filter(([, v]) => v != null && v !== '' && v !== '—'),
      },
      {
        key: 'tags',
        label: t('metadata-fields.metadataTags'),
        icon: '🏷️',
        rows: Object.entries(file.tags)
          .filter(([, v]) => v && String(v).trim())
          .map(([k, v]) => [getTagLabel(k), String(v)]),
      },
    ];
    return groups;
  };

  const compareFiles = files.filter(f => compareSelectedIds.includes(f.id));

  const allParamGroups = buildAllParams(activeFile);

  const filteredParamGroups = allParamGroups.map(group => ({
    ...group,
    rows: searchQuery
      ? group.rows.filter(([k, v]) =>
          k.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.toLowerCase().includes(searchQuery.toLowerCase()))
      : group.rows,
  })).filter(g => g.rows.length > 0);

  // Channel display helper
  const channelLabel = (num) => {
    if (!num) return '—';
    if (num === 1) return t('tool-audiometa.ui.mono');
    if (num === 2) return t('tool-audiometa.ui.stereo');
    return t('tool-audiometa.ui.channelCount', { count: num });
  };

  return (
    <Card id="tool-audio-meta" variant="tool" size="wide"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        id="audiometa-file-input"
      />

      <ToolHeader 
        title={t('tool-audiometa.ui.title')}
      />

      {/* Full-width drag over overlay when files are already present */}
      {dragOver && files.length > 0 && (
        <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center gap-3 z-50 backdrop-blur-sm">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent animate-bounce">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <p className="text-lg font-bold text-text-main">{t('tool-audiometa.ui.dropAdd')}</p>
        </div>
      )}

      {/* Drop zone shown only when empty */}
      {files.length === 0 && (
        <div
          className={`border-2 border-dashed border-border rounded-xl p-8 cursor-pointer text-center transition-all flex flex-col items-center justify-center gap-4 min-h-[220px] hover:border-accent hover:bg-accent-light/5 mt-4 ${dragOver ? 'border-accent bg-accent-light/5' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label={t('tool-audiometa.ui.uploadAria')}
        >
          <div className="flex flex-col items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted transition-transform duration-300 hover:scale-110">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <p className="text-lg font-bold text-text-main">{t('tool-audiometa.ui.dropHere')}</p>
            <p className="text-sm text-text-muted">{t('tool-audiometa.ui.or')}</p>
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>{t('tool-audiometa.ui.browse')}</Button>
            <p className="text-xs text-text-muted mt-2">{t('tool-audiometa.ui.supports')}</p>
          </div>
        </div>
      )}

      {status && (
        <p className={`mt-3 p-3 rounded-lg text-sm font-medium ${status.startsWith('Failed') || status.startsWith('Error') ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-accent-light/10 text-accent'}`}>
          {status}
        </p>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-start mt-4">
          {/* Sidebar: file list */}
          <aside className="flex flex-col bg-card border border-border rounded-xl max-h-[600px] overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-border bg-app/50">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-audiometa.ui.fileCount', { count: files.length })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} title={t('tool-audiometa.ui.addTitle')} className="p-1 px-2 text-[0.75rem]">
                  {t('tool-audiometa.ui.add')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleClearAll} title={t('tool-audiometa.ui.clearTitle')} className="p-1 px-2 text-[0.75rem]">
                  {t('tool-audiometa.ui.clearAll')}
                </Button>
              </div>
            </div>
            <ul className="flex flex-col overflow-y-auto divide-y divide-border">
              {files.map(f => (
                <li
                  key={f.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-hover-bg relative group ${f.id === selectedId ? 'bg-accent-light/10 border-l-4 border-accent pl-2' : ''}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0">
                    {f.coverArt
                      ? <img src={f.coverArt} className="w-full h-full object-cover" alt={t('metadata-common.coverArt')} />
                      : <DefaultCoverArt format={f.format} size={36} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text-main truncate" title={f.name}>{f.name}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      <FormatBadge format={f.format} />
                      <span className="text-xs text-text-muted">{f.formattedSize}</span>
                    </span>
                  </div>
                  <button
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 rounded transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleRemove(f.id); }}
                    aria-label={t('tool-audiometa.ui.removeAria')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Main panel */}
          <main className="flex flex-col gap-4 min-w-0">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between pb-3 border-b border-border">
              <div className="flex gap-2">
                {[
                  { id: 'overview', label: `📋 ${t('tool-audiometa.ui.overview')}` },
                  { id: 'all', label: `🗂 ${t('tool-audiometa.ui.allParameters')}` },
                  { id: 'compare', label: `⚖️ ${t('tool-audiometa.ui.compare', { count: compareFiles.length })}` },
                ].map(tab => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    id={`audiometa-tab-${tab.id}`}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {activeFile && (
                  <>
                    <Button variant="secondary" size="sm" onClick={handleExportJson} title={t('tool-audiometa.ui.exportTitle')}>
                      ⬇ JSON
                    </Button>
                    {activeFile.ext === 'mp3' && !activeFile.strippedInfo && (
                      <Button variant="secondary" size="sm" onClick={handleStripMp3} title={t('tool-audiometa.ui.stripTitle')}>
                        ✂ {t('tool-audiometa.ui.stripTags')}
                      </Button>
                    )}
                    {activeFile.strippedInfo && (
                      <>
                        <Button variant="secondary" size="sm" onClick={handleDownloadStripped}>
                          ⬇ {t('tool-audiometa.ui.downloadStripped')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleRestoreOriginal}>
                          ↩ {t('tool-audiometa.ui.restore')}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Overview Tab ── */}
            {activeTab === 'overview' && activeFile && (
              <div className="flex flex-col gap-4">
                {/* Header card: cover + basic info */}
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                  <div className="w-[120px] h-[120px] rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                    {activeFile.coverArt
                      ? <img src={activeFile.coverArt} className="w-full h-full object-cover" alt={t('metadata-common.albumArt')} />
                      : <DefaultCoverArt format={activeFile.format} size={120} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-text-main truncate">
                      {activeFile.tags['TIT2'] || activeFile.name}
                    </h2>
                    {activeFile.tags['TPE1'] && (
                      <p className="text-text-muted font-medium mt-1">{activeFile.tags['TPE1']}</p>
                    )}
                    {activeFile.tags['TALB'] && (
                      <p className="text-sm text-text-muted mt-1">
                        {activeFile.tags['TALB']}
                        {activeFile.tags['TDRC'] && ` · ${activeFile.tags['TDRC']}`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <FormatBadge format={activeFile.format} />
                      {activeFile.strippedInfo && (
                        <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">{t('tool-audiometa.ui.tagsStripped')}</span>
                      )}
                    </div>
                    {/* Mini Player */}
                    <MiniPlayer objectUrl={activeFile.objectUrl} />
                  </div>
                </div>

                {/* Metadata cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tags card */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🏷️</span> {t('tool-audiometa.ui.metadata')}
                    </h3>
                    <dl className="flex flex-col gap-2">
                      {[
                        [t('metadata-fields.title'), activeFile.tags['TIT2']],
                        [t('metadata-fields.artist'), activeFile.tags['TPE1']],
                        [t('metadata-fields.albumArtist'), activeFile.tags['TPE2']],
                        [t('metadata-fields.album'), activeFile.tags['TALB']],
                        [t('metadata-fields.year'), activeFile.tags['TDRC']],
                        [t('metadata-fields.genre'), activeFile.tags['TCON']],
                        [t('metadata-fields.track'), activeFile.tags['TRCK']],
                        [t('metadata-fields.disc'), activeFile.tags['TPOS']],
                        [t('metadata-fields.composer'), activeFile.tags['TCOM']],
                        [t('metadata-fields.comment'), activeFile.tags['COMM']],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div className="flex justify-between py-1.5 border-b border-border last:border-0" key={k}>
                          <dt className="text-xs text-text-muted font-medium">{k}</dt>
                          <dd className="text-sm text-text-main font-semibold max-w-[70%] text-right truncate" title={v}>{v}</dd>
                        </div>
                      ))}
                      {Object.keys(activeFile.tags).filter(k =>
                        !['TIT2','TPE1','TPE2','TALB','TDRC','TCON','TRCK','TPOS','TCOM','COMM'].includes(k)
                      ).slice(0, 8).map(k => (
                        <div className="flex justify-between py-1.5 border-b border-border last:border-0" key={k}>
                          <dt className="text-xs text-text-muted font-medium">{getTagLabel(k)}</dt>
                          <dd className="text-sm text-text-main font-semibold max-w-[70%] text-right truncate" title={String(activeFile.tags[k])}>{String(activeFile.tags[k])}</dd>
                        </div>
                      ))}
                      {Object.keys(activeFile.tags).length === 0 && (
                        <p className="text-sm text-text-muted italic">{t('tool-audiometa.ui.noMetadata')}</p>
                      )}
                    </dl>
                  </div>

                  {/* Technical card */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🔧</span> {t('tool-audiometa.ui.technical')}
                    </h3>
                    <dl className="flex flex-col gap-2">
                      {[
                        [t('metadata-fields.format'), activeFile.format],
                        [t('metadata-fields.duration'), formatDuration(activeFile.technical.durationSec)],
                        [t('metadata-fields.bitrate'), activeFile.technical.bitrate],
                        [t('metadata-fields.sampleRate'), activeFile.technical.sampleRate ? `${activeFile.technical.sampleRate.toLocaleString()} Hz` : null],
                        [t('metadata-fields.channels'), channelLabel(activeFile.technical.numChannels)],
                        [t('metadata-fields.bitDepth'), activeFile.technical.bitsPerSample ? `${activeFile.technical.bitsPerSample}-bit` : null],
                        [t('metadata-fields.codec'), activeFile.technical.audioFormat],
                        [t('metadata-fields.fileSize'), activeFile.strippedInfo ? `${activeFile.strippedInfo.formattedSize} (stripped)` : activeFile.formattedSize],
                      ].filter(([, v]) => v && v !== '—').map(([k, v]) => (
                        <div className="flex justify-between py-1.5 border-b border-border last:border-0" key={k}>
                          <dt className="text-xs text-text-muted font-medium">{k}</dt>
                          <dd className="text-sm text-text-main font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* MP3 Stripping info */}
                {activeFile.strippedInfo && (
                  <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3.5 text-sm text-text-main">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 shrink-0">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>{t('tool-audiometa.ui.strippedSummary', { original: activeFile.formattedSize, stripped: activeFile.strippedInfo.formattedSize })}</span>
                    <Button size="sm" variant="primary" onClick={handleDownloadStripped} className="ml-auto">{t('tool-audiometa.ui.download')}</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── All Parameters Tab ── */}
            {activeTab === 'all' && activeFile && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 px-4">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder={t('tool-audiometa.ui.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 border-none bg-transparent text-sm text-text-main outline-none placeholder-text-muted/50"
                    id="audiometa-search-input"
                  />
                  {searchQuery && (
                    <button className="bg-none border-none text-text-muted cursor-pointer text-base hover:text-text-main" onClick={() => setSearchQuery('')}>×</button>
                  )}
                </div>
                {filteredParamGroups.length === 0 ? (
                  <p className="text-sm text-text-muted italic text-center p-4">{t('tool-audiometa.ui.noMatch')}</p>
                ) : (
                  filteredParamGroups.map(group => (
                    <div key={group.key} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button
                        className="flex items-center gap-2 w-full p-3.5 px-5 bg-none border-none cursor-pointer text-sm font-semibold text-text-main text-left transition-colors hover:bg-hover-bg"
                        onClick={() => toggleGroup(group.key)}
                        id={`audiometa-group-${group.key}`}
                      >
                        <span>{group.icon} {group.label}</span>
                        <span className="ml-auto text-xs text-text-muted bg-app px-2 py-0.5 rounded-full mr-2">{group.rows.length}</span>
                        <svg
                          className={`text-text-muted shrink-0 transition-transform duration-200 ${collapsedGroups[group.key] ? '-rotate-90' : ''}`}
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      {!collapsedGroups[group.key] && (
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full border-collapse">
                            <tbody>
                              {group.rows.map(([k, v]) => (
                                <tr key={k} className="hover:bg-hover-bg/30">
                                  <td className="p-2.5 px-5 w-[200px] text-xs text-text-muted font-medium border-b border-border last:border-0 vertical-align-top">{k}</td>
                                  <td className="p-2.5 px-5 text-xs text-text-main border-b border-border last:border-0 break-all vertical-align-top">{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Compare Tab ── */}
            {activeTab === 'compare' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-text-muted">{t('tool-audiometa.ui.selectCompare')}</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map(f => (
                      <button
                        key={f.id}
                        className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors max-w-[200px] truncate ${compareSelectedIds.includes(f.id) ? 'border-accent bg-accent-light/10 text-text-main' : 'border-border bg-card text-text-muted hover:border-accent hover:text-text-main'}`}
                        onClick={() => toggleCompare(f.id)}
                      >
                        <FormatBadge format={f.format} />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {compareFiles.length >= 1 ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full border-collapse min-w-[400px]">
                      <thead>
                        <tr>
                          <th className="p-3 px-4 bg-app text-xs font-semibold text-text-muted text-left border-b border-border">{t('tool-audiometa.ui.parameter')}</th>
                          {compareFiles.map(f => (
                            <th key={f.id} className="p-3 px-4 bg-app text-xs font-semibold text-text-muted text-left border-b border-border max-w-[180px] truncate">
                              <div className="flex items-center gap-2 truncate">
                                {f.coverArt
                                  ? <img src={f.coverArt} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                                  : <DefaultCoverArt format={f.format} size={32} />
                                }
                                <span className="truncate" title={f.name}>{f.name}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_FIELDS.map(field => (
                          <tr key={field.labelKey} className="hover:bg-hover-bg/30">
                            <td className="p-2.5 px-4 text-xs font-medium text-text-muted border-b border-border last:border-0 w-[130px] truncate">{t(field.labelKey)}</td>
                            {compareFiles.map(f => (
                              <td key={f.id} className="p-2.5 px-4 text-xs text-text-main border-b border-border last:border-0 min-w-[140px] vertical-align-top">
                                {field.fn(f, t)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted italic text-center p-4">{t('tool-audiometa.ui.selectAtLeastOne')}</p>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </Card>
  );
}
