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
} from './PhredScaleConverter/lib/phredDomain';

const REFERENCE_SCORES = [10, 20, 30, 40];
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

export default function PhredScaleConverter() {
  const { t } = useTranslation('tools');

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

  const scoreHasError = Boolean(scoreInput.trim()) && !singleScoreMetrics && encodedQuality === null;
  const probabilityHasError = Boolean(probabilityInput.trim())
    && !calculatePhredMetrics('probability', probabilityInput);
  const fastqHasError = fastqInput.length > 0 && !decodedScores;
  const fastqEncodingUnavailable = Boolean(scoreInput.trim())
    && Boolean(singleScoreMetrics)
    && encodedQuality === null;

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
    <Card id="tool-phred" variant="tool" size="wide" className="max-w-[980px]">
      <ToolHeader title={t('tool-phred.title')} />

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-app/70 p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phred-offset" className="text-sm font-bold text-text-main">FASTQ</label>
          <select
            id="phred-offset"
            value={offset}
            onChange={(event) => handleOffsetChange(Number(event.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold text-text-main outline-none transition-all hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus"
          >
            {OFFSET_OPTIONS.map((option) => (
              <option key={option.id} value={option.offset}>
                {option.label} — {option.detail}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-muted">
            <span className="font-mono font-semibold">{selectedOffset?.label}</span>
            {' · '}
            {selectedOffset?.detail}
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phred-fastq-input" className="text-sm font-bold text-text-main">FASTQ</label>
            <textarea
              id="phred-fastq-input"
              rows={6}
              value={fastqInput}
              onChange={(event) => handleFastqChange(event.target.value)}
              spellCheck={false}
              aria-invalid={fastqHasError || undefined}
              className={`h-40 min-h-40 w-full resize-y rounded-lg border bg-card px-4 py-3 font-mono text-base font-semibold text-text-main outline-none transition-all focus:ring-2 ${
                fastqHasError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                  : 'border-border hover:border-border-hover focus:border-accent focus:ring-focus'
              }`}
            />
            {fastqHasError && (
              <p role="alert" className="text-xs text-red-500">ASCII {offset}–126</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phred-score-input" className="text-sm font-bold text-text-main">
              {t('tool-phred.ui.scoreTab')}
            </label>
            <textarea
              id="phred-score-input"
              rows={6}
              value={scoreInput}
              onChange={(event) => handleScoreChange(event.target.value)}
              spellCheck={false}
              aria-invalid={scoreHasError || undefined}
              className={`h-40 min-h-40 w-full resize-y rounded-lg border bg-card px-4 py-3 font-mono text-base font-semibold text-text-main outline-none transition-all focus:ring-2 ${
                scoreHasError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                  : 'border-border hover:border-border-hover focus:border-accent focus:ring-focus'
              }`}
            />
            {scoreHasError && (
              <p role="alert" className="text-xs text-red-500">{t('tool-phred.ui.scoreError')}</p>
            )}
            {fastqEncodingUnavailable && conversionSource === 'scores' && (
              <p className="text-xs text-text-muted">{FASTQ_SCORE_RANGE_PREFIX}{126 - offset}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phred-probability-input" className="text-sm font-bold text-text-main">
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
            className={`w-full rounded-lg border bg-card px-4 py-3 font-mono text-base font-semibold text-text-main outline-none transition-all focus:ring-2 ${
              probabilityHasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                : 'border-border hover:border-border-hover focus:border-accent focus:ring-focus'
            }`}
          />
          {probabilityHasError && (
            <p role="alert" className="text-xs text-red-500">{t('tool-phred.ui.probabilityError')}</p>
          )}
          <p className="text-sm text-text-muted">{PHRED_FORMULA}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="phred-reference-title">
        <div>
          <h3 id="phred-reference-title" className="text-sm font-bold text-text-main">
            {t('tool-phred.ui.referenceTitle')}
          </h3>
          <p className="text-xs text-text-muted">{t('tool-phred.ui.referenceDescription')}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-app text-left text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2">Q</th>
                <th className="px-3 py-2">{OFFSET_OPTIONS[0].label}</th>
                <th className="px-3 py-2">{OFFSET_OPTIONS[1].label}</th>
                <th className="px-3 py-2">{t('tool-phred.ui.errorProbability')}</th>
              </tr>
            </thead>
            <tbody>
              {REFERENCE_SCORES.map((score) => {
                const row = calculatePhredMetrics('score', String(score));
                return (
                  <tr key={score} className="border-t border-border bg-card hover:bg-accent-light/40">
                    <td className="p-0">
                      <button
                        type="button"
                        onClick={() => applyReferenceScore(score)}
                        className="w-full px-3 py-2 text-left font-mono font-extrabold text-accent"
                        aria-label={t('tool-phred.ui.useScoreAria', { score })}
                      >
                        {score}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono">{fastqCodeForScore(score, FASTQ_PHRED_OFFSETS.phred33)}</td>
                    <td className="px-3 py-2 font-mono">{fastqCodeForScore(score, FASTQ_PHRED_OFFSETS.phred64)}</td>
                    <td className="px-3 py-2 font-mono">{formatProbability(row.errorProbability)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">{t('tool-phred.ui.note')}</p>
      </section>
    </Card>
  );
}
