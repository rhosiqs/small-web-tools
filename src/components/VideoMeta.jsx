import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MediaSeparatorWaveform from './MediaSeparatorWaveform';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { FILE_RESOURCE_POLICIES, validateResourceAddition } from '../lib/resourceLimits';
import { formatDuration } from '../lib/mediaMetadataFormatters';
import useObjectUrlRegistry from '../hooks/useObjectUrlRegistry';
import {
  COLOR_PRIMARIES,
  MATRIX_COEFFICIENTS,
  TRANSFER_CHARACTERISTICS,
  frameCountToTimecode,
  parseMediaFile,
} from './VideoMeta/lib/videoMetadata';
import { createVideoAudioExtractionService } from './VideoMeta/lib/videoAudioExtraction';

function DefaultThumbnail({ format, width = 120, height = 80 }) {
  const colors = { MP4: ['#6366f1', '#4338ca'], MOV: ['#a855f7', '#7c3aed'], M4V: ['#8b5cf6', '#6d28d9'], AVI: ['#0ea5e9', '#0369a1'], MKV: ['#ec4899', '#be185d'], WEBM: ['#eab308', '#a16207'], WMV: ['#14b8a6', '#0d9488'], FLV: ['#f97316', '#c2410c'], LOG: ['#94a3b8', '#475569'], TXT: ['#94a3b8', '#475569'], DEFAULT: ['#64748b', '#334155'] };
  const [c1, c2] = colors[format] || colors.DEFAULT;
  const id = `grad-vid-${format}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" style={{ width, height, display: 'block' }}>
      <defs><linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/></linearGradient></defs>
      <rect width="160" height="100" rx="10" fill={`url(#${id})`}/>
      <polygon points="65,35 65,65 95,50" fill="rgba(255,255,255,0.3)"/>
      <rect x="10" y="8" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="22" y="8" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="34" y="8" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="10" y="86" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="22" y="86" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="34" y="86" width="8" height="6" rx="1" fill="rgba(255,255,255,0.15)"/>
      <text x="130" y="92" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="11" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.05em">{format}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Format badge
// ─────────────────────────────────────────────────────────────────────────────

function FormatBadge({ format }) {
  const styles = {
    MP4: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/12 dark:text-indigo-400',
    MOV: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/12 dark:text-purple-400',
    M4V: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/12 dark:text-indigo-400',
    AVI: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/12 dark:text-sky-400',
    MKV: 'bg-pink-500/15 text-pink-700 dark:bg-pink-500/12 dark:text-pink-400',
    WEBM: 'bg-yellow-500/15 text-yellow-700 dark:bg-yellow-500/12 dark:text-yellow-400',
    LOG: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/12 dark:text-slate-400',
    TXT: 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/12 dark:text-slate-400',
    '3GP': 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/12 dark:text-indigo-400',
    WMV: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/12 dark:text-sky-400',
    FLV: 'bg-pink-500/15 text-pink-700 dark:bg-pink-500/12 dark:text-pink-400',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[0.68rem] font-bold uppercase tracking-wider ${styles[format] || 'bg-slate-500/15 text-slate-700 dark:bg-slate-500/12 dark:text-slate-400'}`}>
      {format}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare fields
// ─────────────────────────────────────────────────────────────────────────────

const COMPARE_FIELDS = [
  { labelKey: 'metadata-fields.format', fn: (f) => f.format },
  { labelKey: 'metadata-fields.fileSize', fn: (f) => f.formattedSize },
  { labelKey: 'metadata-fields.duration', fn: (f) => formatDuration(f.containerDuration) },
  { labelKey: 'metadata-fields.videoCodec', fn: (f) => f.videoTracks[0]?.codec || '\u2014' },
  { labelKey: 'metadata-fields.resolution', fn: (f) => { const v = f.videoTracks[0]; return v?.width ? `${v.width} \u00d7 ${v.height}` : '\u2014'; } },
  { labelKey: 'metadata-fields.frameRate', fn: (f) => { const v = f.videoTracks[0]; return (v?.sampleCount && v?.duration) ? (v.sampleCount / v.duration).toFixed(2) : '\u2014'; } },
  { labelKey: 'metadata-fields.audioCodec', fn: (f) => f.audioTracks[0]?.codec || '\u2014' },
  { labelKey: 'metadata-fields.audioChannels', fn: (f, t) => { const a = f.audioTracks[0]; if (!a?.channels) return '\u2014'; if (a.channels === 1) return t('tool-videometa.ui.mono'); if (a.channels === 2) return t('tool-videometa.ui.stereo'); if (a.channels === 6) return '5.1'; if (a.channels === 8) return '7.1'; return t('tool-videometa.ui.channelCount', { count: a.channels }); } },
  { labelKey: 'metadata-fields.sampleRate', fn: (f) => { const a = f.audioTracks[0]; return a?.sampleRate ? `${a.sampleRate.toLocaleString()} Hz` : '\u2014'; } },
  { labelKey: 'metadata-fields.colorPrimaries', fn: (f) => { const v = f.videoTracks[0]; return v?.colorPrimaries != null ? (COLOR_PRIMARIES[v.colorPrimaries] || `Code ${v.colorPrimaries}`) : '\u2014'; } },
  { labelKey: 'metadata-fields.subtitles', fn: (f, t) => f.subtitleTracks.length > 0 ? t('video-units.trackCount', { count: f.subtitleTracks.length }) : '\u2014' },
  { labelKey: 'metadata-fields.timecode', fn: (f) => { const tc = f.timecodeTracks[0]; if (!tc || tc.timecodeStartFrame == null) return '\u2014'; const fps = tc.timecodeTimescale && tc.timecodeFrameDuration ? tc.timecodeTimescale / tc.timecodeFrameDuration : tc.timecodeNumFrames || 30; return frameCountToTimecode(tc.timecodeStartFrame, fps, (tc.timecodeFlags & 0x01) !== 0) || '\u2014'; } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoMeta() {
  const { t } = useTranslation('tools');
  const translate = t;
  const {
    createObjectUrl,
    revokeObjectUrl,
    revokeAllObjectUrls,
  } = useObjectUrlRegistry();
  const [files, setFiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [compareSelectedIds, setCompareSelectedIds] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const fileInputRef = useRef(null);

  const [extractingTrack, setExtractingTrack] = useState(null); // { fileId, trackIndex }
  const [extractProgress, setExtractProgress] = useState(0);

  const [audioURLs, setAudioURLs] = useState({}); // { 'fileId-trackIndex': blobUrl }
  const [loadingURLs, setLoadingURLs] = useState({}); // { 'fileId-trackIndex': boolean }
  const activeFile = files.find(f => f.id === selectedId) || null;
  const extractionServiceRef = useRef(null);
  if (!extractionServiceRef.current) {
    extractionServiceRef.current = createVideoAudioExtractionService();
  }
  const extractionService = extractionServiceRef.current;

  const audioURLsRef = useRef({});
  useEffect(() => {
    audioURLsRef.current = audioURLs;
  }, [audioURLs]);

  useEffect(() => {
    if (!activeFile || activeFile.type !== 'video' || activeFile.audioTracks.length === 0) return;

    const abortController = new AbortController();

    const extractAll = async () => {
      for (let i = 0; i < activeFile.audioTracks.length; i++) {
        const key = `${activeFile.id}-${i}`;

        if (audioURLsRef.current[key]) continue;
        if (abortController.signal.aborted) break;

        setLoadingURLs(prev => ({ ...prev, [key]: true }));

        try {
          const { blob } = await extractionService.extract(
            activeFile.file,
            i,
            activeFile.audioTracks[i],
            { signal: abortController.signal },
          );
          if (!abortController.signal.aborted) {
            const url = createObjectUrl(blob);
            setAudioURLs(prev => ({ ...prev, [key]: url }));
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error(`Failed to extract audio track ${i} automatically:`, err);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setLoadingURLs(prev => ({ ...prev, [key]: false }));
          }
        }
      }
    };

    extractAll();

    return () => {
      abortController.abort();
    };
  }, [activeFile, createObjectUrl, extractionService]);

  const downloadAudioTrack = async (file, trackIndex, trackInfo) => {
    if (extractingTrack) return;
    setExtractingTrack({ fileId: file.id, trackIndex });
    setExtractProgress(0);
    setStatus(t('tool-videometa.ui.loadingEngine'));

    try {
      setStatus(t('tool-videometa.ui.extractingAudio'));
      const { blob, extension } = await extractionService.extract(file.file, trackIndex, trackInfo, {
        onProgress: setExtractProgress,
      });

      const downloadUrl = createObjectUrl(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const codecLabel = (trackInfo.codec || 'audio').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      a.download = `${baseName}_track_${trackIndex + 1}_${codecLabel}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      revokeObjectUrl(downloadUrl);
      setStatus(t('tool-videometa.ui.audioDownloaded', { number: trackIndex + 1 }));
    } catch (err) {
      console.error(err);
      setStatus(t('tool-videometa.ui.audioFailed'));
    } finally {
      setExtractingTrack(null);
      setExtractProgress(0);
    }
  };

  const ACCEPTED = '.mp4,.mov,.m4v,.f4v,.3gp,.3g2,.avi,.mkv,.webm,.wmv,.flv,.ts,.mts,.m2ts,.mxf,.log,.txt';
  useEffect(() => {
    return () => extractionService.dispose();
  }, [extractionService]);

  const processFiles = async (fileList) => {
    const resourceCheck = validateResourceAddition(files, fileList, FILE_RESOURCE_POLICIES.videoMetadata);
    if (!resourceCheck.valid) { setStatus(t('tool-videometa.ui.resourceRejected')); return; }
    setStatus(t('tool-videometa.ui.parsing'));
    const newFiles = [];
    const supportedExts = ['mp4', 'mov', 'm4v', 'f4v', '3gp', '3g2', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'ts', 'mts', 'm2ts', 'mxf', 'log', 'txt'];
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!supportedExts.includes(ext)) { setStatus(t('tool-videometa.ui.unsupportedFile', { name: file.name })); continue; }
      if (files.some(f => f.name === file.name && f.size === file.size)) { setStatus(t('tool-videometa.ui.alreadyLoaded', { name: file.name })); continue; }
      try {
        const parsed = await parseMediaFile(file);
        if (parsed.type === 'video') parsed.objectUrl = createObjectUrl(file);
        newFiles.push(parsed);
      } catch (err) { console.error('Error parsing', file.name, err); setStatus(t('tool-videometa.ui.parseFailed', { name: file.name })); }
    }
    if (newFiles.length > 0) {
      setFiles(prev => { const updated = [...prev, ...newFiles]; setSelectedId(newFiles[0].id); setCompareSelectedIds(curr => [...curr, ...newFiles.map(f => f.id)]); return updated; });
      setStatus(t('tool-videometa.ui.loadedCount', { count: newFiles.length }));
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); };
  const handleFileChange = (e) => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ''; };

  const handleRemove = (id) => {
    setFiles(prev => { const rm = prev.find(f => f.id === id); if (rm?.objectUrl) revokeObjectUrl(rm.objectUrl); const up = prev.filter(f => f.id !== id); if (selectedId === id) setSelectedId(up.length > 0 ? up[0].id : null); return up; });
    setCompareSelectedIds(prev => prev.filter(x => x !== id));
    setAudioURLs(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(key => {
        if (key.startsWith(`${id}-`)) {
          revokeObjectUrl(copy[key]);
          delete copy[key];
        }
      });
      return copy;
    });
  };

  const handleClearAll = () => {
    revokeAllObjectUrls();
    setAudioURLs({});
    setFiles([]);
    setSelectedId(null);
    setCompareSelectedIds([]);
    setStatus(t('tool-videometa.ui.cleared'));
  };

  const handleExportJson = () => {
    if (!activeFile) return;
    const data = { filename: activeFile.name, format: activeFile.format, fileSize: activeFile.size, duration: activeFile.containerDuration, brand: activeFile.brand, metadata: activeFile.metadata, videoTracks: activeFile.videoTracks.map(t => ({ codec: t.codec, codecFourCC: t.codecFourCC, width: t.width, height: t.height, duration: t.duration, sampleCount: t.sampleCount, colorPrimaries: t.colorPrimaries != null ? COLOR_PRIMARIES[t.colorPrimaries] : null, transferCharacteristics: t.transferCharacteristics != null ? TRANSFER_CHARACTERISTICS[t.transferCharacteristics] : null, matrixCoefficients: t.matrixCoefficients != null ? MATRIX_COEFFICIENTS[t.matrixCoefficients] : null, fullRange: t.fullRange, language: t.language })), audioTracks: activeFile.audioTracks.map(t => ({ codec: t.codec, channels: t.channels, sampleRate: t.sampleRate, bitsPerSample: t.bitsPerSample, language: t.language })), subtitleTracks: activeFile.subtitleTracks.map(t => ({ codec: t.codec, language: t.language })), logParams: activeFile.logParams };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = createObjectUrl(blob); const a = document.createElement('a'); a.href = url; a.download = activeFile.name.replace(/\.[^/.]+$/, '') + '_metadata.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); revokeObjectUrl(url);
  };

  const toggleGroup = (gk) => { setCollapsedGroups(prev => ({ ...prev, [gk]: !prev[gk] })); };
  const toggleCompare = (id) => { setCompareSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const buildAllParams = (file) => {
    if (!file) return [];
    const groups = [];
    if (file.type === 'log') {
      groups.push({ key: 'log', label: t('metadata-fields.logFileParameters'), icon: '\ud83d\udcc4', rows: Object.entries(file.logParams || {}).map(([k, v]) => [k, v]) });
      groups.push({ key: 'file', label: t('metadata-fields.fileInformation'), icon: '\ud83d\udcc1', rows: [[t('metadata-fields.filename'), file.name], [t('metadata-fields.fileSize'), file.formattedSize], [t('metadata-fields.format'), file.format]] });
      return groups;
    }
    const cr = [[t('metadata-fields.format'), file.format], [t('metadata-fields.brand'), file.brand], [t('metadata-fields.compatibleBrands'), file.compatibleBrands.length > 0 ? file.compatibleBrands.join(', ') : null], [t('metadata-fields.duration'), formatDuration(file.containerDuration)], [t('metadata-fields.fileSize'), file.formattedSize], [t('metadata-fields.filename'), file.name]].filter(([, v]) => v != null && v !== '' && v !== '\u2014');
    if (cr.length > 0) groups.push({ key: 'container', label: `\ud83d\udce6 ${t('metadata-fields.container')}`, icon: '', rows: cr });

    file.videoTracks.forEach((track, i) => {
      const pf = file.videoTracks.length > 1 ? t('tool-videometa.ui.videoTrack', { number: i + 1 }) : t('videometa-extra.video');
      const fps = track.sampleCount && track.duration ? (track.sampleCount / track.duration).toFixed(3) : null;
      const rows = [[t('metadata-fields.codec'), track.codec], [t('metadata-fields.codecFourCC'), track.codecFourCC], [t('metadata-fields.resolution'), track.width ? `${track.width} \u00d7 ${track.height}` : null], [t('metadata-fields.frameRate'), fps ? `${fps} fps` : null], [t('metadata-fields.duration'), formatDuration(track.duration)], [t('metadata-fields.sampleCount'), track.sampleCount ? track.sampleCount.toLocaleString() : null], [t('metadata-fields.bitDepth'), track.bitDepth ? `${track.bitDepth}-bit` : null], [t('metadata-fields.compressor'), track.compressorName], [t('metadata-fields.language'), track.language && track.language !== 'und' ? track.language : null], [t('metadata-fields.colorPrimaries'), track.colorPrimaries != null ? (COLOR_PRIMARIES[track.colorPrimaries] || `Code ${track.colorPrimaries}`) : null], [t('metadata-fields.transfer'), track.transferCharacteristics != null ? (TRANSFER_CHARACTERISTICS[track.transferCharacteristics] || `Code ${track.transferCharacteristics}`) : null], [t('metadata-fields.matrix'), track.matrixCoefficients != null ? (MATRIX_COEFFICIENTS[track.matrixCoefficients] || `Code ${track.matrixCoefficients}`) : null], [t('metadata-fields.fullRange'), track.fullRange != null ? (track.fullRange ? t('tool-videometa.ui.yesFull') : t('tool-videometa.ui.noLimited')) : null], [t('metadata-fields.colorInfoType'), track.colorInfo]].filter(([, v]) => v != null && v !== '' && v !== '\u2014');
      groups.push({ key: `video-${i}`, label: `\ud83c\udfac ${pf}`, icon: '', rows });
    });

    file.audioTracks.forEach((track, i) => {
      const pf = file.audioTracks.length > 1 ? t('tool-videometa.ui.audioTrack', { number: i + 1 }) : t('videometa-extra.audio').replace(/:$/, '');
      const cl = track.channels === 1 ? t('tool-videometa.ui.mono') : track.channels === 2 ? t('tool-videometa.ui.stereo') : track.channels === 6 ? '5.1 Surround' : track.channels === 8 ? '7.1 Surround' : t('tool-videometa.ui.channelCount', { count: track.channels });
      const rows = [[t('metadata-fields.codec'), track.codec], [t('metadata-fields.channels'), track.channels ? cl : null], [t('metadata-fields.sampleRate'), track.sampleRate ? `${track.sampleRate.toLocaleString()} Hz` : null], [t('metadata-fields.bitDepth'), track.bitsPerSample ? `${track.bitsPerSample}-bit` : null], [t('metadata-fields.duration'), formatDuration(track.duration)], [t('metadata-fields.language'), track.language && track.language !== 'und' ? track.language : null]].filter(([, v]) => v != null && v !== '' && v !== '\u2014');
      groups.push({ key: `audio-${i}`, label: `\ud83d\udd0a ${pf}`, icon: '', rows });
    });

    if (file.subtitleTracks.length > 0) {
      const rows = file.subtitleTracks.map((t, i) => [`Track ${i + 1}`, [t.codec, t.language && t.language !== 'und' ? `(${t.language})` : ''].filter(Boolean).join(' ')]);
      groups.push({ key: 'subtitles', label: `\ud83d\udcac ${t('metadata-fields.subtitles')}`, icon: '', rows });
    }

    file.timecodeTracks.forEach((track, i) => {
      const fps = track.timecodeTimescale && track.timecodeFrameDuration ? track.timecodeTimescale / track.timecodeFrameDuration : track.timecodeNumFrames || 30;
      const isDF = (track.timecodeFlags & 0x01) !== 0;
      const tc = track.timecodeStartFrame != null ? frameCountToTimecode(track.timecodeStartFrame, fps, isDF) : null;
      const rows = [[t('metadata-fields.startTimecode'), tc], [t('metadata-fields.frameRate'), fps ? `${fps} fps` : null], [t('metadata-fields.dropFrame'), isDF ? t('tool-videometa.ui.yes') : t('tool-videometa.ui.no')], [t('metadata-fields.startFrame'), track.timecodeStartFrame != null ? track.timecodeStartFrame.toString() : null]].filter(([, v]) => v != null);
      groups.push({ key: `timecode-${i}`, label: `\u23f1\ufe0f ${t('metadata-fields.timecode')}`, icon: '', rows });
    });

    if (Object.keys(file.metadata).length > 0) {
      groups.push({ key: 'metadata', label: `\ud83c\udff7\ufe0f ${t('metadata-fields.metadataTags')}`, icon: '', rows: Object.entries(file.metadata).map(([k, v]) => [k, String(v)]) });
    }
    return groups;
  };

  const compareFiles = files.filter(f => compareSelectedIds.includes(f.id));
  const allParamGroups = buildAllParams(activeFile);
  const filteredParamGroups = allParamGroups.map(g => ({ ...g, rows: searchQuery ? g.rows.filter(([k, v]) => k.toLowerCase().includes(searchQuery.toLowerCase()) || String(v).toLowerCase().includes(searchQuery.toLowerCase())) : g.rows })).filter(g => g.rows.length > 0);

  return (
    <Card id="tool-videometa" variant="tool" size="wide" className="relative" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
      <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} style={{ display: 'none' }} onChange={handleFileChange} id="videometa-file-input" />

      <ToolHeader title={t('tool-videometa.ui.title')} />

      {dragOver && files.length > 0 && (
        <div className="absolute inset-0 bg-indigo-500/15 backdrop-blur-sm border-2 border-dashed border-indigo-500 rounded-2xl flex items-center justify-center z-[100] pointer-events-none font-semibold text-indigo-500 text-2xl">
          <div className="flex flex-col items-center gap-2.5">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <p>{t('tool-videometa.ui.dropAdd')}</p>
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer transition-all duration-250 flex items-center justify-center bg-indigo-500/[0.02] hover:border-indigo-500 hover:bg-indigo-500/[0.06] select-none" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()} aria-label={t('tool-videometa.ui.uploadAria')}>
          <div className="flex flex-col items-center">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <p className="text-lg font-semibold text-text-main mt-0">{t('tool-videometa.ui.dropHere')}</p>
            <p className="text-[0.85rem] text-text-muted my-2">{t('tool-videometa.ui.or')}</p>
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>{t('tool-videometa.ui.browse')}</Button>
            <p className="text-[0.8rem] text-text-muted mt-4 max-w-[320px]">{t('tool-videometa.ui.supports')}</p>
          </div>
        </div>
      )}

      {status && <p className={`text-[0.85rem] px-3.5 py-2 rounded-lg ${status.startsWith('Failed') || status.startsWith('Error') ? 'text-red-500 bg-red-500/[0.08]' : 'text-indigo-500 bg-indigo-500/[0.08]'}`}>{status}</p>}

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 min-h-[520px]">
          <aside className="flex flex-col bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-app">
              <span className="text-[0.8rem] font-semibold text-text-muted uppercase tracking-wider">{t('tool-videometa.ui.fileCount', { count: files.length })}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} title={t('tool-videometa.ui.addTitle')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>{t('tool-videometa.ui.add')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleClearAll} title={t('tool-videometa.ui.clearTitle')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>{t('tool-videometa.ui.clearAll')}
                </Button>
              </div>
            </div>
            <ul className="list-none m-0 p-1.5 overflow-y-auto flex-1 flex flex-row flex-wrap md:flex-col gap-1.5 md:max-h-none max-h-[200px]">
              {files.map(f => (
                <li key={f.id} className={`flex flex-col md:flex-row items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors duration-180 relative group hover:bg-nav-hover-bg ${f.id === selectedId ? 'bg-indigo-500/10 outline outline-1 outline-indigo-500' : ''}`} onClick={() => setSelectedId(f.id)}>
                  <div className="w-11 h-7.5 rounded overflow-hidden flex-shrink-0 flex items-center justify-center bg-app">{f.thumbnailUrl ? <img src={f.thumbnailUrl} alt={t('videometa-extra.thumbnail')} className="w-full h-full object-cover" /> : <DefaultThumbnail format={f.format} width={44} height={30} />}</div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[0.82rem] font-medium text-text-main truncate max-w-[72px] md:max-w-[130px] text-center md:text-left" title={f.name}>{f.name}</span>
                    <span className="flex items-center gap-1 text-[0.75rem] text-text-muted justify-center md:justify-start"><FormatBadge format={f.format} />{f.formattedSize}</span>
                  </div>
                  <button className="hidden group-hover:flex items-center justify-center bg-none border-none text-text-muted cursor-pointer p-1 rounded shrink-0 transition-colors hover:text-red-500 hover:bg-red-500/10 absolute top-1 right-1 md:relative md:top-auto md:right-auto" onClick={(e) => { e.stopPropagation(); handleRemove(f.id); }} aria-label={t('metadata-common.removeFile')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center gap-1 bg-app border border-border rounded-xl p-1 flex-wrap">
              {[{ id: 'overview', label: `\ud83d\udccb ${t('videometa-extra.overview')}` }, { id: 'all', label: `\ud83d\uddc2 ${t('videometa-extra.allParameters')}` }, { id: 'compare', label: `\u2696\ufe0f ${t('videometa-extra.compare', { count: compareFiles.length })}` }].map(tab => (
                <button key={tab.id} className={`px-3.5 py-[7px] border-none rounded-lg bg-transparent text-[0.85rem] font-medium text-text-muted cursor-pointer transition-all duration-200 hover:bg-nav-hover-bg hover:text-text-main ${activeTab === tab.id ? 'bg-card text-text-main font-semibold shadow-sm' : ''}`} onClick={() => setActiveTab(tab.id)} id={`videometa-tab-${tab.id}`}>{tab.label}</button>
              ))}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">{activeFile && <Button variant="secondary" size="sm" onClick={handleExportJson} title={t('videometa-extra.exportTitle')}>{'\u2b07'} JSON</Button>}</div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && activeFile && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-5 bg-card border border-border rounded-2xl p-5">
                  <div className="w-full max-w-[300px] md:w-[200px] rounded-lg overflow-hidden shrink-0 shadow-md bg-black relative">
                    {activeFile.type === 'video' && activeFile.objectUrl ? <video src={activeFile.objectUrl} controls preload="metadata" style={{ width: '100%' }} /> : activeFile.thumbnailUrl ? <img src={activeFile.thumbnailUrl} alt={t('videometa-extra.thumbnail')} /> : <DefaultThumbnail format={activeFile.format} width={200} height={130} />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1 text-center md:text-left">
                    <h2 className="text-lg font-bold text-text-main m-0 truncate">{activeFile.metadata?.Title || activeFile.name}</h2>
                    {activeFile.metadata?.Artist && <p className="text-[0.95rem] text-indigo-500 font-medium m-0">{activeFile.metadata.Artist}</p>}
                    {activeFile.containerDuration && <p className="text-[0.85rem] text-text-muted m-0">{t('tool-videometa.ui.duration')} {formatDuration(activeFile.containerDuration)}</p>}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center md:justify-start"><FormatBadge format={activeFile.format} />{activeFile.brand && <span className="inline-block px-1.5 py-0.5 rounded text-[0.68rem] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-700 dark:bg-slate-500/12 dark:text-slate-400">{activeFile.brand}</span>}</div>
                    {activeFile.type === 'video' && activeFile.videoTracks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 justify-center md:justify-start">
                        {activeFile.videoTracks[0].codec && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold bg-app text-text-muted border border-border"><span className="text-text-muted font-normal mr-0.5">{t('videometa-extra.codec')}</span>{activeFile.videoTracks[0].codec}</span>}
                        {activeFile.videoTracks[0].width && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold bg-app text-text-muted border border-border"><span className="text-text-muted font-normal mr-0.5">Res:</span>{activeFile.videoTracks[0].width}{'\u00d7'}{activeFile.videoTracks[0].height}</span>}
                        {(() => { const v = activeFile.videoTracks[0]; return (v.sampleCount && v.duration) ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold bg-app text-text-muted border border-border"><span className="text-text-muted font-normal mr-0.5">FPS:</span>{(v.sampleCount / v.duration).toFixed(2)}</span> : null; })()}
                        {activeFile.audioTracks.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold bg-app text-text-muted border border-border"><span className="text-text-muted font-normal mr-0.5">Audio:</span>{t('video-units.trackCount', { count: activeFile.audioTracks.length })}</span>}
                        {activeFile.subtitleTracks.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.75rem] font-semibold bg-app text-text-muted border border-border"><span className="text-text-muted font-normal mr-0.5">Subs:</span>{activeFile.subtitleTracks.length}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {activeFile.type === 'video' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activeFile.videoTracks.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83c\udfac'}</span> {t('videometa-extra.video')}</h3>
                        {activeFile.videoTracks.map((t, i) => { const fps = t.sampleCount && t.duration ? (t.sampleCount / t.duration).toFixed(3) : null; return (
                          <dl className="flex flex-col m-0" key={i}>{[[translate('metadata-fields.codec'), t.codec], [translate('metadata-fields.resolution'), t.width ? `${t.width} \u00d7 ${t.height}` : null], [translate('metadata-fields.frameRate'), fps ? `${fps} fps` : null], [translate('metadata-fields.bitDepth'), t.bitDepth ? `${t.bitDepth}-bit` : null], [translate('metadata-fields.language'), t.language && t.language !== 'und' ? t.language : null], [translate('metadata-fields.colorPrimaries'), t.colorPrimaries != null ? (COLOR_PRIMARIES[t.colorPrimaries] || `Code ${t.colorPrimaries}`) : null], [translate('metadata-fields.transfer'), t.transferCharacteristics != null ? (TRANSFER_CHARACTERISTICS[t.transferCharacteristics] || `Code ${t.transferCharacteristics}`) : null], [translate('metadata-fields.matrix'), t.matrixCoefficients != null ? (MATRIX_COEFFICIENTS[t.matrixCoefficients] || `Code ${t.matrixCoefficients}`) : null], [translate('metadata-fields.fullRange'), t.fullRange != null ? (t.fullRange ? translate('tool-videometa.ui.yesFull') : translate('tool-videometa.ui.noLimited')) : null]].filter(([, v]) => v != null).map(([k, v]) => <div className="flex gap-2 py-1.5 border-b border-border last:border-b-0 text-[0.84rem]" key={k}><dt className="w-[100px] sm:w-[130px] shrink-0 text-text-muted font-medium">{k}</dt><dd className="text-text-main m-0 break-all flex-1">{v}</dd></div>)}</dl>
                        ); })}
                      </div>
                    )}

                    {activeFile.audioTracks.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83d\udd0a'}</span> {t('video-units.audioSection')}</h3>
                        <div className="flex flex-col gap-2">
                          {activeFile.audioTracks.map((t, i) => {
                            const cl = t.channels === 1 ? translate('tool-videometa.ui.mono') : t.channels === 2 ? translate('tool-videometa.ui.stereo') : t.channels === 6 ? '5.1' : t.channels === 8 ? '7.1' : translate('tool-videometa.ui.channelCount', { count: t.channels });
                            const isExtracting = extractingTrack && extractingTrack.fileId === activeFile.id && extractingTrack.trackIndex === i;
                            const key = `${activeFile.id}-${i}`;
                            return (
                              <div className="flex flex-col gap-1.5" key={i}>
                                <div className="flex items-center gap-2.5 p-2 px-3 bg-app rounded-lg text-[0.84rem]">
                                  <span className="text-base shrink-0">{'\ud83c\udfb5'}</span>
                                  <span className="font-semibold text-text-main min-w-[50px]">{t('tool-videometa.ui.track', { number: i + 1 })}</span>
                                  <span className="text-text-muted flex-1">
                                    {[t.codec, t.channels ? cl : null, t.sampleRate ? `${t.sampleRate.toLocaleString()} Hz` : null, t.language && t.language !== 'und' ? `(${t.language})` : null].filter(Boolean).join(' \u00b7 ')}
                                  </span>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="py-1 px-2.5 shrink-0"
                                    disabled={!!extractingTrack || loadingURLs[key]}
                                    onClick={() => downloadAudioTrack(activeFile, i, t)}
                                    title={t('tool-videometa.ui.downloadAudioTitle')}
                                  >
                                    {isExtracting ? (
                                      <>
                                        <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full" />
                                        <span>{extractProgress}%</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        <span>{t('tool-videometa.ui.download')}</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <div className="mt-1 bg-app border border-border rounded-lg p-2.5">
                                  {audioURLs[key] ? (
                                    <MediaSeparatorWaveform audioURL={audioURLs[key]} className="w-full" />
                                  ) : (
                                    <div className="flex justify-center items-center h-12">
                                      <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full mr-2" />
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('tool-videometa.ui.generatingWaveform')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeFile.subtitleTracks.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83d\udcac'}</span> {t('videometa-extra.subtitles')}</h3>
                        <div className="flex flex-col gap-2">{activeFile.subtitleTracks.map((track, i) => <div className="flex items-center gap-2.5 p-2 px-3 bg-app rounded-lg text-[0.84rem]" key={i}><span className="text-base shrink-0">{'\ud83d\udcdd'}</span><span className="font-semibold text-text-main min-w-[50px]">{t('video-units.track', { number: i + 1 })}</span><span className="text-text-muted flex-1">{[track.codec, track.language && track.language !== 'und' ? `(${track.language})` : null].filter(Boolean).join(' ')}</span></div>)}</div>
                      </div>
                    )}

                    {activeFile.timecodeTracks.length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\u23f1\ufe0f'}</span> {t('videometa-extra.timecode')}</h3>
                        {activeFile.timecodeTracks.map((t, i) => { const fps = t.timecodeTimescale && t.timecodeFrameDuration ? t.timecodeTimescale / t.timecodeFrameDuration : t.timecodeNumFrames || 30; const isDF = (t.timecodeFlags & 0x01) !== 0; const tc = t.timecodeStartFrame != null ? frameCountToTimecode(t.timecodeStartFrame, fps, isDF) : null; return (
                          <dl className="flex flex-col m-0" key={i}>{[[translate('metadata-fields.startTimecode'), tc], [translate('metadata-fields.frameRate'), fps ? `${fps} fps` : null], [translate('metadata-fields.type'), isDF ? translate('tool-videometa.ui.dropFrame') : translate('tool-videometa.ui.nonDropFrame')]].filter(([, v]) => v != null).map(([k, v]) => <div className="flex gap-2 py-1.5 border-b border-border last:border-b-0 text-[0.84rem]" key={k}><dt className="w-[100px] sm:w-[130px] shrink-0 text-text-muted font-medium">{k}</dt><dd className="text-text-main m-0 break-all flex-1">{v}</dd></div>)}</dl>
                        ); })}
                      </div>
                    )}

                    {Object.keys(activeFile.metadata).length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83c\udff7\ufe0f'}</span> {t('videometa-extra.metadata')}</h3>
                        <dl className="flex flex-col m-0">{Object.entries(activeFile.metadata).map(([k, v]) => <div className="flex gap-2 py-1.5 border-b border-border last:border-b-0 text-[0.84rem]" key={k}><dt className="w-[100px] sm:w-[130px] shrink-0 text-text-muted font-medium">{k}</dt><dd className="text-text-main m-0 break-all flex-1">{String(v)}</dd></div>)}</dl>
                      </div>
                    )}

                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83d\udce6'}</span> {t('videometa-extra.container')}</h3>
                      <dl className="flex flex-col m-0">{[[t('metadata-fields.format'), activeFile.format], [t('metadata-fields.brand'), activeFile.brand], [t('metadata-fields.compatibleBrands'), activeFile.compatibleBrands.length > 0 ? activeFile.compatibleBrands.join(', ') : null], [t('metadata-fields.duration'), formatDuration(activeFile.containerDuration)], [t('metadata-fields.fileSize'), activeFile.formattedSize], [t('metadata-fields.totalTracks'), (activeFile.videoTracks.length + activeFile.audioTracks.length + activeFile.subtitleTracks.length + activeFile.timecodeTracks.length).toString()]].filter(([, v]) => v != null && v !== '\u2014').map(([k, v]) => <div className="flex gap-2 py-1.5 border-b border-border last:border-b-0 text-[0.84rem]" key={k}><dt className="w-[100px] sm:w-[130px] shrink-0 text-text-muted font-medium">{k}</dt><dd className="text-text-main m-0 break-all flex-1">{v}</dd></div>)}</dl>
                    </div>
                  </div>
                )}

                {activeFile.type === 'log' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activeFile.logParams && Object.keys(activeFile.logParams).length > 0 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83d\udcc4'}</span> {t('videometa-extra.parsedParameters')}</h3>
                        <dl className="flex flex-col m-0">{Object.entries(activeFile.logParams).map(([k, v]) => <div className="flex gap-2 py-1.5 border-b border-border last:border-b-0 text-[0.84rem]" key={k}><dt className="w-[100px] sm:w-[130px] shrink-0 text-text-muted font-medium">{k}</dt><dd className="text-text-main m-0 break-all flex-1">{v}</dd></div>)}</dl>
                      </div>
                    )}
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="text-[0.88rem] font-bold text-text-main m-0 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><span className="text-base">{'\ud83d\udcdd'}</span> {t('videometa-extra.rawContent')}</h3>
                      <div className="bg-app border border-border rounded-lg p-3.5 max-h-[400px] overflow-y-auto font-mono text-[0.8rem] leading-relaxed text-text-main whitespace-pre-wrap break-all">{activeFile.logRawText}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All Parameters Tab */}
            {activeTab === 'all' && activeFile && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3.5 py-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input type="text" placeholder={t('tool-videometa.ui.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 border-none bg-transparent text-[0.9rem] text-text-main outline-none placeholder:text-text-muted" id="videometa-search-input" />
                  {searchQuery && <button className="bg-none border-none text-text-muted cursor-pointer text-base px-0.5 leading-none hover:text-text-main" onClick={() => setSearchQuery('')}>{'\u00d7'}</button>}
                </div>
                {filteredParamGroups.length === 0 ? <p className="text-text-muted text-[0.85rem] italic mt-2">{t('tool-videometa.ui.noMatch')}</p> : filteredParamGroups.map(group => (
                  <div key={group.key} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button className="flex items-center gap-2 w-full px-4 py-3 bg-transparent border-none border-b border-border cursor-pointer text-[0.88rem] font-semibold text-text-main text-left transition-colors hover:bg-nav-hover-bg" onClick={() => toggleGroup(group.key)} id={`videometa-group-${group.key}`}>
                      <span>{group.icon} {group.label}</span>
                      <span className="ml-auto text-[0.75rem] text-text-muted bg-app px-1.5 py-0.5 rounded-lg mr-1">{group.rows.length}</span>
                      <svg className={`transition-transform duration-200 text-text-muted shrink-0${collapsedGroups[group.key] ? ' -rotate-90' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {!collapsedGroups[group.key] && <table className="w-full border-collapse"><tbody>{group.rows.map(([k, v]) => <tr key={k} className="hover:bg-nav-hover-bg/30"><td className="px-4 py-2 w-[150px] sm:w-[200px] text-[0.83rem] text-text-muted font-medium border-b border-border last:border-b-0 align-top">{k}</td><td className="px-4 py-2 text-[0.83rem] text-text-main border-b border-border last:border-b-0 break-all align-top">{v}</td></tr>)}</tbody></table>}
                  </div>
                ))}
              </div>
            )}

            {/* Compare Tab */}
            {activeTab === 'compare' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-[0.85rem] text-text-muted m-0">{t('tool-videometa.ui.selectCompare')}</p>
                  <div className="flex flex-wrap gap-2">{files.map(f => <button key={f.id} className={`flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg border border-border bg-card text-[0.82rem] text-text-muted cursor-pointer transition-colors max-w-[200px] truncate hover:border-indigo-500 hover:text-text-main ${compareSelectedIds.includes(f.id) ? 'border-indigo-500 bg-indigo-500/10 text-text-main font-medium' : ''}`} onClick={() => toggleCompare(f.id)}><FormatBadge format={f.format} />{f.name}</button>)}</div>
                </div>
                {compareFiles.length >= 1 ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full border-collapse min-w-[400px]">
                      <thead><tr><th className="p-2.5 px-3.5 bg-app text-[0.8rem] font-semibold text-text-muted text-left border-b border-border whitespace-nowrap">{t('video-units.parameter')}</th>{compareFiles.map(f => <th key={f.id} className="p-2.5 px-3.5 bg-app text-[0.8rem] font-semibold text-text-muted text-left border-b border-border whitespace-nowrap"><div className="flex items-center gap-2 max-w-[180px] overflow-hidden">{f.thumbnailUrl ? <img src={f.thumbnailUrl} className="w-10 h-6.5 rounded object-cover shrink-0" alt="" /> : <DefaultThumbnail format={f.format} width={40} height={26} />}<span className="truncate" title={f.name}>{f.name}</span></div></th>)}</tr></thead>
                      <tbody>{COMPARE_FIELDS.map(field => <tr key={field.labelKey} className="hover:bg-nav-hover-bg/30"><td className="p-2 px-3.5 text-[0.83rem] text-text-muted font-medium border-b border-border align-top whitespace-nowrap w-[130px]">{t(field.labelKey)}</td>{compareFiles.map(f => <td key={f.id} className="p-2 px-3.5 text-[0.83rem] text-text-main border-b border-border align-top min-w-[140px]">{field.fn(f, t)}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                ) : <p className="text-text-muted text-[0.85rem] italic mt-2">{t('tool-videometa.ui.selectAtLeastOne')}</p>}
              </div>
            )}
          </main>
        </div>
      )}
    </Card>
  );
}
