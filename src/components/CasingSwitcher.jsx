import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';

function countWords(text) {
  if (!text) return 0;
  const regex = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s\p{P}\p{S}]+(?:[-'’][^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s\p{P}\p{S}]+)*/gu;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function swapCase(str) {
  return str
    .split('')
    .map((c) => {
      const low = c.toLowerCase();
      const up = c.toUpperCase();
      return c === low ? up : low;
    })
    .join('');
}

function toTitleCase(str) {
  return str.replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}

function toSentenceCase(str, preserveCapitals) {
  let targetStr = str;
  if (!preserveCapitals) {
    targetStr = str.toLowerCase();
  }
  return targetStr.replace(/(?:^|[.!?]\s+)(\p{L})/gu, (match, p1) => {
    return match.replace(p1, p1.toUpperCase());
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalizeSpecificTerms(str, specificTerms, specificTermsMode) {
  const terms = specificTerms
    .split(/,|\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return str;

  let result = str;
  for (const term of terms) {
    const escaped = escapeRegExp(term);
    const startBoundary = /^\w/.test(term) ? '\\b' : '';
    const endBoundary = /\w$/.test(term) ? '\\b' : '';
    const regex = new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'giu');

    result = result.replace(regex, (match) => {
      const lowerMatch = match.toLowerCase();
      if (specificTermsMode === 'first') {
        return lowerMatch.replace(/\p{L}/u, (c) => c.toUpperCase());
      } else {
        return lowerMatch.replace(/\b\p{L}/gu, (char) => char.toUpperCase());
      }
    });
  }
  return result;
}

function restoreExcludedWords(source, draft, excludeWords) {
  const excludedSet = new Set(
    excludeWords
      .split(/,|\n/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  );
  if (excludedSet.size === 0) return draft;

  const tokensInput = source.split(/(\p{L}+(?:['’]\p{L}+)*)/gu);
  const tokensDraft = draft.split(/(\p{L}+(?:['’]\p{L}+)*)/gu);

  return tokensDraft
    .map((token, index) => {
      const originalToken = tokensInput[index];
      if (!token || !originalToken) return token;
      if (/\p{L}/u.test(token) && excludedSet.has(originalToken.toLowerCase())) {
        return originalToken; // Keep the original casing.
      }
      return token;
    })
    .join('');
}

const pillClass = (active) =>
  `rounded px-2 py-1.5 font-mono text-[0.6875rem] font-medium transition-colors ${
    active ? 'bg-accent text-white' : 'text-text-muted ring-1 ring-inset ring-border hover:text-accent'
  }`;

const nestedFieldClass =
  'input-rule w-full px-0 pb-1.5 pt-0 text-[0.8125rem] text-text-main placeholder:text-text-muted';

/**
 * One step of the casing recipe: a dot that switches the step on, the text as it
 * stands after that step has run, and whatever options the step carries. The
 * per-step preview is what replaces the old nested options panel — the effect of
 * each switch is visible where the switch is, instead of only in the output box.
 */
function RecipeStep({ step, children = null }) {
  return (
    <div
      className={`flex items-start gap-4 border-b py-4 ${
        step.enabled ? 'border-accent-edge' : 'border-border'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={step.enabled}
        aria-label={step.title}
        onClick={step.onToggle}
        className={`mt-0.5 h-4 w-4 flex-none rounded-full border-0 transition-colors ${
          step.enabled
            ? 'bg-accent ring-1 ring-accent'
            : 'bg-transparent ring-1 ring-text-muted hover:ring-accent'
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className={`m-0 text-[0.8125rem] font-medium ${step.enabled ? 'text-text-main' : 'text-text-muted'}`}>
          {step.title}
        </p>
        <p
          className={`m-0 mt-1.5 break-words font-mono text-[0.9375rem] leading-relaxed ${
            step.enabled ? 'text-text-muted' : 'text-border'
          }`}
        >
          {step.enabled ? step.preview || '—' : '—'}
        </p>
        {step.enabled && children && <div className="mt-3 flex flex-col gap-2.5">{children}</div>}
      </div>
    </div>
  );
}

export default function CasingSwitcher() {
  const { t, i18n } = useTranslation(['tools', 'common']);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const [enableCaseChange, setEnableCaseChange] = useState(false);
  const [caseChangeMode, setCaseChangeMode] = useState('invert'); // 'invert' | 'upper' | 'lower'

  const [enableTitleCase, setEnableTitleCase] = useState(false);

  const [enableSentenceCase, setEnableSentenceCase] = useState(false);
  const [preserveCapitals, setPreserveCapitals] = useState(true);

  const [enableSpecificTerms, setEnableSpecificTerms] = useState(false);
  const [specificTerms, setSpecificTerms] = useState('react, javascript, node js');
  const [specificTermsMode, setSpecificTermsMode] = useState('all'); // 'first' | 'all'

  const [enableExcludeWords, setEnableExcludeWords] = useState(false);
  const [excludeWords, setExcludeWords] = useState('and, or, but, to, the, a, an, in, of, for, with, I');

  // The pipeline now reports what the text looks like after every step, not just
  // at the end, so each recipe row can show its own result.
  const { previews, output } = useMemo(() => {
    let current = input;

    if (enableCaseChange) {
      if (caseChangeMode === 'invert') current = swapCase(current);
      else if (caseChangeMode === 'upper') current = current.toUpperCase();
      else if (caseChangeMode === 'lower') current = current.toLowerCase();
    }
    const afterCaseChange = current;

    if (enableTitleCase) current = toTitleCase(current);
    const afterTitleCase = current;

    if (enableSentenceCase) current = toSentenceCase(current, preserveCapitals);
    const afterSentenceCase = current;

    if (enableSpecificTerms) current = capitalizeSpecificTerms(current, specificTerms, specificTermsMode);
    const afterSpecificTerms = current;

    if (enableExcludeWords && excludeWords.trim()) {
      current = restoreExcludedWords(input, current, excludeWords);
    }

    return {
      previews: {
        caseChange: afterCaseChange,
        titleCase: afterTitleCase,
        sentenceCase: afterSentenceCase,
        specificTerms: afterSpecificTerms,
        excludeWords: current,
      },
      output: current,
    };
  }, [
    input,
    enableCaseChange,
    caseChangeMode,
    enableTitleCase,
    enableSentenceCase,
    preserveCapitals,
    enableSpecificTerms,
    specificTerms,
    specificTermsMode,
    enableExcludeWords,
    excludeWords,
  ]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const format = (value) => new Intl.NumberFormat(i18n.resolvedLanguage).format(value);
  const counts = (value) => `${t('tools:tool-casing.ui.words', { count: format(countWords(value)) })} · ${
    t('tools:tool-casing.ui.characters', { count: format(value.length) })}`;

  return (
    <Card id="tool-casing" variant="tool" size="wide" className="max-w-[920px] gap-6 p-6 sm:p-8">
      <ToolHeader
        title={t('tools:tool-casing.ui.heading')}
        kicker={t('navigation:categories.text')}
      />

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
          <label htmlFor="casing-input" className="text-xs font-medium text-text-muted">
            {t('tools:tool-casing.ui.input')}
          </label>
          <span className="font-mono text-[0.6875rem] text-text-muted">{counts(input)}</span>
        </div>
        <textarea
          id="casing-input"
          rows={3}
          spellCheck={false}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('tools:tool-casing.ui.inputPlaceholder')}
          className="input-rule w-full resize-y px-0 pb-3 pt-0 text-base leading-relaxed text-text-main placeholder:text-text-muted"
        />
        <div className="mt-3">
          <button
            id="casing-clear-btn"
            type="button"
            onClick={() => setInput('')}
            disabled={!input}
            title={t('tools:tool-casing.ui.clearTitle')}
            className="rounded border border-border bg-transparent px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-40"
          >
            {t('common:actions.clear')}
          </button>
        </div>
      </div>

      <div className="flex flex-col" aria-label={t('tools:tool-casing.ui.controls')} role="group">
        <RecipeStep
          step={{
            title: t('tools:tool-casing.ui.allCase'),
            enabled: enableCaseChange,
            preview: previews.caseChange,
            onToggle: () => setEnableCaseChange((value) => !value),
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {[
              ['upper', t('tools:tool-casing.ui.uppercase')],
              ['lower', t('tools:tool-casing.ui.lowercase')],
              ['invert', t('tools:tool-casing.ui.invert')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={caseChangeMode === id}
                onClick={() => setCaseChangeMode(id)}
                className={pillClass(caseChangeMode === id)}
              >
                {label}
              </button>
            ))}
          </div>
        </RecipeStep>

        <RecipeStep
          step={{
            title: t('tools:tool-casing.ui.titleCase'),
            enabled: enableTitleCase,
            preview: previews.titleCase,
            onToggle: () => setEnableTitleCase((value) => !value),
          }}
        />

        <RecipeStep
          step={{
            title: t('tools:tool-casing.ui.sentenceCase'),
            enabled: enableSentenceCase,
            preview: previews.sentenceCase,
            onToggle: () => setEnableSentenceCase((value) => !value),
          }}
        >
          <div className="checkbox-wrapper">
            <label htmlFor="preserve-capitals" className="checkbox-label text-[0.8125rem]">
              <input
                id="preserve-capitals"
                type="checkbox"
                checked={preserveCapitals}
                onChange={(event) => setPreserveCapitals(event.target.checked)}
              />
              {t('tools:tool-casing.ui.preserve')}
            </label>
          </div>
        </RecipeStep>

        <RecipeStep
          step={{
            title: t('tools:tool-casing.ui.specific'),
            enabled: enableSpecificTerms,
            preview: previews.specificTerms,
            onToggle: () => setEnableSpecificTerms((value) => !value),
          }}
        >
          <div>
            <label htmlFor="specific-terms-input" className="mb-1 block text-[0.6875rem] text-text-muted">
              {t('tools:tool-casing.ui.termsLabel')}
            </label>
            <input
              id="specific-terms-input"
              type="text"
              value={specificTerms}
              onChange={(event) => setSpecificTerms(event.target.value)}
              placeholder={t('tools:tool-casing.ui.termsPlaceholder')}
              className={nestedFieldClass}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['first', t('tools:tool-casing.ui.firstTerm')],
              ['all', t('tools:tool-casing.ui.allTerms')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={specificTermsMode === id}
                onClick={() => setSpecificTermsMode(id)}
                className={pillClass(specificTermsMode === id)}
              >
                {label}
              </button>
            ))}
          </div>
        </RecipeStep>

        <RecipeStep
          step={{
            title: t('tools:tool-casing.ui.exclude'),
            enabled: enableExcludeWords,
            preview: previews.excludeWords,
            onToggle: () => setEnableExcludeWords((value) => !value),
          }}
        >
          <div>
            <label htmlFor="exclude-words-input" className="mb-1 block text-[0.6875rem] text-text-muted">
              {t('tools:tool-casing.ui.excludeLabel')}
            </label>
            <input
              id="exclude-words-input"
              type="text"
              value={excludeWords}
              onChange={(event) => setExcludeWords(event.target.value)}
              placeholder={t('tools:tool-casing.ui.excludePlaceholder')}
              className={nestedFieldClass}
            />
          </div>
        </RecipeStep>
      </div>

      <section className="rounded-lg bg-accent-light p-4 ring-1 ring-accent-edge">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-accent">{t('tools:tool-casing.ui.output')}</span>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[0.6875rem] text-text-muted">{counts(output)}</span>
            <button
              id="casing-copy-btn"
              type="button"
              onClick={handleCopy}
              disabled={!output}
              title={t('tools:tool-casing.ui.copyTitle')}
              className="rounded border border-accent-edge bg-transparent px-2 py-1 text-[0.6875rem] font-medium text-accent transition-colors hover:bg-accent-light disabled:cursor-default disabled:opacity-40"
            >
              {copied ? t('common:actions.copied') : t('tools:tool-casing.ui.copyOutput')}
            </button>
          </div>
        </div>
        <output
          id="casing-output"
          aria-live="polite"
          className="block min-h-[1.75rem] break-words text-base leading-relaxed text-text-main"
        >
          {output || t('tools:tool-casing.ui.outputPlaceholder')}
        </output>
      </section>
    </Card>
  );
}
