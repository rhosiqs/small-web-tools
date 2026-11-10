export function swapCurrencies(state) {
  const result = {
    from: state.to,
    to: state.from,
    amount: state.amount,
    manualRate: state.manualRate,
    error: null,
  };

  if (!state.isManualRate) return result;
  const rate = Number(state.manualRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      ...state,
      error: 'Manual rate must be a finite number greater than zero before swapping.',
    };
  }

  result.manualRate = String(Number((1 / rate).toPrecision(15)));
  return result;
}

export function parsePositiveRate(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function getConversionRate({ isManualRate, manualRate, rates, from, to }) {
  if (isManualRate) return parsePositiveRate(manualRate);
  const sourceRate = parsePositiveRate(rates?.[from]);
  const targetRate = parsePositiveRate(rates?.[to]);
  if (sourceRate === null || targetRate === null) return null;
  const rate = targetRate / sourceRate;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convertCurrencyAmount(amount, rate) {
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const numericAmount = Number(amount);
  const validRate = parsePositiveRate(rate);
  if (!Number.isFinite(numericAmount) || validRate === null) return null;
  const result = numericAmount * validRate;
  return Number.isFinite(result) ? result : null;
}

/**
 * Formats an exchange rate with at least five significant digits. The plain
 * currency format rounds to the minor unit, which turns 1 TWD = 0.03086 USD
 * into "$0.03" and 1 VND = 0.000038 USD into "$0.00".
 */
export function formatCurrencyRate(value, code, locale) {
  const base = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
  if (!Number.isFinite(value) || value === 0) return base.format(value);

  const minimumFractionDigits = base.resolvedOptions().minimumFractionDigits;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const maximumFractionDigits = Math.min(20, Math.max(minimumFractionDigits, 4 - magnitude));
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}
