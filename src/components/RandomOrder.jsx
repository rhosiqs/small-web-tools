import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import {
  createShuffleRecord,
  verifyShuffleRecord,
} from '../lib/verifiableRandom';

const SEPARATORS = [
  { id: 'lines', pattern: /\r?\n/ },
  { id: 'commas', pattern: /[,，\r\n]/ },
  { id: 'spaces', pattern: /[\s,，]+/ },
];

const DEFAULT_ENTRIES = 'A\nB\nC\nD\nE';
const REVEAL_TOTAL_MS = 1200;
const MIN_REVEAL_STEP_MS = 45;
const MAX_REVEAL_STEP_MS = 160;

export function parseEntries(text, separatorId) {
  const separator = SEPARATORS.find((item) => item.id === separatorId) ?? SEPARATORS[0];
  return String(text)
    .split(separator.pattern)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function RandomOrder() {
  const { t } = useTranslation('tools');
  const [text, setText] = useState(DEFAULT_ENTRIES);
  const [separatorId, setSeparatorId] = useState('lines');
  const [record, setRecord] = useState(/** @type {any} */ (null));
  const [revealed, setRevealed] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const revealTimerRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));

  const entries = useMemo(() => parseEntries(text, separatorId), [text, separatorId]);

  const stopReveal = useCallback(() => {
    if (revealTimerRef.current !== null) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopReveal, [stopReveal]);

  const draw = async () => {
    if (isDrawing) return;
    setCopied(false);
    if (entries.length === 0) {
      setStatus(t('tool-shuffle.ui.needEntries'));
      return;
    }

    let nextRecord;
    try {
      nextRecord = await createShuffleRecord(entries);
    } catch {
      setStatus(t('tool-shuffle.ui.drawFailed'));
      return;
    }

    const total = nextRecord.result.length;
    stopReveal();
    setStatus('');
    setRecord(nextRecord);
    // The first entry lands immediately; the rest are dealt out one at a time.
    setRevealed(1);
    if (total === 1) return;

    setIsDrawing(true);
    const step = Math.min(
      MAX_REVEAL_STEP_MS,
      Math.max(MIN_REVEAL_STEP_MS, Math.round(REVEAL_TOTAL_MS / total)),
    );
    revealTimerRef.current = setInterval(() => {
      setRevealed((current) => {
        const next = current + 1;
        if (next >= total) {
          stopReveal();
          setIsDrawing(false);
          return total;
        }
        return next;
      });
    }, step);
  };

  const clearAll = () => {
    stopReveal();
    setIsDrawing(false);
    setText('');
    setRecord(null);
    setRevealed(0);
    setStatus('');
    setCopied(false);
  };

  const copyResult = async () => {
    if (!record) return;
    await navigator.clipboard.writeText(
      record.result.map((entry, index) => `${index + 1}. ${entry}`).join('\n'),
    );
    setCopied(true);
  };

  const copyRecord = async () => {
    if (!record) return;
    await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
  };

  const downloadRecord = () => {
    if (!record) return;
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'random-order-draw-record.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const verifyImportedRecord = async () => {
    try {
      const parsed = JSON.parse(verificationInput);
      const result = await verifyShuffleRecord(parsed);
      setVerificationStatus(result.valid
        ? t('tool-shuffle.ui.verifiedOrder', { first: result.result[0] })
        : t('tool-shuffle.ui.invalidRecord'));
    } catch {
      setVerificationStatus(t('tool-shuffle.ui.invalidJson'));
    }
  };

  const visibleResult = record ? record.result.slice(0, revealed) : [];

  return (
    <Card id="tool-shuffle" variant="tool" size="wide">
      <ToolHeader title={t('tool-shuffle.ui.title')} />

      <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-2">

        {/* Entries */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-sidebar p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold text-text-main">{t('tool-shuffle.ui.entries')}</h2>
            <span className="text-xs text-text-muted">
              {t('tool-shuffle.ui.entryCount', { total: entries.length })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">{t('tool-shuffle.ui.separator')}</span>
            {SEPARATORS.map((separator) => (
              <Button
                key={separator.id}
                size="sm"
                variant="secondary"
                active={separatorId === separator.id}
                onClick={() => setSeparatorId(separator.id)}
                disabled={isDrawing}
              >
                {t(`tool-shuffle.ui.separatorOptions.${separator.id}`)}
              </Button>
            ))}
          </div>

          <textarea
            id="shuffle-entries"
            aria-label={t('tool-shuffle.ui.entries')}
            className="h-[240px] w-full resize-y rounded-xl border border-border bg-app p-3 font-sans text-[0.95rem] leading-relaxed text-text-main outline-none focus:border-accent"
            placeholder={t('tool-shuffle.ui.entriesPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isDrawing}
          />

          <div className="flex gap-2">
            <Button id="shuffle-draw-btn" className="flex-1" variant="primary" onClick={draw} disabled={isDrawing}>
              {isDrawing ? t('tool-shuffle.ui.drawing') : t('tool-shuffle.ui.draw')}
            </Button>
            <Button id="shuffle-clear-btn" variant="secondary" onClick={clearAll} disabled={isDrawing}>
              {t('tool-shuffle.ui.clear')}
            </Button>
          </div>

          {status && <p className="m-0 text-xs text-red-500">{status}</p>}
        </div>

        {/* Drawn order */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-app p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold text-text-main">{t('tool-shuffle.ui.result')}</h2>
            {record && (
              <Button size="sm" variant="secondary" onClick={copyResult} disabled={isDrawing}>
                {copied ? t('tool-shuffle.ui.copied') : t('tool-shuffle.ui.copyResult')}
              </Button>
            )}
          </div>

          <div
            className="h-[300px] overflow-y-auto rounded-xl border border-border bg-card p-3"
            aria-live="polite"
          >
            {visibleResult.length === 0 ? (
              <p className="m-0 p-3 text-center text-sm italic text-text-muted">
                {t('tool-shuffle.ui.resultEmpty')}
              </p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {visibleResult.map((entry, index) => (
                  <li
                    key={`${index}-${entry}`}
                    className="shuffle-reveal-item flex items-center gap-3 rounded-lg border border-border bg-app p-[8px_12px]"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-light font-display text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <span className="break-all text-[0.95rem] font-medium text-text-main">{entry}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {record && !isDrawing && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-app p-3">
          <span className="w-full text-xs text-text-muted">
            {t('tool-shuffle.ui.recorded', { algorithm: record.algorithm, total: record.result.length })}
          </span>
          <Button size="sm" variant="secondary" onClick={copyRecord}>{t('tool-shuffle.ui.copyRecord')}</Button>
          <Button size="sm" variant="secondary" onClick={downloadRecord}>{t('tool-shuffle.ui.downloadJson')}</Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-app p-3">
        <button
          type="button"
          className="text-xs font-semibold text-accent"
          onClick={() => setShowVerification((value) => !value)}
        >
          {showVerification ? t('tool-shuffle.ui.hideVerification') : t('tool-shuffle.ui.verifyDraw')}
        </button>
        {showVerification && (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              aria-label={t('tool-shuffle.ui.recordJsonAria')}
              value={verificationInput}
              onChange={(event) => setVerificationInput(event.target.value)}
              placeholder={t('tool-shuffle.ui.recordJsonPlaceholder')}
              className="h-28 resize-y rounded border border-border bg-card p-2 font-mono text-xs text-text-main"
            />
            <Button size="sm" variant="secondary" onClick={verifyImportedRecord}>
              {t('tool-shuffle.ui.verifyRecord')}
            </Button>
            {verificationStatus && <p className="m-0 text-xs text-text-muted">{verificationStatus}</p>}
          </div>
        )}
      </div>

      <p className="m-0 text-center text-[0.72rem] text-text-muted">
        {t('tool-shuffle.ui.disclaimer')}
      </p>
    </Card>
  );
}
