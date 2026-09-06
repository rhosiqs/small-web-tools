import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AutoDetectConverter from './ui/AutoDetectConverter';

const CONTROL_LABELS = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
  'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
  'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US',
];

const CONTROL_NAMES = [
  'Null', 'Start of Heading', 'Start of Text', 'End of Text',
  'End of Transmission', 'Enquiry', 'Acknowledge', 'Bell',
  'Backspace', 'Horizontal Tab', 'Line Feed', 'Vertical Tab',
  'Form Feed', 'Carriage Return', 'Shift Out', 'Shift In',
  'Data Link Escape', 'Device Control 1', 'Device Control 2', 'Device Control 3',
  'Device Control 4', 'Negative Acknowledge', 'Synchronous Idle', 'End of Transmission Block',
  'Cancel', 'End of Medium', 'Substitute', 'Escape',
  'File Separator', 'Group Separator', 'Record Separator', 'Unit Separator',
];

const ASCII_ENTRIES = Array.from({ length: 128 }, (_, code) => {
  if (code < 32) return { code, symbol: CONTROL_LABELS[code], name: CONTROL_NAMES[code], control: true };
  if (code === 32) return { code, symbol: 'SP', name: 'Space', control: true };
  if (code === 127) return { code, symbol: 'DEL', name: 'Delete', control: true };
  return { code, symbol: String.fromCharCode(code), name: `Character ${String.fromCharCode(code)}`, control: false };
});

/**
 * The eight ranges the table actually has. Sizing each band to what it holds
 * turns 128 identical cells into an index — the blueprint's "reference gets a
 * shape" rule. `wide` marks the ranges whose glyphs are three-letter control
 * mnemonics rather than a single character.
 */
const ASCII_RANGES = [
  { id: 'control', labelKey: 'control', range: '0–31', from: 0, to: 31, wide: true },
  { id: 'punctuation', labelKey: 'punctuation', range: '32–47', from: 32, to: 47, wide: true },
  { id: 'digits', labelKey: 'digits', range: '48–57', from: 48, to: 57, wide: false },
  { id: 'symbols-low', labelKey: 'symbols', range: '58–64', from: 58, to: 64, wide: false },
  { id: 'uppercase', labelKey: 'uppercase', range: '65–90', from: 65, to: 90, wide: false },
  { id: 'symbols-mid', labelKey: 'symbols', range: '91–96', from: 91, to: 96, wide: false },
  { id: 'lowercase', labelKey: 'lowercase', range: '97–122', from: 97, to: 122, wide: false },
  { id: 'symbols-high', labelKey: 'symbolsDelete', range: '123–127', from: 123, to: 127, wide: true },
];

function rangeOf(code) {
  return ASCII_RANGES.find((band) => code >= band.from && code <= band.to) ?? ASCII_RANGES[0];
}

function AsciiCell({ entry, selected, dimmed, wide, onPick, label }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={`${entry.code} (0x${entry.code.toString(16).toUpperCase().padStart(2, '0')}) · ${entry.name}`}
      onClick={() => onPick(String(entry.code))}
      className={`rounded px-1.5 py-2 text-center transition-colors ${wide ? 'min-w-[54px]' : 'min-w-[42px]'} ${
        dimmed ? 'opacity-50 hover:opacity-100' : ''
      } ${
        selected
          ? 'bg-accent-light text-accent ring-1 ring-accent'
          : 'bg-app text-text-main hover:bg-accent-light'
      }`}
    >
      <span className="block font-mono text-sm leading-none">{entry.symbol}</span>
      <span className="mt-1.5 block font-mono text-[0.5938rem] leading-none opacity-60">{entry.code}</span>
    </button>
  );
}

function AsciiReferenceTable({ input, setInput }) {
  const { t } = useTranslation('tools');
  const trimmed = input.trim();
  const selectedCode = /^\d+$/.test(trimmed) && Number(trimmed) <= 127 ? Number(trimmed) : null;
  const [activeRangeId, setActiveRangeId] = useState('digits');
  const activeId = selectedCode === null ? activeRangeId : rangeOf(selectedCode).id;

  const cellLabel = (entry) => t('tool-ascii.ui.cellLabel', { code: entry.code, name: entry.name });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="ascii-reference-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id="ascii-reference-title" className="m-0 text-[0.9375rem] font-medium text-text-main">
            {t('tool-ascii.ui.reference')}
          </h3>
          <p className="m-0 mt-0.5 text-xs text-text-muted">{t('tool-ascii.ui.referenceHint')}</p>
        </div>
        <span className="font-mono text-[0.6875rem] text-text-muted">0–127</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {ASCII_RANGES.map((band) => {
          const label = t(`tool-ascii.ui.ranges.${band.labelKey}`);
          const active = band.id === activeId;
          return (
            <button
              key={band.id}
              type="button"
              aria-pressed={active}
              aria-label={t('tool-ascii.ui.rangeAria', { label, range: band.range })}
              onClick={() => setActiveRangeId(band.id)}
              className={`rounded px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-accent text-white shadow-[0_0_24px_var(--accent-light)]'
                  : 'bg-app text-text-muted hover:text-accent'
              }`}
            >
              <span className="mb-1.5 block font-mono text-[0.5938rem] font-semibold tracking-[0.06em] opacity-75">
                {band.range}
              </span>
              <span className="block text-xs font-medium leading-tight">{label}</span>
              <span className="mt-1.5 block text-[0.625rem] leading-none opacity-60">
                {t('tool-ascii.ui.rangeCount', { count: band.to - band.from + 1 })}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-4">
        {ASCII_RANGES.map((band) => {
          const active = band.id === activeId;
          const label = t(`tool-ascii.ui.ranges.${band.labelKey}`);
          return (
            <div key={band.id} className={active ? '' : 'hidden sm:block'}>
              <div className="mb-2 flex items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className={`block h-0.5 ${active ? 'w-[18px] bg-accent' : 'w-2 bg-border'}`}
                />
                <span className="text-xs font-medium text-text-main">{label}</span>
                <span className="font-mono text-[0.625rem] text-text-muted">{band.range}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ASCII_ENTRIES.slice(band.from, band.to + 1).map((entry) => (
                  <AsciiCell
                    key={entry.code}
                    entry={entry}
                    wide={band.wide}
                    selected={selectedCode === entry.code}
                    dimmed={!active}
                    onPick={setInput}
                    label={cellLabel(entry)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function encodeAscii(text, t) {
  const codes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code > 127) {
      return {
        output: '',
        error: t('tool-ascii.ui.outsideAscii', { character: char }),
      };
    }
    codes.push(code);
  }
  return { output: codes.join(' '), error: null };
}

function decodeAscii(codes, t) {
  const values = codes.trim().split(/[\s,]+/).filter(Boolean);
  const chars = [];

  for (const value of values) {
    if (!/^\d+$/.test(value)) {
      return { output: '', error: t('tool-ascii.ui.notDecimal', { value }) };
    }
    const code = Number(value);
    if (code < 0 || code > 127) {
      return { output: '', error: t('tool-ascii.ui.outsideRange', { value }) };
    }
    chars.push(String.fromCharCode(code));
  }
  return { output: chars.join(''), error: null };
}

function analyzeAscii(input, mode = 'auto', t) {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      sourceLabel: mode === 'encode' ? t('tool-ascii.ui.plainText') : mode === 'decode' ? t('tool-ascii.ui.codes') : t('tool-ascii.ui.textOrCodes'),
      targetLabel: mode === 'encode' ? t('tool-ascii.ui.codes') : mode === 'decode' ? t('tool-ascii.ui.plainText') : '',
      output: '',
      outputPlaceholder: '',
      error: null,
    };
  }

  if (mode === 'encode') {
    const encoded = encodeAscii(input, t);
    return {
      sourceLabel: t('tool-ascii.ui.plainText'),
      targetLabel: t('tool-ascii.ui.codes'),
      output: encoded.output,
      outputPlaceholder: '',
      error: encoded.error,
    };
  }

  if (mode === 'decode') {
    const decoded = decodeAscii(trimmed, t);
    return {
      sourceLabel: t('tool-ascii.ui.codes'),
      targetLabel: t('tool-ascii.ui.plainText'),
      output: decoded.output,
      outputPlaceholder: '',
      error: decoded.error,
    };
  }

  const looksLikeCodes = /^[\d\s,]+$/.test(trimmed);
  if (looksLikeCodes) {
    const decoded = decodeAscii(trimmed, t);
    return {
      sourceLabel: t('tool-ascii.ui.codes'),
      targetLabel: t('tool-ascii.ui.plainText'),
      output: decoded.output,
      outputPlaceholder: '',
      error: decoded.error,
    };
  }

  const encoded = encodeAscii(input, t);
  return {
    sourceLabel: t('tool-ascii.ui.plainText'),
    targetLabel: t('tool-ascii.ui.codes'),
    output: encoded.output,
    outputPlaceholder: '',
    error: encoded.error,
  };
}

export default function AsciiConverter() {
  const { t } = useTranslation('tools');
  return (
    <AutoDetectConverter
      toolId="tool-ascii"
      kicker={t('navigation:categories.developer')}
      title={t('tool-ascii.title')}
      inputPlaceholder={t('tool-ascii.ui.placeholder')}
      emptyTargetLabel={t('tool-ascii.ui.converted')}
      analyze={(input, mode) => analyzeAscii(input, mode, t)}
      editorMinHeightClass="min-h-[96px]"
      editorRows={4}
      renderSupplementary={(props) => <AsciiReferenceTable {...props} />}
      showManualModes={false}
    />
  );
}
