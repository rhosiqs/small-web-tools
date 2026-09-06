import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Card from './ui/Card';
import FullscreenPreview, { FullscreenPreviewButton } from './ui/FullscreenPreview';
import ToolHeader from './ui/ToolHeader';
import {
  MERMAID_SOURCE_LIMIT,
  PNG_SCALES,
  downloadBlob,
  normalizeMermaidFilename,
  renderMermaidToSvg,
  svgToPngBlob,
} from './MermaidConverter/lib/mermaidDomain.js';

const SAMPLE = `flowchart LR
  Start([Write Mermaid]) --> Preview[Preview locally]
  Preview --> Export{Export format}
  Export --> SVG[SVG]
  Export --> PNG[PNG]`;

function SvgPreview({ render, label, className = '', previewRef }) {
  if (!render) return <div ref={previewRef} className={`flex h-full min-h-0 items-center justify-center p-8 text-center text-sm text-text-muted ${className}`}>{label}</div>;
  return <div ref={previewRef} className={`h-full min-h-0 overflow-auto p-5 ${className}`} aria-label={label}><div className="mx-auto w-fit max-w-full" dangerouslySetInnerHTML={{ __html: render.svg }} /></div>;
}

export default function MermaidConverter() {
  const { t, i18n } = useTranslation('tools');
  const [source, setSource] = useState(SAMPLE);
  const [filename, setFilename] = useState('diagram.mmd');
  const [backgroundMode, setBackgroundMode] = useState('solid');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [pngScale, setPngScale] = useState(2);
  const [render, setRender] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [focusedPanel, setFocusedPanel] = useState(null);
  const renderSequence = useRef(0);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const fullscreenTextareaRef = useRef(null);
  const previewRef = useRef(null);
  const fullscreenPreviewRef = useRef(null);

  const background = backgroundMode === 'transparent' ? 'transparent' : backgroundColor;
  const previewAria = t('tool-mermaid.ui.previewAria');
  const characterCount = useMemo(() => source.length.toLocaleString(i18n.language), [i18n.language, source.length]);
  const currentRender = render
    && render.sourceSnapshot === source
    && render.backgroundSnapshot === background
    && render.ariaLabelSnapshot === previewAria
    ? render
    : null;

  const performRender = useCallback(async ({ sequence, sourceSnapshot, backgroundSnapshot, ariaLabelSnapshot }) => {
    setError('');
    setStatus(t('tool-mermaid.ui.status.rendering'));
    try {
      const next = await renderMermaidToSvg(sourceSnapshot, {
        background: backgroundSnapshot,
        ariaLabel: ariaLabelSnapshot,
      });
      if (sequence !== renderSequence.current) return;
      setRender({ ...next, sourceSnapshot, backgroundSnapshot, ariaLabelSnapshot });
      setStatus(t('tool-mermaid.ui.status.rendered'));
    } catch (cause) {
      if (sequence !== renderSequence.current) return;
      setRender(null);
      setStatus('');
      setError(t(`tool-mermaid.ui.errors.${cause instanceof Error ? cause.message : 'parseError'}`));
    }
  }, [t]);

  const requestRender = useCallback(() => {
    const sequence = ++renderSequence.current;
    setRender(null);
    void performRender({
      sequence,
      sourceSnapshot: source,
      backgroundSnapshot: background,
      ariaLabelSnapshot: previewAria,
    });
  }, [background, performRender, previewAria, source]);

  useEffect(() => {
    const sequence = ++renderSequence.current;
    const timeout = window.setTimeout(() => void performRender({
      sequence,
      sourceSnapshot: source,
      backgroundSnapshot: background,
      ariaLabelSnapshot: previewAria,
    }), 400);
    return () => window.clearTimeout(timeout);
  }, [background, performRender, previewAria, source]);

  const handlePaste = async () => {
    try {
      setSource(await navigator.clipboard.readText());
      setStatus(t('tool-mermaid.ui.status.pasted'));
    } catch {
      setError(t('tool-mermaid.ui.errors.clipboardDenied'));
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.mmd$/i.test(file.name)) { setError(t('tool-mermaid.ui.errors.invalidFile')); return; }
    if (file.size > MERMAID_SOURCE_LIMIT) { setError(t('tool-mermaid.ui.errors.tooLarge')); return; }
    setSource(await file.text());
    setFilename(normalizeMermaidFilename(file.name, 'mmd'));
    setStatus(t('tool-mermaid.ui.status.loaded', { filename: file.name }));
  };

  const downloadMmd = () => {
    const name = normalizeMermaidFilename(filename, 'mmd');
    downloadBlob(source, 'text/plain;charset=utf-8', name);
    setStatus(t('tool-mermaid.ui.status.downloaded', { filename: name }));
  };

  const downloadSvg = () => {
    if (!currentRender) return;
    const name = normalizeMermaidFilename(filename, 'svg');
    downloadBlob(currentRender.svg, 'image/svg+xml;charset=utf-8', name);
    setStatus(t('tool-mermaid.ui.status.downloaded', { filename: name }));
  };

  const downloadPng = async () => {
    if (!currentRender) return;
    try {
      const blob = await svgToPngBlob(currentRender, pngScale);
      const name = normalizeMermaidFilename(filename, 'png');
      downloadBlob(blob, 'image/png', name);
      setStatus(t('tool-mermaid.ui.status.downloaded', { filename: name }));
    } catch (cause) {
      setError(t(`tool-mermaid.ui.errors.${cause instanceof Error ? cause.message : 'pngFailed'}`));
    }
  };

  const clear = () => {
    renderSequence.current += 1;
    setSource('');
    setRender(null);
    setError('');
    setStatus(t('tool-mermaid.ui.status.cleared'));
    textareaRef.current?.focus();
  };

  return (
    <Card id="tool-mermaid" variant="tool" size="wide" className="max-w-[1180px]">
      <ToolHeader title={t('tool-mermaid.title')} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-app/60 p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handlePaste}>{t('tool-mermaid.ui.paste')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>{t('tool-mermaid.ui.upload')}</Button>
          <input ref={fileInputRef} type="file" accept=".mmd,text/plain" onChange={handleFile} className="hidden" aria-label={t('tool-mermaid.ui.uploadAria')} />
          <Button type="button" variant="primary" size="sm" onClick={requestRender} disabled={!source.trim()}>{t('tool-mermaid.ui.render')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={clear} disabled={!source}>{t('tool-mermaid.ui.clear')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mermaid-filename" className="sr-only">{t('tool-mermaid.ui.filename')}</label>
          <input id="mermaid-filename" value={filename} onChange={(event) => setFilename(event.target.value)} aria-label={t('tool-mermaid.ui.filename')} className="w-40 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus" />
          <Button type="button" variant="secondary" size="sm" onClick={downloadMmd} disabled={!source}>{t('tool-mermaid.ui.downloadMmd')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={downloadSvg} disabled={!currentRender}>{t('tool-mermaid.ui.downloadSvg')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void downloadPng()} disabled={!currentRender}>{t('tool-mermaid.ui.downloadPng')}</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-app/40 p-3">
        <label className="grid gap-1 text-xs font-semibold text-text-muted">{t('tool-mermaid.ui.backgroundMode')}<select value={backgroundMode} onChange={(event) => setBackgroundMode(event.target.value)} className="rounded-lg border border-border bg-app px-3 py-2 text-sm text-text-main outline-none focus:border-accent"><option value="solid">{t('tool-mermaid.ui.solid')}</option><option value="transparent">{t('tool-mermaid.ui.transparent')}</option></select></label>
        {backgroundMode === 'solid' && <label className="grid gap-1 text-xs font-semibold text-text-muted">{t('tool-mermaid.ui.background')}<input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} className="h-9 w-16 rounded-lg border border-border bg-app" /></label>}
        <label className="grid gap-1 text-xs font-semibold text-text-muted">{t('tool-mermaid.ui.pngScale')}<select value={pngScale} onChange={(event) => setPngScale(Number(event.target.value))} className="rounded-lg border border-border bg-app px-3 py-2 text-sm text-text-main outline-none focus:border-accent">{PNG_SCALES.map((scale) => <option key={scale} value={scale}>{scale}×</option>)}</select></label>
        <p className="text-xs text-text-muted">{t('tool-mermaid.ui.localOnly')}</p>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:h-[560px] lg:grid-cols-2">
        <section className="flex min-h-[420px] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r" aria-labelledby="mermaid-editor-title">
          <div className="relative flex min-h-12 items-center justify-between border-b border-border bg-app/70 px-4 py-2 pr-14"><h3 id="mermaid-editor-title" className="text-sm font-bold text-text-main">{t('tool-mermaid.ui.editorTitle')}</h3><span className="text-xs tabular-nums text-text-muted">{t('tool-mermaid.ui.characterCount', { count: characterCount })}</span><FullscreenPreviewButton label={t('tool-mermaid.ui.expandEditor')} onClick={() => setFocusedPanel('editor')} /></div>
          <textarea ref={textareaRef} value={source} onChange={(event) => { setSource(event.target.value); setStatus(''); }} spellCheck="false" aria-label={t('tool-mermaid.ui.editorAria')} className="min-h-[370px] flex-1 resize-none bg-card p-5 font-mono text-sm leading-6 text-text-main outline-none focus:ring-2 focus:ring-inset focus:ring-focus lg:min-h-0" />
        </section>
        <section className="flex min-h-[420px] min-w-0 flex-col lg:min-h-0" aria-labelledby="mermaid-preview-title">
          <div className="relative flex min-h-12 items-center justify-between border-b border-border bg-app/70 px-4 py-2 pr-14"><h3 id="mermaid-preview-title" className="text-sm font-bold text-text-main">{t('tool-mermaid.ui.previewTitle')}</h3><FullscreenPreviewButton label={t('tool-mermaid.ui.expandPreview')} onClick={() => setFocusedPanel('preview')} /></div>
          <SvgPreview render={currentRender} previewRef={previewRef} label={currentRender ? previewAria : t('tool-mermaid.ui.emptyPreview')} />
        </section>
      </div>
      {(status || error) && <p role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'text-danger' : 'text-text-muted'}`}>{error || status}</p>}
      <FullscreenPreview open={focusedPanel !== null} title={focusedPanel === 'editor' ? t('tool-mermaid.ui.editorTitle') : t('tool-mermaid.ui.previewTitle')} onClose={() => setFocusedPanel(null)}>
        {focusedPanel === 'editor' ? <textarea ref={fullscreenTextareaRef} value={source} onChange={(event) => setSource(event.target.value)} spellCheck="false" className="h-full w-full resize-none bg-card p-5 font-mono text-sm leading-6 text-text-main outline-none" aria-label={t('tool-mermaid.ui.editorAria')} /> : <SvgPreview render={currentRender} previewRef={fullscreenPreviewRef} label={currentRender ? previewAria : t('tool-mermaid.ui.emptyPreview')} className="bg-card" />}
      </FullscreenPreview>
    </Card>
  );
}
