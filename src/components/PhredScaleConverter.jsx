import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import {
  calculatePhredMetrics,
  decodeFastqQualityString,
  encodeFastqQualityScores,
  fastqCodeForScore,
  FASTQ_PHRED_OFFSETS,
  formatFastqQualityScores,
  formatPhredScore,
  formatProbability,
  parseFastqQualityScores,
} from './PhredScaleConverter/lib/phredDomain';

/**
 * The four-row reference table became the log scale it describes: marks a
 * decade apart along a slider, so the distance between Q20 and Q30 reads as the
 * factor of ten it is.
 */
const SCALE_MAX = 60;
const QUALITY_MARKS = [0, 10, 20, 30, 40, 50, 60];
const OFFSET_OPTIONS = [
  {
    id: 'phred33',
    label: 'Phred+33',
    detail: 'Sanger · Illumina 1.8+',
    offset: FASTQ_PHRED_OFFSETS.phred33,
  },
  {
    id: 'phred64',
    label: 'Phred+64',
    detail: 'Illumina 1.3–1.7',
    offset: FASTQ_PHRED_OFFSETS.phred64,
  },
];
const FASTQ_SCORE_RANGE_PREFIX = 'FASTQ: integer Q 0–';
const PHRED_FORMULA = React.createElement(
  React.Fragment,
  null,
  'Q = −10 × log',
  React.createElement('sub', null, '10'),
  '(P) · P = 10',
  React.createElement('sup', null, '−Q/10'),
);

const fieldLabelClass = 'block text-xs font-medium text-text-muted';
const ruleFieldClass =
  'input-rule w-full px-0 pb-2 pt-0 font-mono text-lg leading-relaxed text-text-main placeholder:text-text-muted';

export default function PhredScaleConverter() {
  const { t, i18n } = useTranslation('tools');

  const [scoreInput, setScoreInput] = useState('30');
  const [probabilityInput, setProbabilityInput] = useState('0.001');
  const [offset, setOffset] = useState(Number(FASTQ_PHRED_OFFSETS.phred33));
  const [conversionSource, setConversionSource] = useState('fastq');
  const [fastqInput, setFastqInput] = useState('?');

  const singleScoreMetrics = useMemo(
    () => calculatePhredMetrics('score', scoreInput),
    [scoreInput],
  );
  const encodedQuality = useMemo(
    () => encodeFastqQualityScores(scoreInput, offset),
    [scoreInput, offset],
  );
  const decodedScores = useMemo(
    () => decodeFastqQualityString(fastqInput, offset),
    [fastqInput, offset],
  );
  const parsedScores = useMemo(
    () => parseFastqQualityScores(scoreInput, offset),
    [scoreInput, offset],
  );

  const scoreHasError = Boolean(scoreInput.trim()) && !singleScoreMetrics && encodedQuality === null;
  const probabilityHasError = Boolean(probabilityInput.trim())
    && !calculatePhredMetrics('probability', probabilityInput);
  const fastqHasError = fastqInput.length > 0 && !decodedScores;
  const fastqEncodingUnavailable = Boolean(scoreInput.trim())
    && Boolean(singleScoreMetrics)
    && encodedQuality === null;

  // The headline readout tracks the first score, so a multi-score paste still
  // has something to lead with instead of blanking the whole row.
  const primaryScore = singleScoreMetrics
    ? singleScoreMetrics.score
    : parsedScores?.length
      ? parsedScores[0]
      : null;
  const primaryMetrics = primaryScore === null
    ? null
    : calculatePhredMetrics('score', String(primaryScore));
  const sliderValue = primaryScore === null
    ? 0
    : Math.min(SCALE_MAX, Math.max(0, Math.round(primaryScore)));
  const integerScore = primaryScore !== null && Number.isInteger(primaryScore) ? primaryScore : null;

  const syncProbabilityFromScores = (value) => {
    const nextMetrics = calculatePhredMetrics('score', value);
    setProbabilityInput(nextMetrics ? formatProbability(nextMetrics.errorProbability) : '');
  };

  const handleScoreChange = (value) => {
    setScoreInput(value);
    setConversionSource('scores');
    syncProbabilityFromScores(value);

    const nextQuality = encodeFastqQualityScores(value, offset);
    setFastqInput(nextQuality ?? '');
  };

  const handleProbabilityChange = (value) => {
    setProbabilityInput(value);

    const nextMetrics = calculatePhredMetrics('probability', value);
    if (!nextMetrics) return;

    const nextScore = formatPhredScore(nextMetrics.score);
    setScoreInput(nextScore);
    setConversionSource('scores');

    const nextQuality = encodeFastqQualityScores(nextScore, offset);
    setFastqInput(nextQuality ?? '');
  };

  const handleFastqChange = (value) => {
    setFastqInput(value);
    setConversionSource('fastq');

    const nextScores = decodeFastqQualityString(value, offset);
    if (!nextScores) return;

    const nextScoreInput = formatFastqQualityScores(nextScores);
    setScoreInput(nextScoreInput);
    syncProbabilityFromScores(nextScoreInput);
  };

  const handleOffsetChange = (nextOffset) => {
    setOffset(nextOffset);

    if (conversionSource === 'fastq') {
      const nextScores = decodeFastqQualityString(fastqInput, nextOffset);
      if (!nextScores) return;

      const nextScoreInput = formatFastqQualityScores(nextScores);
      setScoreInput(nextScoreInput);
      syncProbabilityFromScores(nextScoreInput);
      return;
    }

    const nextQuality = encodeFastqQualityScores(scoreInput, nextOffset);
    setFastqInput(nextQuality ?? '');
  };

  const applyReferenceScore = (score) => {
    const value = String(score);
    const nextMetrics = calculatePhredMetrics('score', value);
    setScoreInput(value);
    setProbabilityInput(formatProbability(nextMetrics.errorProbability));
    setConversionSource('scores');

    const nextQuality = encodeFastqQualityScores(value, offset);
    setFastqInput(nextQuality ?? '');
  };

  const selectedOffset = OFFSET_OPTIONS.find((option) => option.offset === offset);

  return (
    <Card id="tool-phred" variant="tool" size="wide" className="max-w-[900px] gap-6 p-6 sm:p-8">
      <ToolHeader title={t('tool-phred.title')} kicker={t('navigation:categories.bioinfo')} />

      <section className="flex flex-wrap items-end gap-6">
        <div className="flex-none">
          <span className={fieldLabelClass}>{t('tool-phred.ui.score')}</span>
          <p className="m-0 mt-1 font-mono text-[3.5rem] leading-none text-text-main">
            {primaryScore === null ? '—' : `Q${formatPhredScore(primaryScore)}`}
          </p>
        </div>

        <div className="min-w-[200px] flex-[1_1_220px] rounded-lg bg-accent-light px-4 py-3 ring-1 ring-accent-edge">
          <label htmlFor="phred-probability-input" className="mb-1.5 block text-xs font-medium text-accent">
            {t('tool-phred.ui.errorProbability')}
          </label>
          <input
            id="phred-probability-input"
            type="number"
            min={Number.MIN_VALUE}
            max="1"
            step="any"
            value={probabilityInput}
            onChange={(event) => handleProbabilityChange(event.target.value)}
            aria-invalid={probabilityHasError || undefined}
            aria-describedby={probabilityHasError ? 'phred-probability-error' : undefined}
            className="input-rule w-full px-0 pb-1.5 pt-0 font-mono text-xl leading-tight text-text-main"
          />
          {probabilityHasError ? (
            <p id="phred-probability-error" role="alert" className="m-0 mt-1.5 text-[0.6875rem] text-red-500">
              {t('tool-phred.ui.probabilityError')}
            </p>
          ) : (
            <p className="m-0 mt-1.5 text-[0.6875rem] text-text-muted">
              {primaryMetrics
                ? t('tool-phred.ui.oneIn', {
                  count: new Intl.NumberFormat(i18n.resolvedLanguage).format(Math.round(primaryMetrics.oneIn)),
                })
                : '—'}
            </p>
          )}
        </div>

        <div className="flex flex-none gap-6">
          {OFFSET_OPTIONS.map((option) => (
            <div key={option.id}>
              <span className="block font-mono text-[0.5938rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {option.label}
              </span>
              <p className="m-0 mt-1.5 font-mono text-2xl leading-none text-accent">
                {(integerScore === null ? null : fastqCodeForScore(integerScore, option.offset)) ?? '—'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="phred-scale-title" className="flex flex-col gap-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 id="phred-scale-title" className="m-0 text-[0.9375rem] font-medium text-text-main">
              {t('tool-phred.ui.referenceTitle')}
            </h3>
            <p className="m-0 mt-0.5 text-xs text-text-muted">{t('tool-phred.ui.referenceDescription')}</p>
          </div>
        </div>

        <input
          id="phred-scale"
          type="range"
          min="0"
          max={SCALE_MAX}
          step="1"
          value={sliderValue}
          onChange={(event) => applyReferenceScore(Number(event.target.value))}
          aria-label={t('tool-phred.ui.scaleLabel')}
          className="mt-2 h-6 w-full cursor-pointer bg-transparent accent-[var(--accent)]"
        />

        <div className="relative h-14">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-border to-accent-edge"
          />
          {QUALITY_MARKS.map((mark) => {
            const active = mark === sliderValue;
            return (
              <button
                key={mark}
                type="button"
                onClick={() => applyReferenceScore(mark)}
                aria-label={t('tool-phred.ui.useScoreAria', { score: mark })}
                aria-pressed={active}
                style={{ left: `${(mark / SCALE_MAX) * 100}%` }}
                className={`absolute top-0 -translate-x-1/2 whitespace-nowrap border-0 bg-transparent px-2 pt-1.5 transition-colors ${
                  active ? 'text-accent' : 'text-text-muted hover:text-accent'
                }`}
              >
                <span aria-hidden="true" className="mx-auto mb-1.5 block h-2.5 w-px bg-current" />
                <span className="block font-mono text-[0.6875rem] leading-none">Q{mark}</span>
                <span className="mt-1 block font-mono text-[0.5938rem] leading-none opacity-70">
                  {mark === 0 ? '1' : `1e-${mark / 10}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rule-fade" role="presentation" />

      <section className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="phred-fastq-input" className={`${fieldLabelClass} mb-2`}>
            {t('tool-phred.ui.fastqString')}
          </label>
          <textarea
            id="phred-fastq-input"
            rows={2}
            value={fastqInput}
            onChange={(event) => handleFastqChange(event.target.value)}
            spellCheck={false}
            aria-invalid={fastqHasError || undefined}
            aria-describedby={fastqHasError ? 'phred-fastq-error' : undefined}
            className={`${ruleFieldClass} resize-y break-all`}
          />
          {fastqHasError && (
            <p id="phred-fastq-error" role="alert" className="m-0 mt-2 text-xs text-red-500">
              ASCII {offset}–126
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phred-score-input" className={`${fieldLabelClass} mb-2`}>
            {t('tool-phred.ui.scoreTab')}
          </label>
          <textarea
            id="phred-score-input"
            rows={2}
            value={scoreInput}
            onChange={(event) => handleScoreChange(event.target.value)}
            spellCheck={false}
            aria-invalid={scoreHasError || undefined}
            aria-describedby={scoreHasError ? 'phred-score-error' : undefined}
            className={`${ruleFieldClass} resize-y break-all`}
          />
          {scoreHasError && (
            <p id="phred-score-error" role="alert" className="m-0 mt-2 text-xs text-red-500">
              {t('tool-phred.ui.scoreError')}
            </p>
          )}
          {fastqEncodingUnavailable && conversionSource === 'scores' && (
            <p className="m-0 mt-2 text-xs text-text-muted">{FASTQ_SCORE_RANGE_PREFIX}{126 - offset}</p>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="m-0 font-mono text-[0.9375rem] leading-loose text-text-muted">{PHRED_FORMULA}</p>
        <div
          className="flex rounded border border-border p-0.5"
          role="group"
          aria-label={t('tool-phred.ui.offsetGroup')}
        >
          {OFFSET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleOffsetChange(option.offset)}
              aria-pressed={option.offset === offset}
              title={option.detail}
              className={`rounded px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors ${
                option.offset === offset ? 'bg-accent text-white' : 'text-text-muted hover:text-accent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="m-0 text-xs text-text-muted">{selectedOffset?.detail}</p>
      </section>

      <p className="m-0 text-xs text-text-muted">{t('tool-phred.ui.note')}</p>
    </Card>
  );
}
