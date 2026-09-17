import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const BASE_OPTIONS = [
  { base: 2, short: 'BIN', labelKey: 'binary', example: '101010' },
  { base: 8, short: 'OCT', labelKey: 'octal', example: '377' },
  { base: 10, short: 'DEC', labelKey: 'decimal', example: '255' },
  { base: 16, short: 'HEX', labelKey: 'hexadecimal', example: 'FF' },
  { base: 60, short: 'BASE 60', labelKey: 'sexagesimal', example: '3:25:15' },
];

const COMMON_BASES = [
  { base: 2, short: 'BIN', labelKey: 'binary' },
  { base: 8, short: 'OCT', labelKey: 'octal' },
  { base: 10, short: 'DEC', labelKey: 'decimal' },
  { base: 16, short: 'HEX', labelKey: 'hexadecimal' },
];

const COMMON_VALUES = Array.from({ length: 16 }, (_, value) => value);

function parseBigIntFromBase(value, base) {
  let text = value.trim().toUpperCase();
  if (!text) return null;

  let sign = 1n;
  if (text.startsWith('-')) {
    sign = -1n;
    text = text.slice(1);
  }
  if (!text) return null;

  if (base === 16 && text.startsWith('0X')) text = text.slice(2);
  if (base === 8 && text.startsWith('0O')) text = text.slice(2);
  if (base === 2 && text.startsWith('0B')) text = text.slice(2);
  if (!text) return null;

  let result = 0n;
  for (const char of text) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= base) return null;
    result = result * BigInt(base) + BigInt(digit);
  }
  return result * sign;
}

function parseBase60(value) {
  let text = value.trim();
  if (!text) return null;

  let sign = 1n;
  if (text.startsWith('-')) {
    sign = -1n;
    text = text.slice(1);
  }

  const parts = text.split(':');
  if (parts.some((part) => !/^\d+$/.test(part))) return null;

  let result = 0n;
  for (const part of parts) {
    const digit = Number(part);
    if (digit < 0 || digit > 59) return null;
    result = result * 60n + BigInt(digit);
  }
  return result * sign;
}

function formatBase60(value) {
  if (value === 0n) return '0';

  const sign = value < 0n ? '-' : '';
  let current = value < 0n ? -value : value;
  const parts = [];
  while (current > 0n) {
    parts.push((current % 60n).toString());
    current /= 60n;
  }
  return sign + parts.reverse().join(':');
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 4V2h6v2M9 12h6M12 9v6" />
    </svg>
  );
}

export default function BaseConverter() {
  const { t } = useTranslation('tools');
  const [input, setInput] = useState('');
  const [baseFrom, setBaseFrom] = useState(10);
  const [copiedBase, setCopiedBase] = useState(null);
  const [copyState, setCopyState] = useState('idle');
  const [pasteState, setPasteState] = useState('idle');
  const [selectedReferenceValue, setSelectedReferenceValue] = useState(null);

  const trimmed = input.trim();
  const parsed = trimmed
    ? baseFrom === 60
      ? parseBase60(trimmed)
      : parseBigIntFromBase(trimmed, baseFrom)
    : null;
  const hasError = Boolean(trimmed) && parsed === null;
  const selectedBase = BASE_OPTIONS.find((option) => option.base === baseFrom);

  const results = [
    { base: 2, short: 'BIN', label: t('tool-base.ui.binary'), value: parsed === null ? '' : parsed.toString(2) },
    { base: 8, short: 'OCT', label: t('tool-base.ui.octal'), value: parsed === null ? '' : parsed.toString(8) },
    { base: 10, short: 'DEC', label: t('tool-base.ui.decimal'), value: parsed === null ? '' : parsed.toString(10) },
    { base: 16, short: 'HEX', label: t('tool-base.ui.hexadecimal'), value: parsed === null ? '' : parsed.toString(16).toUpperCase() },
    { base: 60, short: 'BASE 60', label: t('tool-base.ui.sexagesimal'), value: parsed === null ? '' : formatBase60(parsed) },
  ];

  const selectInputBase = (base) => {
    const matchingResult = results.find((result) => result.base === base);
    if (parsed !== null && matchingResult?.value) {
      setInput(matchingResult.value);
    }
    setBaseFrom(base);
    setSelectedReferenceValue(null);
    setCopiedBase(null);
    setCopyState('idle');
    setPasteState('idle');
  };

  const copyValue = async (result) => {
    if (!result.value) return;
    try {
      await navigator.clipboard.writeText(result.value);
      setCopiedBase(result.base);
      setCopyState('copied');
    } catch {
      setCopiedBase(result.base);
      setCopyState('error');
    }
  };

  const pasteInput = async () => {
    setPasteState('reading');
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setSelectedReferenceValue(null);
      setCopiedBase(null);
      setCopyState('idle');
      setPasteState('pasted');
    } catch {
      setPasteState('error');
    }
  };

  const selectReferenceValue = (base, value) => {
    setInput(value.toString(base).toUpperCase());
    setBaseFrom(base);
    setSelectedReferenceValue(value);
    setCopiedBase(null);
    setCopyState('idle');
    setPasteState('idle');
  };

  return (
    <Card id="tool-base" variant="tool" size="wide" className="max-w-[920px]">
      <ToolHeader title={t('tool-base.ui.heading')} />

      <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-app/70 p-3" aria-labelledby="base-conversion-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="base-conversion-title" className="text-sm font-bold text-text-main">{t('tool-base.ui.conversionTitle')}</h2>
            <p className="text-xs text-text-muted">{t('tool-base.ui.conversionHint')}</p>
          </div>
          <span className="rounded-full border border-accent/25 bg-accent-light px-2.5 py-1 text-xs font-bold text-accent">
            {t('tool-base.ui.base', { base: baseFrom })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label={t('tool-base.ui.inputBase')}>
          {BASE_OPTIONS.map((option) => {
            const active = option.base === baseFrom;
            return (
              <button
                key={option.base}
                type="button"
                aria-pressed={active}
                onClick={() => selectInputBase(option.base)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${active
                  ? 'border-accent bg-accent text-white shadow-[0_4px_12px_var(--accent-light)]'
                  : 'border-border bg-card text-text-muted hover:border-accent hover:text-text-main'}`}
              >
                <span className="block text-xs font-extrabold tracking-wide">{option.short}</span>
                <span className={`block text-[0.68rem] ${active ? 'text-white/75' : 'text-text-muted'}`}>{t('tool-base.ui.base', { base: option.base })}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="base-input" className="text-sm font-bold text-text-main">{t('tool-base.ui.number')}</label>
            <span className="text-xs text-text-muted">{t('tool-base.ui.example', { example: selectedBase.example })}</span>
          </div>
          <div className="flex gap-2">
            <input
              id="base-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSelectedReferenceValue(null);
                setCopiedBase(null);
                setCopyState('idle');
                setPasteState('idle');
              }}
              placeholder={selectedBase.example}
              className={`min-w-0 flex-1 rounded-lg border bg-card px-4 py-2.5 font-mono text-lg font-semibold text-text-main outline-none transition-all placeholder:text-text-muted/45 focus:ring-2 ${hasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                : 'border-border hover:border-border-hover focus:border-accent focus:ring-focus'}`}
              aria-invalid={hasError || undefined}
              aria-describedby="base-status"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pasteState === 'reading'}
              onClick={pasteInput}
              aria-label={t(pasteState === 'error' ? 'tool-base.ui.retryPaste' : 'tool-base.ui.paste')}
              className="min-w-[74px]"
            >
              <PasteIcon />
              {t(pasteState === 'reading' ? 'tool-base.ui.pasting' : pasteState === 'pasted' ? 'tool-base.ui.pasted' : pasteState === 'error' ? 'tool-base.ui.retry' : 'tool-base.ui.pasteShort')}
            </Button>
            <button
              type="button"
              disabled={!input}
              onClick={() => {
                setInput('');
                setSelectedReferenceValue(null);
                setCopiedBase(null);
                setCopyState('idle');
                setPasteState('idle');
              }}
              className="rounded-lg border border-border bg-card px-4 text-sm font-semibold text-text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-35"
            >
              {t('tool-base.ui.clear')}
            </button>
          </div>
        </div>
      <div
        id="base-status"
        role={hasError ? 'alert' : 'status'}
        className={`flex min-h-9 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${hasError
          ? 'border-red-500/30 bg-red-500/10 text-red-500'
          : 'border-border bg-app text-text-muted'}`}
      >
        <span className={`h-2 w-2 flex-none rounded-full ${hasError ? 'bg-red-500' : trimmed ? 'bg-accent' : 'bg-text-muted/40'}`} />
        <span>{hasError
          ? t('tool-base.ui.invalid', { input, base: t(`tool-base.ui.${selectedBase.labelKey}`).toLocaleLowerCase() })
          : trimmed
            ? t('tool-base.ui.interpreting', { baseName: t(`tool-base.ui.${selectedBase.labelKey}`).toLocaleLowerCase(), base: baseFrom })
            : t('tool-base.ui.empty')}</span>
      </div>

      <div className="flex flex-col gap-2" aria-label={t('tool-base.ui.convertedValues')}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {results.map((result) => (
            <div
              key={result.base}
              data-base-result={result.base}
              className={`flex min-w-0 flex-col gap-1 rounded-xl border p-2 transition-colors ${result.base === baseFrom
                ? 'border-accent/40 bg-accent-light/45'
                : 'border-border bg-card hover:border-border-hover'} ${result.base === 60 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-app px-2 py-1 text-[0.68rem] font-extrabold tracking-wide text-accent">{result.short}</span>
                  <span className="text-sm font-semibold text-text-main">{result.label}</span>
                </div>
              </div>
              <code className={`min-h-6 break-all font-mono text-[0.9rem] font-semibold leading-6 ${result.value ? 'text-text-main' : 'text-text-muted/45'}`}>
                {result.value || '—'}
              </code>
              <div className="flex items-center justify-end border-t border-border/70 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!result.value}
                  onClick={() => copyValue(result)}
                  aria-label={copiedBase === result.base && copyState === 'error'
                    ? t('tool-base.ui.retryCopy', { base: result.label })
                    : t('tool-base.ui.copyValue', { base: result.label })}
                  className="min-w-[64px] !px-2 !py-0.5 !text-[0.7rem]"
                >
                  <CopyIcon />
                  {copiedBase === result.base
                    ? t(copyState === 'error' ? 'tool-base.ui.retry' : 'tool-base.ui.copied')
                    : t('tool-base.ui.copy')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="common-base-reference-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="common-base-reference-title" className="text-sm font-bold text-text-main">{t('tool-base.ui.reference')}</h2>
            <p className="text-xs text-text-muted">{t('tool-base.ui.referenceHint')}</p>
          </div>
          <span className="text-[0.68rem] font-semibold text-text-muted">{t('tool-base.ui.legend')}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-app/70 p-1.5">
          <div className="grid min-w-[760px] grid-cols-[58px_repeat(16,minmax(38px,1fr))] gap-1" role="grid" aria-label={t('tool-base.ui.gridLabel')}>
            <div className="flex items-center justify-center text-[0.6rem] font-extrabold uppercase tracking-wide text-text-muted" role="columnheader">
              {t('tool-base.ui.baseHeading')}
            </div>
            {COMMON_VALUES.map((value) => (
              <div key={`heading-${value}`} className={`flex min-h-6 items-center justify-center rounded text-[0.62rem] font-bold tabular-nums ${selectedReferenceValue === value ? 'bg-accent text-white' : 'text-text-muted'}`} role="columnheader">
                {value}
              </div>
            ))}

            {COMMON_BASES.map((row) => (
              <React.Fragment key={row.base}>
                <div className="flex min-h-8 flex-col items-center justify-center rounded-md border border-border bg-card leading-none" role="rowheader" title={t('tool-base.ui.rowTitle', { name: t(`tool-base.ui.${row.labelKey}`), base: row.base })}>
                  <span className="text-[0.64rem] font-extrabold text-accent">{row.short}</span>
                  <span className="mt-0.5 text-[0.5rem] text-text-muted">{row.base}</span>
                </div>
                {COMMON_VALUES.map((value) => {
                  const displayValue = value.toString(row.base).toUpperCase();
                  const selected = selectedReferenceValue === value;
                  const exactInput = selected && baseFrom === row.base;
                  return (
                    <button
                      key={`${row.base}-${value}`}
                      type="button"
                      role="gridcell"
                      aria-pressed={exactInput}
                      aria-label={t('tool-base.ui.cellLabel', { name: t(`tool-base.ui.${row.labelKey}`), display: displayValue, decimal: value })}
                      title={t('tool-base.ui.cellTitle', { display: displayValue, base: row.base, decimal: value })}
                      onClick={() => selectReferenceValue(row.base, value)}
                      className={`min-h-8 rounded-md border px-1 font-mono text-[0.72rem] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${exactInput
                        ? 'border-accent bg-accent text-white shadow-[0_2px_8px_var(--accent-light)]'
                        : selected
                          ? 'border-accent/45 bg-accent-light text-accent'
                          : 'border-border bg-card text-text-main hover:border-accent hover:bg-accent-light hover:text-accent'}`}
                    >
                      {displayValue}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    </Card>
  );
}
