import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import { convertRomanInput } from './RomanNumeralConverter/lib/romanDomain';

/**
 * Reference laid out by magnitude instead of thirteen equal boxes: each row is
 * one order of magnitude, so the subtractive pairs sit beside the symbol they
 * subtract from.
 */
const MAGNITUDE_ROWS = [
  { id: 'ones', values: [[1, 'I'], [4, 'IV'], [5, 'V'], [9, 'IX']] },
  { id: 'tens', values: [[10, 'X'], [40, 'XL'], [50, 'L'], [90, 'XC']] },
  { id: 'hundreds', values: [[100, 'C'], [400, 'CD'], [500, 'D'], [900, 'CM']] },
  { id: 'thousands', values: [[1000, 'M']] },
];

const LABEL_KEYS = {
  'Decimal or Roman numeral': 'decimalOrRoman',
  'Converted value': 'convertedValue',
  'Decimal number': 'decimalNumber',
  'Roman numeral': 'romanNumeral',
};

const ERROR_KEYS = {
  'Enter a whole number from 1 to 3999.': 'decimalRange',
  'Enter a canonical Roman numeral using I, V, X, L, C, D, and M.': 'invalidRoman',
};

export default function RomanNumeralConverter() {
  const { t, i18n } = useTranslation('tools');
  const [input, setInput] = useState('');
  const [copyState, setCopyState] = useState('idle');
  const result = useMemo(() => convertRomanInput(input), [input]);

  const updateInput = (value) => {
    setInput(value);
    setCopyState('idle');
  };

  const copyResult = async () => {
    if (!result.output) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <Card id="tool-roman" variant="tool" size="wide" className="max-w-[860px] gap-6 p-6 sm:p-8">
      <ToolHeader title={t('tool-roman.title')} kicker={t('navigation:categories.calculation')} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-5">
          <div className="min-w-0 flex-[1_1_220px]">
            <label htmlFor="roman-input" className="mb-1.5 block text-xs font-medium text-text-muted">
              {t(`tool-roman.ui.label.${LABEL_KEYS[result.inputLabel]}`)}
            </label>
            <input
              id="roman-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(event) => updateInput(event.target.value)}
              placeholder="2026 or MMXXVI"
              aria-invalid={Boolean(result.error) || undefined}
              aria-describedby={result.error ? 'roman-error' : undefined}
              className="input-rule w-full px-0 pb-2 pt-0 font-mono text-3xl leading-tight text-text-main placeholder:text-text-muted"
            />
          </div>

          <span aria-hidden="true" className="hidden pb-3 text-xl text-accent opacity-40 sm:block">→</span>

          <div className="min-w-0 flex-[1_1_220px] rounded-lg bg-accent-light px-4 py-3 ring-1 ring-accent-edge">
            <span className="mb-1.5 block text-xs font-medium text-accent">
              {t(`tool-roman.ui.label.${LABEL_KEYS[result.outputLabel]}`)}
            </span>
            <output
              id="roman-output"
              aria-live="polite"
              className="block break-all font-mono text-3xl leading-tight text-text-main"
            >
              {result.output || '—'}
            </output>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {result.error ? (
            <p id="roman-error" role="alert" className="m-0 text-xs text-red-500">
              {t(`tool-roman.ui.error.${ERROR_KEYS[result.error]}`)}
            </p>
          ) : (
            <p className="m-0 text-xs text-text-muted">{t('tool-roman.ui.note')}</p>
          )}
          <div className="flex flex-none gap-2">
            <button
              type="button"
              disabled={!input}
              onClick={() => updateInput('')}
              className="rounded border border-border bg-transparent px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-40"
            >
              {t('tool-roman.ui.clear')}
            </button>
            <button
              type="button"
              disabled={!result.output}
              onClick={copyResult}
              aria-label={t(copyState === 'error' ? 'tool-roman.ui.retryCopyAria' : 'tool-roman.ui.copyAria')}
              className="rounded border border-accent-edge bg-transparent px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-light disabled:cursor-default disabled:opacity-40"
            >
              {t(copyState === 'copied'
                ? 'tool-roman.ui.copied'
                : copyState === 'error'
                  ? 'tool-roman.ui.retry'
                  : 'tool-roman.ui.copy')}
            </button>
          </div>
        </div>
      </section>

      <div className="rule-fade" role="presentation" />

      <section className="flex flex-col gap-4" aria-labelledby="roman-reference-title">
        <div>
          <h3 id="roman-reference-title" className="m-0 text-[0.9375rem] font-medium text-text-main">
            {t('tool-roman.ui.referenceTitle')}
          </h3>
          <p className="m-0 mt-0.5 text-xs text-text-muted">
            {t('tool-roman.ui.referenceDescription')}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {MAGNITUDE_ROWS.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="w-16 flex-none font-mono text-[0.5938rem] font-semibold tracking-[0.08em] text-text-muted">
                {t(`tool-roman.ui.magnitudes.${row.id}`)}
              </span>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
                {row.values.map(([decimal, roman]) => (
                  <button
                    key={decimal}
                    type="button"
                    onClick={() => updateInput(String(decimal))}
                    className="flex items-baseline justify-between gap-2 rounded bg-app px-3 py-2 text-left transition-colors hover:bg-accent-light"
                    aria-label={t('tool-roman.ui.convertAria', {
                      decimal: decimal.toLocaleString(i18n.language), roman,
                    })}
                  >
                    <span className="font-mono text-sm text-accent">{roman}</span>
                    <span className="font-mono text-[0.6875rem] text-text-muted">
                      {decimal.toLocaleString(i18n.language)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Card>
  );
}
