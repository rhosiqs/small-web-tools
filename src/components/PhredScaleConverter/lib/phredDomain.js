export const FASTQ_PHRED_OFFSETS = Object.freeze({
  phred33: 33,
  phred64: 64,
});

function isSupportedFastqOffset(offset) {
  return offset === FASTQ_PHRED_OFFSETS.phred33 || offset === FASTQ_PHRED_OFFSETS.phred64;
}

export function decodeFastqQualityString(rawValue, offset) {
  if (typeof rawValue !== 'string' || rawValue.length === 0) return null;
  if (!isSupportedFastqOffset(offset)) return null;

  const scores = [];
  for (let index = 0; index < rawValue.length; index += 1) {
    const code = rawValue.charCodeAt(index);
    if (code < offset || code > 126) return null;
    scores.push(code - offset);
  }
  return scores;
}

export function parseFastqQualityScores(rawValue, offset) {
  if (typeof rawValue !== 'string' || !rawValue.trim() || !isSupportedFastqOffset(offset)) return null;

  const maxScore = 126 - offset;
  const tokens = rawValue.trim().split(/[\s,]+/);
  const scores = tokens.map((token) => Number(token));
  if (scores.some((score) => !Number.isInteger(score) || score < 0 || score > maxScore)) return null;
  return scores;
}

export function encodeFastqQualityScores(rawValue, offset) {
  const scores = parseFastqQualityScores(rawValue, offset);
  if (!scores) return null;
  return scores.map((score) => String.fromCharCode(score + offset)).join('');
}

export function fastqCodeForScore(score, offset) {
  if (!Number.isInteger(score) || !isSupportedFastqOffset(offset) || score < 0 || score > 126 - offset) {
    return null;
  }
  return String.fromCharCode(score + offset);
}

export function formatFastqQualityScores(scores) {
  return Array.isArray(scores) ? scores.join(' ') : '';
}

export function phredToErrorProbability(score) {
  if (!Number.isFinite(score) || score < 0 || score > 300) return null;
  return 10 ** (-score / 10);
}

export function errorProbabilityToPhred(probability) {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) return null;
  return -10 * Math.log10(probability);
}

export function calculatePhredMetrics(mode, rawValue) {
  const value = Number(rawValue);
  if (!rawValue.trim() || !Number.isFinite(value)) return null;

  const score = mode === 'score' ? value : errorProbabilityToPhred(value);
  const errorProbability = mode === 'score' ? phredToErrorProbability(value) : value;
  if (score === null || errorProbability === null) return null;

  return {
    score,
    errorProbability,
    accuracy: 1 - errorProbability,
    oneIn: 1 / errorProbability,
  };
}

export function formatProbability(value) {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: 15,
  }).format(value);
}

export function formatPhredScore(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
