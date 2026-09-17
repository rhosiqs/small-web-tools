import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import FullscreenPreview, { FullscreenPreviewButton } from './ui/FullscreenPreview.jsx';
import ToolHeader from './ui/ToolHeader.jsx';
import {
  CODE_FILE_LIMIT_BYTES,
  CODE_LANGUAGES,
  getDefaultFilename,
  getLineCount,
  getSyntaxTheme,
  highlightCode,
  inferLanguageFromFilename,
  normalizeCodeFilename,
} from './CodePreviewer/lib/codePreviewDomain.js';

const FONT_OPTIONS = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'System monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace' },
];

const THEME_PRESETS = {
  light: {
    label: 'Light',
    accentColor: '#339CFF',
    backgroundColor: '#FFFFFF',
    foregroundColor: '#1A1C1F',
  },
  dark: {
    label: 'Dark',
    accentColor: '#339CFF',
    backgroundColor: '#181818',
    foregroundColor: '#FFFFFF',
  },
};

function getSystemPalette() {
  const isDark = document.documentElement.dataset.theme === 'dark'
    || window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return {
    ...(isDark ? THEME_PRESETS.dark : THEME_PRESETS.light),
    label: 'System',
  };
}

function triggerDownload(href, filename) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function ColorControl({ label, value, onChange }) {
  const { t } = useTranslation('tools');
  return (
    <label className="flex items-center justify-between gap-4 border-b border-border/70 py-3 text-sm font-semibold text-text-main last:border-b-0">
      <span>{label}</span>
      <span className="flex w-36 items-center gap-2 rounded-lg border border-border bg-app px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
          aria-label={t('tool-code-preview.ui.colorAria', { label })}
        />
        <span className="font-mono text-xs font-normal uppercase text-text-main">{value}</span>
      </span>
    </label>
  );
}

export default function CodePreviewer() {
  const { t, i18n } = useTranslation('tools');
  const initialPalette = THEME_PRESETS.dark;
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [accentColor, setAccentColor] = useState(initialPalette.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(initialPalette.backgroundColor);
  const [foregroundColor, setForegroundColor] = useState(initialPalette.foregroundColor);
  const [selectedTheme, setSelectedTheme] = useState('dark');
  const [filename, setFilename] = useState(getDefaultFilename('javascript'));
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ top: 0, left: 0 });
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const editorRef = useRef(null);

  const highlightedCode = useMemo(() => highlightCode(code, language), [code, language]);
  const lineCount = getLineCount(code);
  const syntaxTheme = getSyntaxTheme(backgroundColor);
  /** @type {React.CSSProperties & Record<string, string>} */
  const editorStyle = {
    '--code-accent': accentColor,
    backgroundColor,
    color: foregroundColor,
    fontFamily,
  };
  const translatedContentStyle = {
    transform: `translate(${-scrollPosition.left}px, ${-scrollPosition.top}px)`,
  };

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  const applyTheme = (themeId) => {
    const palette = themeId === 'system' ? getSystemPalette() : THEME_PRESETS[themeId];
    setSelectedTheme(themeId);
    setAccentColor(palette.accentColor);
    setBackgroundColor(palette.backgroundColor);
    setForegroundColor(palette.foregroundColor);
  };

  const handleLanguageChange = (nextLanguage) => {
    const previousDefault = getDefaultFilename(language);
    setLanguage(nextLanguage);
    if (filename === previousDefault) setFilename(getDefaultFilename(nextLanguage));
    setStatus('');
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setCode(clipboardText);
      setStatus(t('tool-code-preview.ui.status.pasted'));
      textareaRef.current?.focus();
    } catch {
      setStatus(t('tool-code-preview.ui.status.pasteDenied'));
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(t('tool-code-preview.ui.status.copied'));
    } catch {
      setStatus(t('tool-code-preview.ui.status.copyDenied'));
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > CODE_FILE_LIMIT_BYTES) {
      setStatus(t('tool-code-preview.ui.status.fileTooLarge'));
      return;
    }

    try {
      const nextLanguage = inferLanguageFromFilename(file.name);
      setCode(await file.text());
      setLanguage(nextLanguage);
      setFilename(file.name);
      setStatus(t('tool-code-preview.ui.status.loaded', { filename: file.name }));
    } catch {
      setStatus(t('tool-code-preview.ui.status.readFailed'));
    }
  };

  const handleSourceDownload = () => {
    const downloadName = normalizeCodeFilename(filename, language);
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, downloadName);
    URL.revokeObjectURL(url);
    setFilename(downloadName);
    setStatus(t('tool-code-preview.ui.status.downloaded', { filename: downloadName }));
  };

  const handlePngDownload = async () => {
    if (!editorRef.current || !code) return;
    setExporting(true);
    setStatus(t('tool-code-preview.ui.status.preparingPng'));
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(editorRef.current, {
        backgroundColor,
        cacheBust: false,
        pixelRatio: 2,
        preferredFontFormat: 'woff2',
        filter: (node) => !node.classList?.contains('code-editor-input')
          && !node.classList?.contains('fullscreen-preview-control'),
      });
      const sourceName = normalizeCodeFilename(filename, language);
      const imageName = `${sourceName.replace(/\.[^.]+$/, '') || 'code'}-vscode.png`;
      triggerDownload(dataUrl, imageName);
      setStatus(t('tool-code-preview.ui.status.downloaded', { filename: imageName }));
    } catch {
      setStatus(t('tool-code-preview.ui.status.pngFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    setPreviewOpen(false);
    setCode('');
    setScrollPosition({ top: 0, left: 0 });
    setStatus(t('tool-code-preview.ui.status.cleared'));
    textareaRef.current?.focus();
  };

  return (
    <Card id="tool-code-preview" variant="tool" size="wide" className="max-w-[1040px]">
      <ToolHeader title={t('tool-code-preview.title')} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-app/60 p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handlePaste}>{t('tool-code-preview.ui.paste')}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleCopy} disabled={!code}>
            {t('tool-code-preview.ui.copy')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            {t('tool-code-preview.ui.upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="text/*,.js,.jsx,.ts,.tsx,.html,.css,.json,.md,.py,.java,.c,.h,.cpp,.cs,.go,.rs,.php,.rb,.swift,.kt,.r,.sql,.yml,.yaml,.sh,.diff,.patch,.graphql,.gql,.lua,.pl"
            onChange={handleFile}
            className="hidden"
            aria-label={t('tool-code-preview.ui.uploadAria')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="code-filename" className="sr-only">{t('tool-code-preview.ui.downloadFilename')}</label>
          <input
            id="code-filename"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            className="w-40 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus"
            aria-label={t('tool-code-preview.ui.downloadFilename')}
          />
          <Button type="button" variant="primary" size="sm" onClick={handleSourceDownload} disabled={!code}>
            {t('tool-code-preview.ui.downloadSource')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handlePngDownload} disabled={!code || exporting}>
            {t(exporting ? 'tool-code-preview.ui.exporting' : 'tool-code-preview.ui.downloadPng')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            {t('tool-code-preview.ui.appearance')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleClear} disabled={!code}>{t('tool-code-preview.ui.clear')}</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="vscode-editor-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-app/70 px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <h2 id="vscode-editor-title" className="truncate text-xs font-semibold text-text-muted">
              {normalizeCodeFilename(filename, language)}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="code-language" className="sr-only">{t('tool-code-preview.ui.language')}</label>
            <select
              id="code-language"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="max-w-44 rounded-md border border-border bg-card px-2 py-1 text-xs text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus"
            >
              {CODE_LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <span className="whitespace-nowrap text-xs tabular-nums text-text-muted">
              {t('tool-code-preview.ui.lineCount', { count: lineCount, formattedCount: lineCount.toLocaleString(i18n.language) })}
            </span>
          </div>
        </div>

        <div
          ref={editorRef}
          data-code-theme={syntaxTheme}
          className="code-preview-syntax code-editor-surface relative h-[520px] overflow-hidden"
          style={editorStyle}
          aria-label={t('tool-code-preview.ui.editorAria')}
        >
          <FullscreenPreviewButton
            disabled={!code}
            label={t('tool-code-preview.ui.openFullscreen')}
            onClick={() => setPreviewOpen(true)}
          />
          <div className="code-editor-line-numbers absolute inset-y-0 left-0 w-14 overflow-hidden border-r border-current/10 bg-black/5">
            <div className="min-h-full py-5 text-right text-sm leading-6 opacity-45" style={{ transform: `translateY(${-scrollPosition.top}px)` }}>
              {Array.from({ length: lineCount }, (_, index) => <div key={index} className="pr-3">{index + 1}</div>)}
            </div>
          </div>

          <pre
            className="code-editor-highlight pointer-events-none absolute inset-y-0 left-14 right-0 m-0 min-w-full overflow-hidden p-5 text-sm leading-6"
            style={translatedContentStyle}
            aria-hidden="true"
          >
            <code dangerouslySetInnerHTML={{ __html: highlightedCode || `<span class="code-editor-placeholder">${t('tool-code-preview.ui.placeholder')}</span>` }} />
          </pre>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setStatus('');
            }}
            onScroll={(event) => setScrollPosition({
              top: event.currentTarget.scrollTop,
              left: event.currentTarget.scrollLeft,
            })}
            spellCheck={false}
            wrap="off"
            aria-label={t('tool-code-preview.ui.codeEditorAria')}
            className="code-editor-input absolute inset-y-0 left-14 right-0 h-full w-auto resize-none overflow-auto border-0 bg-transparent p-5 text-sm leading-6 outline-none focus:ring-0"
            style={{ caretColor: accentColor, fontFamily }}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <p>{t('tool-code-preview.ui.privacyNote')}</p>
        <p role="status" aria-live="polite">{status}</p>
      </div>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-border bg-card p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
              <div>
                <h2 id="appearance-dialog-title" className="text-lg font-bold text-text-main">{t('tool-code-preview.ui.appearanceTitle')}</h2>
                <p className="mt-1 text-xs text-text-muted">{t('tool-code-preview.ui.appearanceDescription')}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSettingsOpen(false)}>
                {t('tool-code-preview.ui.close')}
              </Button>
            </div>

            <div className="my-3 grid grid-cols-3 gap-2" role="group" aria-label={t('tool-code-preview.ui.editorTheme')}>
              {['system', 'light', 'dark'].map((themeId) => {
                return (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => applyTheme(themeId)}
                    aria-pressed={selectedTheme === themeId}
                    className={[
                      'rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-focus',
                      selectedTheme === themeId
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-border bg-app text-text-main hover:border-border-hover',
                    ].join(' ')}
                  >
                    {t(`tool-code-preview.ui.theme.${themeId}`)}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-card px-3">
              <ColorControl label={t('tool-code-preview.ui.accent')} value={accentColor} onChange={(value) => {
                setAccentColor(value);
                setSelectedTheme('custom');
              }} />
              <ColorControl label={t('tool-code-preview.ui.background')} value={backgroundColor} onChange={(value) => {
                setBackgroundColor(value);
                setSelectedTheme('custom');
              }} />
              <ColorControl label={t('tool-code-preview.ui.foreground')} value={foregroundColor} onChange={(value) => {
                setForegroundColor(value);
                setSelectedTheme('custom');
              }} />
              <label className="flex items-center justify-between gap-4 py-3 text-sm font-semibold text-text-main">
                <span>{t('tool-code-preview.ui.codeFont')}</span>
                <select
                  value={fontFamily}
                  onChange={(event) => setFontFamily(event.target.value)}
                  className="w-48 rounded-lg border border-border bg-app px-3 py-2 text-sm font-normal text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus"
                >
                  {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                </select>
              </label>
            </div>
          </section>
        </div>
      )}

      <FullscreenPreview
        open={previewOpen && Boolean(code)}
        onClose={() => setPreviewOpen(false)}
        title={t('tool-code-preview.ui.fullscreenTitle')}
        surfaceClassName="bg-transparent !p-0"
      >
        <div
          data-code-theme={syntaxTheme}
          className="code-preview-syntax code-editor-surface relative max-h-[82vh] min-h-[420px] w-full overflow-auto rounded-lg"
          style={editorStyle}
        >
          <div className="code-editor-line-numbers absolute inset-y-0 left-0 w-14 border-r border-current/10 bg-black/5">
            <div className="min-h-full py-5 text-right text-sm leading-6 opacity-45">
              {Array.from({ length: lineCount }, (_, index) => <div key={index} className="pr-3">{index + 1}</div>)}
            </div>
          </div>
          <pre
            className="m-0 min-h-[420px] min-w-max pl-[4.5rem] pr-5 pt-5 text-sm leading-6"
            aria-label={t('tool-code-preview.ui.fullscreenCodeAria')}
          >
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>
        </div>
      </FullscreenPreview>
    </Card>
  );
}
