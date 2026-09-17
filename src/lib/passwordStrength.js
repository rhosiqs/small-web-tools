import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import englishTranslations from '@zxcvbn-ts/language-en/dist/translations.mjs';

const zxcvbn = new ZxcvbnFactory({
  translations: englishTranslations,
  graphs: common.adjacencyGraphs,
  dictionary: common.dictionary,
});

const LABELS = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong'];
const COLORS = ['var(--strength-veryWeak)', 'var(--strength-weak)', 'var(--strength-moderate)',
  'var(--strength-strong)', 'var(--strength-veryStrong)'];

export function calculateTheoreticalEntropy(password, poolSize) {
  if (!password || poolSize <= 0) return 0;
  return Math.round(password.length * Math.log2(poolSize));
}

export function evaluatePasswordStrength(password, isRandomlyGenerated = false, poolSize = 0) {
  if (!password) {
    return {
      score: 0,
      label: 'None',
      color: 'var(--strength-none)',
      entropyBits: 0,
      crackTimeEstimate: 'Instant',
      feedback: ['Enter a password to analyze its strength.'],
    };
  }

  const result = zxcvbn.check(password);
  const entropyBits = isRandomlyGenerated && poolSize > 0
    ? calculateTheoreticalEntropy(password, poolSize)
    : Math.max(0, Math.round(result.guessesLog10 * Math.log2(10)));
  const scoreIndex = Math.max(0, Math.min(4, result.score));
  const feedback = [
    result.feedback.warning,
    ...(result.feedback.suggestions || []),
  ].filter(Boolean);
  if (
    result.sequence.some((match) => match.pattern === 'spatial')
    || /qwerty|asdfgh|zxcvbn|12345|54321/i.test(password)
  ) {
    feedback.push('Contains a predictable keyboard pattern.');
  }
  if (
    result.sequence.some((match) => match.pattern === 'repeat')
    || /(.)\1{2,}/u.test(password)
  ) {
    feedback.push('Contains a repeating pattern.');
  }

  if (feedback.length === 0) {
    feedback.push(scoreIndex >= 3
      ? 'No common dictionary or sequence pattern was detected.'
      : 'Use a longer, less predictable password.');
  }

  return {
    score: scoreIndex + 1,
    label: LABELS[scoreIndex],
    color: COLORS[scoreIndex],
    entropyBits,
    crackTimeEstimate: result.crackTimes.offlineFastHashingXPerSecond.display,
    feedback,
  };
}
