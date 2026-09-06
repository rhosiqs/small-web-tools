import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import ToolHeader from './ToolHeader';

/**
 * Shared shell for the auto-detecting converters (ASCII, Unicode, URL, Slashes).
 *
 * Layout follows the conversion-tools blueprint: one frame per screen instead of
 * a card wrapping a bordered pane wrapping two equal panes. Source and result no
 * longer share a width or a header height — the field you type in leads at
 * 1.35fr and stays quiet (an underline, no box), and the result answers from a
 * tinted slab at display size.
 */

const fieldLabelClass = 'font-medium text-xs text-text-muted';
const detectionTagClass = 'font-mono text-[0.6875rem] text-text-muted';
const ghostButtonClass =
  'rounded border border-border bg-transparent px-3 py-2 text-xs font-medium text-text-muted '
  + 'transition-colors hover:border-accent hover:text-accent '
  + 'disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted';

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 4V2h6v2M9 12h6M12 9v6" />
    </svg>
  );
}

export default function AutoDetectConverter({
  toolId,
  title,
  kicker,
  inputPlaceholder,
  emptyTargetLabel,
  analyze,
  editorMinHeightClass = 'min-h-[168px]',
  editorRows = 6,
  renderSupplementary = null,
  showManualModes = true,
}) {
  const { t } = useTranslation('common');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto'); // 'auto' | 'encode' | 'decode'
  const [copyState, setCopyState] = useState('idle');
  const [pasteState, setPasteState] = useState('idle');
  const result = useMemo(() => analyze(input, mode), [analyze, input, mode]);
  const output = result.output || '';

  const updateInput = (value) => {
    setInput(value);
    setCopyState('idle');
    setPasteState('idle');
  };

  const handlePaste = async () => {
    setPasteState('reading');
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setCopyState('idle');
      setPasteState('pasted');
    } catch {
      setPasteState('error');
    }
  };

  const handleCopy = async () => {
    if (!output || result.error) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  const modeButton = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={`rounded px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
        mode === id
          ? 'bg-accent text-white'
          : 'text-text-muted hover:text-accent'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card id={toolId} variant="tool" size="wide" className="max-w-[920px] gap-6 p-6 sm:p-8">
      <ToolHeader title={title} kicker={kicker} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="flex min-w-0 flex-col" aria-label={t('converter.source')}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={`${toolId}-input`} className={fieldLabelClass}>
              {t('converter.source')}
            </label>
            {input.trim() && <span className={`${detectionTagClass} truncate`}>{result.sourceLabel}</span>}
          </div>

          <textarea
            id={`${toolId}-input`}
            rows={editorRows}
            spellCheck={false}
            value={input}
            onChange={(event) => {
              updateInput(event.target.value);
            }}
            placeholder={inputPlaceholder}
            aria-label={t('converter.sourceInput')}
            aria-invalid={result.error ? true : undefined}
            aria-describedby={result.error ? `${toolId}-error` : undefined}
            className={`input-rule ${editorMinHeightClass} w-full resize-y px-0 pb-3 pt-0 font-mono text-base leading-7 text-text-main placeholder:text-text-muted`}
          />

          {result.error && (
            <p id={`${toolId}-error`} role="alert" className="mt-2 text-xs text-red-500">
              {result.error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div
              className="flex rounded border border-border p-0.5"
              role="group"
              aria-label={t('converter.mode')}
            >
              {modeButton('auto', t('converter.auto'))}
              {showManualModes && modeButton('encode', t('converter.encode'))}
              {showManualModes && modeButton('decode', t('converter.decode'))}
            </div>
            <button
              type="button"
              disabled={pasteState === 'reading'}
              onClick={handlePaste}
              aria-label={t(pasteState === 'error' ? 'converter.retryPaste' : 'converter.pasteLabel')}
              className={`${ghostButtonClass} inline-flex items-center gap-1.5`}
            >
              <PasteIcon />
              {pasteState === 'reading' ? t('states.pasting') : pasteState === 'pasted' ? t('states.pasted') : pasteState === 'error' ? t('actions.retry') : t('converter.paste')}
            </button>
            <button
              type="button"
              disabled={!input}
              onClick={() => {
                updateInput('');
              }}
              className={ghostButtonClass}
            >
              {t('actions.clear')}
            </button>
          </div>
        </section>

        <section
          className="flex min-w-0 flex-col rounded-lg bg-accent-light p-4 ring-1 ring-accent-edge"
          aria-label={t('converter.result')}
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-medium text-accent">
              {result.targetLabel || emptyTargetLabel}
            </span>
            <button
              type="button"
              disabled={!output || Boolean(result.error)}
              onClick={handleCopy}
              aria-label={t(copyState === 'error' ? 'converter.retryCopy' : 'converter.copyLabel')}
              className="inline-flex flex-none items-center gap-1.5 rounded border border-accent-edge bg-transparent px-2 py-1 text-[0.6875rem] font-medium text-accent transition-colors hover:bg-accent-light disabled:cursor-default disabled:opacity-40"
            >
              <CopyIcon />
              {copyState === 'copied' ? t('actions.copied') : copyState === 'error' ? t('actions.retry') : t('actions.copy')}
            </button>
          </div>

          <textarea
            id={`${toolId}-output`}
            rows={editorRows}
            readOnly
            value={output}
            placeholder={result.error ? t('converter.fixInput') : result.outputPlaceholder}
            aria-label={t('converter.convertedResult')}
            aria-live="polite"
            className={`slab-output ${editorMinHeightClass} w-full resize-y break-all font-mono text-[0.9375rem] leading-6 text-text-main placeholder:text-text-muted`}
          />
        </section>
      </div>

      {renderSupplementary && (
        <>
          <div className="rule-fade" role="presentation" />
          {renderSupplementary({ input, setInput: updateInput })}
        </>
      )}
    </Card>
  );
}
