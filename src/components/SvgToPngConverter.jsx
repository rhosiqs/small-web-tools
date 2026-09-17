import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';
import Card from './ui/Card';
import FullscreenPreview, {
  FullscreenPreviewButton,
  TRANSPARENT_PREVIEW_CLASS,
} from './ui/FullscreenPreview';
import ToolHeader from './ui/ToolHeader';
import {
  calculateLockedDimension,
  inspectAndSanitizeSvg,
  validateExportSize,
} from './SvgToPngConverter/lib/svgDomain';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ERROR_KEYS = {
  'Paste SVG markup or choose an SVG file.': 'missingSource',
  'The SVG markup is not valid XML.': 'invalidXml',
  'The document must have an <svg> root element.': 'missingRoot',
  'Width and height must be positive whole numbers.': 'positiveDimensions',
  'Each dimension must be 8,192 pixels or less.': 'dimensionLimit',
  'The output must be 40 megapixels or less.': 'megapixelLimit',
};

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SvgToPngConverter() {
  const { t, i18n } = useTranslation('tools');
  const fileInputRef = useRef(null);
  const [markup, setMarkup] = useState('');
  const [filename, setFilename] = useState('converted');
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [lockRatio, setLockRatio] = useState(true);
  const [background, setBackground] = useState('transparent');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [status, setStatus] = useState('');

  const parsed = useMemo(() => inspectAndSanitizeSvg(markup), [markup]);
  const previewUrl = useMemo(() => {
    if (!parsed.markup) return '';
    return URL.createObjectURL(new Blob([parsed.markup], { type: 'image/svg+xml' }));
  }, [parsed.markup]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!parsed.markup) return;
    setWidth(Math.max(1, Math.round(parsed.width)));
    setHeight(Math.max(1, Math.round(parsed.height)));
  }, [parsed.markup, parsed.width, parsed.height]);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus(t('tool-svg-png.ui.status.fileTooLarge'));
      return;
    }
    const text = await file.text();
    setPreviewOpen(false);
    setMarkup(text);
    setFilename(file.name.replace(/\.svg$/i, '') || 'converted');
    setStatus('');
  };

  const updateDimension = (axis, rawValue) => {
    const nextValue = Number(rawValue);
    if (axis === 'width') setWidth(nextValue);
    else setHeight(nextValue);
    if (!lockRatio || !parsed.markup) return;

    const ratio = parsed.width / parsed.height;
    const lockedValue = calculateLockedDimension(axis, rawValue, ratio);
    if (lockedValue === null) return;
    if (axis === 'width') setHeight(lockedValue);
    else setWidth(lockedValue);
  };

  const exportPng = () => {
    const exportError = validateExportSize(width, height);
    if (!parsed.markup || exportError) {
      const error = exportError || parsed.error;
      setStatus(t(`tool-svg-png.ui.error.${ERROR_KEYS[error]}`));
      return;
    }

    const svgUrl = URL.createObjectURL(new Blob([parsed.markup], { type: 'image/svg+xml' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (background === 'white') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          setStatus(t('tool-svg-png.ui.status.createFailed'));
          return;
        }
        downloadBlob(blob, `${filename.trim() || 'converted'}.png`);
        setStatus(t('tool-svg-png.ui.status.downloaded', {
          width: width.toLocaleString(i18n.language),
          height: height.toLocaleString(i18n.language),
        }));
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setStatus(t('tool-svg-png.ui.status.renderFailed'));
    };
    image.src = svgUrl;
  };

  const sizeError = validateExportSize(width, height);
  const ready = Boolean(parsed.markup) && !sizeError;

  return (
    <Card id="tool-svg-png" variant="tool" size="wide" className="max-w-[980px]">
      <ToolHeader title={t('tool-svg-png.title')} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="svg-source-title">
          <div>
            <h2 id="svg-source-title" className="text-sm font-bold text-text-main">{t('tool-svg-png.ui.sourceTitle')}</h2>
            <p className="text-xs text-text-muted">{t('tool-svg-png.ui.privacyNote')}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {t('tool-svg-png.ui.chooseFile')}
          </Button>

          <label htmlFor="svg-markup" className="text-sm font-semibold text-text-main">
            {t('tool-svg-png.ui.pasteMarkup')}
          </label>
          <textarea
            id="svg-markup"
            value={markup}
            onChange={(event) => {
              setPreviewOpen(false);
              setMarkup(event.target.value);
              setStatus('');
            }}
            spellCheck="false"
            placeholder="<svg …>…</svg>"
            className="min-h-56 w-full resize-y rounded-xl border border-border bg-app p-3 font-mono text-sm text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus"
          />
          {markup && parsed.error && <p role="alert" className="text-sm text-red-500">{t(`tool-svg-png.ui.error.${ERROR_KEYS[parsed.error]}`)}</p>}
          {parsed.removedItems > 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-text-main">
              {t('tool-svg-png.ui.removedItems', {
                count: parsed.removedItems,
                formattedCount: parsed.removedItems.toLocaleString(i18n.language),
              })}
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="svg-output-title">
          <h2 id="svg-output-title" className="text-sm font-bold text-text-main">{t('tool-svg-png.ui.outputTitle')}</h2>
          <div
            data-preview-background={background}
            className={`relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-border p-4 ${
              background === 'white' ? 'bg-white' : TRANSPARENT_PREVIEW_CLASS
            }`}
          >
            <FullscreenPreviewButton
              disabled={!previewUrl}
              label={t('tool-svg-png.ui.openFullscreen')}
              onClick={() => setPreviewOpen(true)}
            />
            {previewUrl ? (
              <img src={previewUrl} alt={t('tool-svg-png.ui.previewAlt')} className="max-h-72 max-w-full object-contain" />
            ) : (
              <span className="text-sm text-text-muted">{t('tool-svg-png.ui.emptyPreview')}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
              {t('tool-svg-png.ui.width')}
              <input
                type="number"
                min="1"
                max="8192"
                step="1"
                value={width}
                onChange={(event) => updateDimension('width', event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-base text-text-main outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
              {t('tool-svg-png.ui.height')}
              <input
                type="number"
                min="1"
                max="8192"
                step="1"
                value={height}
                onChange={(event) => updateDimension('height', event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-base text-text-main outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-main">
            <input type="checkbox" checked={lockRatio} onChange={(event) => setLockRatio(event.target.checked)} />
            {t('tool-svg-png.ui.lockRatio')}
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            {t('tool-svg-png.ui.background')}
            <select
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
            >
              <option value="transparent">{t('tool-svg-png.ui.transparent')}</option>
              <option value="white">{t('tool-svg-png.ui.white')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            {t('tool-svg-png.ui.filename')}
            <input
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
            />
          </label>

          {sizeError && <p role="alert" className="text-sm text-red-500">{t(`tool-svg-png.ui.error.${ERROR_KEYS[sizeError]}`)}</p>}
          <Button variant="primary" disabled={!ready} onClick={exportPng}>{t('tool-svg-png.ui.download')}</Button>
          {status && <p role="status" className="text-xs text-text-muted">{status}</p>}
        </section>
      </div>

      <FullscreenPreview
        open={previewOpen && Boolean(previewUrl)}
        onClose={() => setPreviewOpen(false)}
        title={t('tool-svg-png.ui.fullscreenTitle')}
        surfaceClassName={background === 'white' ? 'bg-white' : TRANSPARENT_PREVIEW_CLASS}
      >
        <img
          src={previewUrl}
          alt={t('tool-svg-png.ui.fullscreenAlt')}
          className="max-h-[76vh] max-w-full object-contain"
        />
      </FullscreenPreview>
    </Card>
  );
}
