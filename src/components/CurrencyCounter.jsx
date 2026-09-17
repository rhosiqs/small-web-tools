import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import ResultDisplay from './ui/ResultDisplay';
import {
  convertCurrencyAmount,
  getConversionRate,
  parsePositiveRate,
  swapCurrencies,
} from '../lib/currency';
import { parseAmountLines as parseStrictAmountLines } from '../lib/numberParsing';
import { grantConsent, hasConsent } from '../lib/thirdPartyServices';

const currencyDetails = {
  USD: { name: "US Dollar", locale: "en-US", symbol: "$", flag: "🇺🇸" },
  EUR: { name: "Euro", locale: "de-DE", symbol: "€", flag: "🇪🇺" },
  GBP: { name: "British Pound", locale: "en-GB", symbol: "£", flag: "🇬🇧" },
  JPY: { name: "Japanese Yen", locale: "ja-JP", symbol: "¥", flag: "🇯🇵" },
  CNY: { name: "Chinese Yuan", locale: "zh-CN", symbol: "¥", flag: "🇨🇳" },
  TWD: { name: "New Taiwan Dollar", locale: "zh-TW", symbol: "NT$", flag: "🇹🇼" },
  HKD: { name: "Hong Kong Dollar", locale: "zh-HK", symbol: "HK$", flag: "🇭🇰" },
  SGD: { name: "Singapore Dollar", locale: "en-SG", symbol: "S$", flag: "🇸🇬" },
  CAD: { name: "Canadian Dollar", locale: "en-CA", symbol: "C$", flag: "🇨🇦" },
  AUD: { name: "Australian Dollar", locale: "en-AU", symbol: "A$", flag: "🇦🇺" },
  KRW: { name: "South Korean Won", locale: "ko-KR", symbol: "₩", flag: "🇰🇷" },
  INR: { name: "Indian Rupee", locale: "en-IN", symbol: "₹", flag: "🇮🇳" },
  PHP: { name: "Philippine Peso", locale: "en-PH", symbol: "₱", flag: "🇵🇭" },
  MYR: { name: "Malaysian Ringgit", locale: "en-MY", symbol: "RM", flag: "🇲🇾" },
  THB: { name: "Thai Baht", locale: "th-TH", symbol: "฿", flag: "🇹🇭" },
  VND: { name: "Vietnamese Dong", locale: "vi-VN", symbol: "₫", flag: "🇻🇳" },
  NZD: { name: "New Zealand Dollar", locale: "en-NZ", symbol: "NZ$", flag: "🇳🇿" },
  CHF: { name: "Swiss Franc", locale: "de-CH", symbol: "CHF", flag: "🇨🇭" },
  ZAR: { name: "South African Rand", locale: "en-ZA", symbol: "R", flag: "🇿🇦" },
  BRL: { name: "Brazilian Real", locale: "pt-BR", symbol: "R$", flag: "🇧🇷" },
  MXN: { name: "Mexican Peso", locale: "es-MX", symbol: "$", flag: "🇲🇽" },
};

export default function CurrencyCounter() {
  const { t, i18n } = useTranslation('tools');
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
  const [rates, setRates] = useState({});
  const [lastUpdated, setLastUpdated] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [rateProvider, setRateProvider] = useState('');
  const [ratesStale, setRatesStale] = useState(false);
  const [currencyConsent, setCurrencyConsent] = useState(() => hasConsent('currency'));

  // Quick Convert state
  const [singleAmount, setSingleAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('TWD');
  const [toCurrency, setToCurrency] = useState('USD');

  // Bulk Convert state
  const [bulkInput, setBulkInput] = useState('');
  const [numberFormat, setNumberFormat] = useState('auto');
  const [bulkFromCurrency, setBulkFromCurrency] = useState('TWD');
  const [bulkToCurrency, setBulkToCurrency] = useState('USD');

  // Manual Rate state
  const [isManualRate, setIsManualRate] = useState(false);
  const [manualRate, setManualRate] = useState('0.03086');
  const [manualRateError, setManualRateError] = useState('');

  useEffect(() => {
    const handleConsentUpdate = () => setCurrencyConsent(hasConsent('currency'));
    window.addEventListener('consent_updated', handleConsentUpdate);
    return () => window.removeEventListener('consent_updated', handleConsentUpdate);
  }, []);

  useEffect(() => {
    if (!currencyConsent || isManualRate) {
      setIsLoading(false);
      if (!currencyConsent) {
        setRates({});
        setRatesStale(false);
        setLastUpdated(t('tool-currency.ui.consentRequired'));
      }
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    fetch('/api/exchange-rates', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        if (data?.ok && data.rates) {
          setRates(data.rates);
          setRatesStale(false);
          setRateProvider(data.provider || t('tool-currency.ui.exchangeProvider'));
          setLastUpdated(data.dataDate
            ? new Date(data.dataDate).toLocaleString(i18n.language)
            : new Date(data.fetchedAt).toLocaleString(i18n.language));
          setApiError(null);
        } else {
          throw new Error(data?.error || 'Invalid exchange-rate response');
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setApiError(t('tool-currency.ui.apiError'));
          setRates((previousRates) => {
            if (Object.keys(previousRates).length > 0) {
              setRatesStale(true);
            } else {
              setLastUpdated(t('tool-currency.ui.ratesUnavailable'));
            }
            return previousRates;
          });
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [currencyConsent, i18n.language, isManualRate, t]);

  // Determine active rate based on options
  const getRate = (from, to) => getConversionRate({
    isManualRate,
    manualRate,
    rates,
    from,
    to,
  });

  // Quick Convert calculations
  const currentRate = getRate(fromCurrency, toCurrency);
  const convertedAmount = convertCurrencyAmount(singleAmount, currentRate);

  // Bulk Convert calculations
  const bulkRate = getRate(bulkFromCurrency, bulkToCurrency);
  const parsedLineItems = parseStrictAmountLines(bulkInput, numberFormat);
  const validItems = parsedLineItems.filter((item) => item.value !== null);
  const lineCount = validItems.length;
  const sourceTotal = validItems.reduce((sum, item) => sum + item.value, 0);
  const convertedTotal = convertCurrencyAmount(sourceTotal, bulkRate);
  const effectiveManualRateError = isManualRate && parsePositiveRate(manualRate) === null
    ? t('tool-currency.ui.manualRateError')
    : manualRateError;

  const applySwap = (from, setFrom, to, setTo, amount) => {
    const swapped = swapCurrencies({
      from,
      to,
      amount,
      manualRate,
      isManualRate,
    });
    setManualRateError(swapped.error ? t('tool-currency.ui.manualRateSwapError') : '');
    if (swapped.error) return;
    setFrom(swapped.from);
    setTo(swapped.to);
    setManualRate(swapped.manualRate);
  };

  const handleSwap = () => applySwap(
    fromCurrency,
    setFromCurrency,
    toCurrency,
    setToCurrency,
    singleAmount,
  );

  const handleBulkSwap = () => applySwap(
    bulkFromCurrency,
    setBulkFromCurrency,
    bulkToCurrency,
    setBulkToCurrency,
    bulkInput,
  );

  // Formatting helpers
  const formatCurrency = (value, code) => {
    return new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: code,
    }).format(value);
  };
  const currencyNames = new Intl.DisplayNames([i18n.language], { type: 'currency' });

  return (
    <Card id="tool-currency" variant="tool">
      <ToolHeader title={t('tool-currency.title')} />
      <p className="text-xs text-text-muted">
        {t('tool-currency.ui.description')}
      </p>

      {/* Tabs */}
      <div className="tool-tabs flex gap-2">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-md border text-[0.85rem] font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] font-sans ${
            activeTab === 'single'
              ? 'bg-accent-fill text-accent-on-fill border-accent shadow-[0_4px_14px_rgba(16,185,129,0.3)]'
              : 'border-border bg-card text-text-muted hover:border-accent hover:text-accent hover:bg-nav-hover-bg'
          }`}
          onClick={() => setActiveTab('single')}
        >
          {t('tool-currency.ui.quickConvert')}
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-md border text-[0.85rem] font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] font-sans ${
            activeTab === 'bulk'
              ? 'bg-accent-fill text-accent-on-fill border-accent shadow-[0_4px_14px_rgba(16,185,129,0.3)]'
              : 'border-border bg-card text-text-muted hover:border-accent hover:text-accent hover:bg-nav-hover-bg'
          }`}
          onClick={() => setActiveTab('bulk')}
        >
          {t('tool-currency.ui.bulkConvert')}
        </button>
      </div>

      {/* API Banner / Status Info */}
      <div className="text-xs min-h-[18px] text-text-muted font-medium px-3 py-1.5 rounded bg-app border border-border flex justify-between flex-wrap gap-2">
        <span>
          <strong>{t('tool-currency.ui.rateSource')}:</strong>{' '}
          {isManualRate
            ? t('tool-currency.ui.localManualRate')
            : !currencyConsent
              ? t('tool-currency.ui.consentRequired')
              : isLoading
                ? t('tool-currency.ui.loading')
                : ratesStale
                  ? t('tool-currency.ui.staleSource', { provider: rateProvider || t('tool-currency.ui.liveApi') })
                  : apiError
                    ? t('tool-currency.ui.offline')
                    : rateProvider || t('tool-currency.ui.liveApi')}
        </span>
        <span>
          <strong>{t('tool-currency.ui.lastUpdated')}:</strong> {isManualRate ? t('tool-currency.ui.notAvailable') : lastUpdated}
        </span>
      </div>

      {!currencyConsent && !isManualRate && (
        <div className="p-3 bg-app border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
          <span>
            {t('tool-currency.ui.consentDescription')}
          </span>
          <button
            type="button"
            onClick={() => grantConsent('currency')}
            className="px-3 py-1.5 rounded border border-accent text-accent font-semibold shrink-0"
          >
            {t('tool-currency.ui.allowLiveRates')}
          </button>
        </div>
      )}

      {apiError && !isManualRate && (
        <p className="text-xs text-red-500 m-0 p-2 rounded bg-red-500/10 border border-red-500/20">
          ⚠️ {apiError}
        </p>
      )}

      {/* Manual Rate Override Accordion/Input */}
      <div className="flex items-center gap-3 rounded border border-dashed border-border bg-app px-3 py-2 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-2">
        <input
          type="checkbox"
          id="toggle-manual-rate"
          className="w-auto cursor-pointer"
          checked={isManualRate}
          onChange={(e) => {
            setIsManualRate(e.target.checked);
            if (e.target.checked) {
              const currentNormalRate = getRate(
                activeTab === 'single' ? fromCurrency : bulkFromCurrency,
                activeTab === 'single' ? toCurrency : bulkToCurrency
              );
              if (currentNormalRate !== null) setManualRate(currentNormalRate.toFixed(6));
            }
          }}
        />
        <label htmlFor="toggle-manual-rate" className="cursor-pointer select-none text-sm text-text-main font-semibold">{t('tool-currency.ui.enableManualRate')}</label>
        
        {isManualRate && (
          <div className="flex items-center gap-2 ml-auto max-[480px]:ml-0 max-[480px]:mt-1">
            <span className="text-xs text-text-muted">
              1 {activeTab === 'single' ? fromCurrency : bulkFromCurrency} =
            </span>
            <input
              type="number"
              step="any"
              className="max-w-[120px] px-2.5 py-1.5 text-sm rounded border border-border bg-card text-text-main outline-none focus:border-accent focus:ring-2 focus:ring-focus"
              value={manualRate}
              onChange={(e) => {
                setManualRate(e.target.value);
                setManualRateError(parsePositiveRate(e.target.value) === null
                  ? t('tool-currency.ui.manualRateError')
                  : '');
              }}
              placeholder={t('tool-currency.ui.rate')}
            />
            <span className="text-xs text-text-muted">
              {activeTab === 'single' ? toCurrency : bulkToCurrency}
            </span>
          </div>
        )}
      </div>
      {effectiveManualRateError && (
        <p role="alert" className="text-xs text-red-500 m-0">{effectiveManualRateError}</p>
      )}

      {/* Tab Content: Quick Convert */}
      {activeTab === 'single' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <div className="flex flex-col gap-2 w-full flex-1">
              <label className="text-sm font-semibold text-text-main" htmlFor="currency-amount">{t('tool-currency.ui.amount')}</label>
              <input
                type="number"
                id="currency-amount"
                className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="flex gap-4 w-full items-end max-md:flex-col max-md:items-stretch">
            <div className="flex flex-col gap-2 w-full flex-[2]">
              <label className="text-sm font-semibold text-text-main" htmlFor="from-currency">{t('tool-currency.ui.from')}</label>
              <select
                id="from-currency"
                className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
              >
                {Object.entries(currencyDetails).map(([code, details]) => (
                  <option key={code} value={code}>
                    {details.flag} {code} - {currencyNames.of(code)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center w-[42px] h-[42px] min-w-[42px] rounded-full border border-border bg-card text-text-muted cursor-pointer self-end mb-0.5 transition-all duration-200 hover:border-accent hover:text-accent hover:rotate-180 max-md:self-center max-md:my-1"
              onClick={handleSwap}
              title={t('tool-currency.ui.swap')}
            >
              ⇄
            </button>

            <div className="flex flex-col gap-2 w-full flex-[2]">
              <label className="text-sm font-semibold text-text-main" htmlFor="to-currency">{t('tool-currency.ui.to')}</label>
              <select
                id="to-currency"
                className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
              >
                {Object.entries(currencyDetails).map(([code, details]) => (
                  <option key={code} value={code}>
                    {details.flag} {code} - {currencyNames.of(code)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-app p-3 text-center">
            <div className="text-[1.3rem] min-[480px]:text-2xl md:text-[2rem] font-bold text-accent mb-2 break-all font-display">
              {convertedAmount === null ? t('tool-currency.ui.rateUnavailable') : formatCurrency(convertedAmount, toCurrency)}
            </div>
            <div className="text-sm text-text-muted">
              {currentRate === null ? (
                <span>{t('tool-currency.ui.provideRate')}</span>
              ) : (
                <>
                  {formatCurrency(1, fromCurrency)} = {formatCurrency(currentRate, toCurrency)}
                  <br />
                  <span className="text-xs opacity-85">
                    {formatCurrency(1, toCurrency)} = {formatCurrency(1 / currentRate, fromCurrency)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Bulk Convert & Count */}
      {activeTab === 'bulk' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 w-full items-end max-md:flex-col max-md:items-stretch">
            <div className="flex flex-col gap-2 w-full flex-[2]">
              <label className="text-sm font-semibold text-text-main" htmlFor="bulk-from-currency">{t('tool-currency.ui.sourceCurrency')}</label>
              <select
                id="bulk-from-currency"
                className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
                value={bulkFromCurrency}
                onChange={(e) => setBulkFromCurrency(e.target.value)}
              >
                {Object.entries(currencyDetails).map(([code, details]) => (
                  <option key={code} value={code}>
                    {details.flag} {code} - {currencyNames.of(code)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center w-[42px] h-[42px] min-w-[42px] rounded-full border border-border bg-card text-text-muted cursor-pointer self-end mb-0.5 transition-all duration-200 hover:border-accent hover:text-accent hover:rotate-180 max-md:self-center max-md:my-1"
              onClick={handleBulkSwap}
              title={t('tool-currency.ui.swap')}
            >
              ⇄
            </button>

            <div className="flex flex-col gap-2 w-full flex-[2]">
              <label className="text-sm font-semibold text-text-main" htmlFor="bulk-to-currency">{t('tool-currency.ui.targetCurrency')}</label>
              <select
                id="bulk-to-currency"
                className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card"
                value={bulkToCurrency}
                onChange={(e) => setBulkToCurrency(e.target.value)}
              >
                {Object.entries(currencyDetails).map(([code, details]) => (
                  <option key={code} value={code}>
                    {details.flag} {code} - {currencyNames.of(code)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-text-main" htmlFor="currency-bulk-input">
                {t('tool-currency.ui.amounts')}
              </label>
              <select
                aria-label={t('tool-currency.ui.numberFormat')}
                value={numberFormat}
                onChange={(event) => setNumberFormat(event.target.value)}
                className="px-2.5 py-1.5 text-xs rounded border border-border bg-card text-text-main"
              >
                <option value="auto">{t('tool-currency.ui.autoStrict')}</option>
                <option value="dot">1,234.56</option>
                <option value="comma">1.234,56</option>
              </select>
            </div>
            <textarea
              id="currency-bulk-input"
              className="w-full px-3.5 py-2.5 text-[0.92rem] rounded border border-border bg-app text-text-main outline-none transition-all duration-200 hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-focus focus:bg-card resize-none"
              rows={3}
              placeholder={"100\n250.50\n1,234.56"}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full mt-2">
            <ResultDisplay
              label={t('tool-currency.ui.total', { currency: bulkFromCurrency })}
              value={formatCurrency(sourceTotal, bulkFromCurrency)}
              className="flex-1"
              id="currency-source-total"
            />
            <ResultDisplay
              label={t('tool-currency.ui.total', { currency: bulkToCurrency })}
              value={convertedTotal === null ? t('tool-currency.ui.rateUnavailable') : formatCurrency(convertedTotal, bulkToCurrency)}
              className="flex-1"
              id="currency-target-total"
            />
            <ResultDisplay
              label={t('tool-currency.ui.linesCounted')}
              value={lineCount.toLocaleString(i18n.language)}
              className="flex-1"
              id="currency-line-count"
            />
          </div>

          {parsedLineItems.length > 0 && (
            <div className="mt-2">
              <label className="text-xs font-semibold text-text-main mb-1 block">{t('tool-currency.ui.lineBreakdown')}</label>
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto mt-2 p-3 bg-app border border-border rounded-md font-mono text-sm">
                {parsedLineItems.map((item) => (
                  <div key={item.lineNumber} className="flex justify-between border-b border-black/5 dark:border-white/5 pb-1">
                    {item.error ? (
                      <span className="text-red-500">{t('tool-currency.ui.lineError', {
                        line: item.lineNumber,
                        error: t(`tool-currency.ui.numberError.${item.errorCode || 'invalid'}`),
                      })}</span>
                    ) : (
                      <>
                        <span>{t('tool-currency.ui.lineValue', {
                          line: item.lineNumber,
                          value: formatCurrency(item.value, bulkFromCurrency),
                        })}</span>
                        <span className="text-accent">
                          ⇄ {bulkRate === null ? t('tool-currency.ui.rateUnavailable') : formatCurrency(item.value * bulkRate, bulkToCurrency)}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
