import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import ToolHeader from './ui/ToolHeader';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import ResultDisplay from './ui/ResultDisplay';
import { hasConsent, grantConsent } from '../lib/thirdPartyServices';
import {
  appendBoundedSample,
  formatDecimalMb,
  getDataPlan,
  isConstrainedConnection,
} from '../lib/speedTest';

async function withRequestDeadline(parentSignal, timeoutMs, operation) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) abortFromParent();
  else parentSignal.addEventListener('abort', abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', abortFromParent);
  }
}

// ─── Ping Test ───────────────────────────────────────────────────────────────
export const runPingTest = async (signal) => {
  const pings = [];
  for (let i = 0; i < 4; i++) {
    if (signal.aborted) return null;
    const start = performance.now();
    try {
      await withRequestDeadline(signal, 3000, async (requestSignal) => {
        const response = await fetch('https://speed.cloudflare.com/__down?bytes=0', {
          cache: 'no-store', signal: requestSignal,
        });
        if (!response.ok) throw new Error('Ping server returned error status');
        await response.text();
      });
      const elapsed = performance.now() - start;
      if (i > 0) pings.push(elapsed);
    } catch {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    }
    if (i < 3) {
      await new Promise((res, rej) => {
        const t = setTimeout(res, 80);
        signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
    }
  }
  return pings.length ? pings.reduce((a, b) => a + b) / pings.length : null;
};

// ─── IP and ISP Lookup ────────────────────────────────────────────────────────
const fetchIpInfo = async (signal) => {
  const response = await fetch('/api/iplookup', { signal });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Server-side IP lookup failed');
  }
  return result.data;
};

// ─── Time-boxed Download Test ─────────────────────────────────────────────────
export const runDownloadTest = (durationMs, downloadBytes, onProgress, outerSignal) => {
  return new Promise((resolve, reject) => {
    const innerController = new AbortController();
    let bytes = 0;
    let startTime = null;
    const samples = [];
    let warmUpBytes = 0;
    let warmUpTime = 0;
    let isWarmedUp = false;

    const onOuter = () => innerController.abort();
    outerSignal.addEventListener('abort', onOuter, { once: true });

    const timer = setTimeout(() => innerController.abort(), durationMs);

    fetch(`https://speed.cloudflare.com/__down?bytes=${downloadBytes}`, {
      cache: 'no-store',
      signal: innerController.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Download server returned error status');
        if (!res.body) throw new Error('ReadableStream not supported');
        const reader = res.body.getReader();
        startTime = performance.now();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          const now = performance.now();
          const elapsed = (now - startTime) / 1000;

          if (!isWarmedUp) {
            if (elapsed >= 0.5) {
              warmUpBytes = bytes;
              warmUpTime = elapsed;
              isWarmedUp = true;
            }
            continue;
          }

          const activeElapsed = elapsed - warmUpTime;
          const activeBytes = bytes - warmUpBytes;
          const speedMbps = activeElapsed > 0 ? (activeBytes * 8) / activeElapsed / 1_000_000 : 0;
          samples.push(speedMbps);

          const pct = Math.min((bytes / downloadBytes) * 100, 100);
          onProgress({ bytes, elapsed, speedMbps, pct });
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && !outerSignal.aborted) reject(err);
      })
      .finally(() => {
        clearTimeout(timer);
        outerSignal.removeEventListener('abort', onOuter);
        const totalElapsed = (performance.now() - (startTime || performance.now())) / 1000;
        const activeElapsed = totalElapsed - warmUpTime;
        const activeBytes = bytes - warmUpBytes;
        const avgMbps = isWarmedUp && activeElapsed > 0 && activeBytes > 0
          ? (activeBytes * 8) / activeElapsed / 1_000_000
          : (totalElapsed > 0 && bytes > 0 ? (bytes * 8) / totalElapsed / 1_000_000 : null);
        resolve({ avgMbps, bytes, samples });
      });
  });
};

// ─── Time-boxed Upload Test (using chunked fetch POST to avoid CORS preflight) ───
export const runUploadTest = async (durationMs, maxUploadBytes, onProgress, outerSignal) => {
  const startTime = performance.now();
  let totalBytes = 0;
  const samples = [];
  let warmUpBytes = 0;
  let warmUpTime = 0;
  let isWarmedUp = false;

  let currentChunkSize = 256 * 1024; // start with 256 KB
  const maxChunkSize = 4 * 1024 * 1024; // 4 MB max chunk size to avoid server limits
  const minChunkSize = 64 * 1024; // 64 KB min chunk size

  const innerController = new AbortController();
  const onOuter = () => innerController.abort();
  outerSignal.addEventListener('abort', onOuter, { once: true });
  const phaseTimer = setTimeout(() => innerController.abort(), durationMs);

  try {
    while (performance.now() - startTime < durationMs && !outerSignal.aborted && totalBytes < maxUploadBytes) {
      const remainingBytes = maxUploadBytes - totalBytes;
      const nextChunkSize = Math.min(currentChunkSize, remainingBytes);

      // Build a text blob of nextChunkSize
      const data = new Uint8Array(nextChunkSize);
      const blob = new Blob([data], { type: 'text/plain' });

      const chunkStart = performance.now();

      // Perform the upload. Since method is POST and body is text/plain Blob,
      // this is a simple CORS request and does not trigger OPTIONS preflight.
      const remainingMs = Math.max(1, durationMs - (performance.now() - startTime));
      const response = await withRequestDeadline(
        innerController.signal,
        Math.min(5000, remainingMs),
        (requestSignal) => fetch('https://speed.cloudflare.com/__up', {
          method: 'POST',
          body: blob,
          cache: 'no-store',
          signal: requestSignal,
        }),
      );

      if (!response.ok) {
        throw new Error('Upload server returned error status');
      }

      const chunkEnd = performance.now();
      const chunkDurationSec = (chunkEnd - chunkStart) / 1000;
      totalBytes += nextChunkSize;

      const elapsed = (chunkEnd - startTime) / 1000;

      if (!isWarmedUp) {
        if (elapsed >= 0.5) {
          warmUpBytes = totalBytes;
          warmUpTime = elapsed;
          isWarmedUp = true;
        }
        continue;
      }

      if (chunkDurationSec > 0) {
        const activeElapsed = elapsed - warmUpTime;
        const activeBytes = totalBytes - warmUpBytes;
        const speedMbps = activeElapsed > 0 ? (activeBytes * 8) / activeElapsed / 1_000_000 : 0;

        samples.push(speedMbps);

        const timePct = (elapsed / (durationMs / 1000)) * 100;
        const bytesPct = (totalBytes / maxUploadBytes) * 100;
        const pct = Math.min(Math.max(timePct, bytesPct), 100);

        onProgress({ bytes: totalBytes, elapsed, speedMbps, pct });

        // Dynamically adjust chunk size for the next request to target ~0.3 seconds upload duration
        const targetDuration = 0.3; // seconds
        let targetSize = Math.round((speedMbps * 1_000_000 * targetDuration) / 8);
        // Clamp the size
        currentChunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, targetSize));
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError' && !outerSignal.aborted) {
      throw e;
    }
  } finally {
    clearTimeout(phaseTimer);
    outerSignal.removeEventListener('abort', onOuter);
  }

  const totalElapsed = (performance.now() - startTime) / 1000;
  const activeElapsed = totalElapsed - warmUpTime;
  const activeBytes = totalBytes - warmUpBytes;
  const avgMbps = isWarmedUp && activeElapsed > 0 && activeBytes > 0
    ? (activeBytes * 8) / activeElapsed / 1_000_000
    : (totalElapsed > 0 && totalBytes > 0 ? (totalBytes * 8) / totalElapsed / 1_000_000 : null);

  return { avgMbps, bytes: totalBytes, samples };
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function NetworkSpeedTest() {
  const { t, i18n } = useTranslation('tools');
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | ping | download | upload | complete | error
  const [pingVal, setPingVal] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [avgDownloadSpeed, setAvgDownloadSpeed] = useState(null);
  const [avgUploadSpeed, setAvgUploadSpeed] = useState(null);
  const [error, setError] = useState(null);
  const [speedHistory, setSpeedHistory] = useState([]); // { phase, speed }[]
  const [clientIp, setClientIp] = useState(null);
  const [clientOrg, setClientOrg] = useState(null);
  const [dataLimit, setDataLimit] = useState('light'); // light | standard | heavy | custom
  const [customDownload, setCustomDownload] = useState('100');
  const [customUpload, setCustomUpload] = useState('25');
  const [actualDownloadBytes, setActualDownloadBytes] = useState(0);
  const [actualUploadBytes, setActualUploadBytes] = useState(0);
  const [isConsentGranted, setIsConsentGranted] = useState(() => hasConsent('speedtest'));
  const constrainedConnection = isConstrainedConnection(navigator.connection);

  useEffect(() => {
    const handleConsentUpdate = () => {
      setIsConsentGranted(hasConsent('speedtest'));
    };
    window.addEventListener('consent_updated', handleConsentUpdate);
    return () => window.removeEventListener('consent_updated', handleConsentUpdate);
  }, []);

  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startTest = async () => {
    if (!isConsentGranted) {
      setError(t('tool-speedtest.ui.error.consentRequired'));
      return;
    }
    let plan;
    try {
      plan = getDataPlan(dataLimit, customDownload, customUpload);
    } catch (planError) {
      setError(t(`tool-speedtest.ui.error.${planError.code || 'invalidPlan'}`));
      setPhase('error');
      return;
    }
    if (
      plan.totalBytes > 250_000_000
      && !window.confirm(t('tool-speedtest.ui.largeTransferConfirm', {
        total: formatDecimalMb(plan.totalBytes, i18n.language),
      }))
    ) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const overallTimer = setTimeout(
      () => controller.abort(new DOMException('Overall speed-test deadline exceeded', 'TimeoutError')),
      35_000,
    );

    setIsRunning(true);
    setPhase('ping');
    setError(null);
    setPingVal(null);
    setCurrentSpeed(0);
    setProgress(0);
    setAvgDownloadSpeed(null);
    setAvgUploadSpeed(null);
    setSpeedHistory([]);
    setClientIp(null);
    setClientOrg(null);
    setActualDownloadBytes(0);
    setActualUploadBytes(0);

    // Fetch client IP and ISP in the background
    fetchIpInfo(signal)
      .then(info => {
        setClientIp(info.ip);
        setClientOrg(info.org);
      })
      .catch(err => {
        console.warn('IP lookup failed:', err);
      });

    try {
      // 1. Ping
      const unavailable = [];
      try {
        const ping = await runPingTest(signal);
        setPingVal(ping);
        if (ping === null) unavailable.push(t('tool-speedtest.ui.latency'));
      } catch (pingError) {
        if (signal.aborted) throw pingError;
        setPingVal(null);
        unavailable.push(t('tool-speedtest.ui.latency'));
      }
      if (signal.aborted) return;

      // 2. Download (10 seconds)
      setPhase('download');
      setProgress(0);
      setCurrentSpeed(0);

      try {
        const dl = await runDownloadTest(
          10_000,
          plan.downloadBytes,
          ({ speedMbps, pct }) => {
            setCurrentSpeed(speedMbps);
            setProgress(pct);
            setSpeedHistory(prev => appendBoundedSample(prev, { phase: 'download', speed: speedMbps }));
          },
          signal,
        );
        setAvgDownloadSpeed(dl.avgMbps);
        setActualDownloadBytes(dl.bytes);
        if (dl.avgMbps === null) unavailable.push(t('tool-speedtest.ui.download'));
      } catch (downloadError) {
        if (signal.aborted) throw downloadError;
        setAvgDownloadSpeed(null);
        unavailable.push(t('tool-speedtest.ui.download'));
      }
      if (signal.aborted) { setPhase('cancelled'); return; }

      // 3. Upload (10 seconds)
      setPhase('upload');
      setProgress(0);
      setCurrentSpeed(0);

      try {
        const ul = await runUploadTest(
          10_000,
          plan.uploadBytes,
          ({ speedMbps, pct }) => {
            setCurrentSpeed(speedMbps);
            setProgress(pct);
            setSpeedHistory(prev => appendBoundedSample(prev, { phase: 'upload', speed: speedMbps }));
          },
          signal,
        );
        setAvgUploadSpeed(ul.avgMbps);
        setActualUploadBytes(ul.bytes);
        if (ul.avgMbps === null) unavailable.push(t('tool-speedtest.ui.upload'));
      } catch (uploadError) {
        if (signal.aborted) throw uploadError;
        setAvgUploadSpeed(null);
        unavailable.push(t('tool-speedtest.ui.upload'));
      }
      if (unavailable.length > 0) {
        setError(t('tool-speedtest.ui.error.unavailable', { measurements: unavailable.join(', ') }));
      }
      setPhase('complete');

    } catch (err) {
      if (err.name === 'AbortError') {
        setPhase('cancelled');
      } else {
        setError(t('tool-speedtest.ui.error.general'));
        setPhase('error');
      }
    } finally {
      clearTimeout(overallTimer);
      setIsRunning(false);
      setCurrentSpeed(0);
      setProgress(0);
    }
  };

  const stopTest = () => {
    abortRef.current?.abort();
    setPhase('cancelled');
    setIsRunning(false);
  };

  let selectedPlan = null;
  let planValidationError = '';
  try {
    selectedPlan = getDataPlan(dataLimit, customDownload, customUpload);
  } catch (planError) {
    planValidationError = t(`tool-speedtest.ui.error.${planError.code || 'invalidPlan'}`);
  }

  // ── Speedometer math ────────────────────────────────────────────────────────
  const maxScale = Math.max(100, Math.ceil(currentSpeed / 100) * 100);
  const ratio = Math.min(currentSpeed / maxScale, 1);
  const needleAngle = -120 + ratio * 240;
  const rad = (needleAngle * Math.PI) / 180;
  const needleLength = 55;
  const needleX = 100 + needleLength * Math.sin(rad);
  const needleY = 95  - needleLength * Math.cos(rad);

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = ((-120 + i * 24) * Math.PI) / 180;
    return {
      key: i,
      x1: 100 + 63 * Math.sin(a), y1: 95 - 63 * Math.cos(a),
      x2: 100 + 70 * Math.sin(a), y2: 95 - 70 * Math.cos(a),
    };
  });

  // ── Chart math (Separate Download and Upload) ────────────────────────────────
  const chartW = 260, chartH = 70, chartX0 = 25, chartY0 = 10;
  const areaBase = chartY0 + chartH;

  const makeChartData = (points, peak) => {
    const total = points.length;
    const pts = points.map((p, idx) => {
      const x = total > 1 ? chartX0 + (idx / (total - 1)) * chartW : chartX0;
      const y = areaBase - (p.speed / peak) * chartH;
      return { x, y };
    });

    const linePath = pts.length < 2 ? '' : 'M ' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');
    const areaPath = pts.length > 1
      ? `M ${chartX0},${areaBase} L ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} L ${pts[pts.length - 1].x.toFixed(1)},${areaBase} Z`
      : '';

    return { linePath, areaPath, pts };
  };

  const dlPoints = speedHistory.filter(h => h.phase === 'download');
  const peakDl = Math.max(...dlPoints.map(h => h.speed), 10);
  const dlChart = makeChartData(dlPoints, peakDl);

  const ulPoints = speedHistory.filter(h => h.phase === 'upload');
  const peakUl = Math.max(...ulPoints.map(h => h.speed), 10);
  const ulChart = makeChartData(ulPoints, peakUl);

  const showViz = isRunning || phase === 'complete';

  return (
    <Card id="tool-speedtest" variant="tool" size="wide">
      <ToolHeader 
        title={t('tool-speedtest.title')}
      />
      <p className="text-xs text-text-muted mb-3">
        {t('tool-speedtest.ui.description')}
      </p>

      <div className="flex flex-row flex-wrap gap-4 items-end justify-start mb-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="data-limit-select" className="text-xs font-bold text-text-muted">
            {t('tool-speedtest.ui.testSizeLimit')}
          </label>
          <select
            id="data-limit-select"
            value={dataLimit}
            onChange={(e) => setDataLimit(e.target.value)}
            disabled={isRunning}
            className="px-3 py-2 rounded-md border border-border bg-card text-text-main outline-none text-sm disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="light">{t('tool-speedtest.ui.plan.light')}</option>
            <option value="standard">{t('tool-speedtest.ui.plan.standard')}</option>
            <option value="heavy">{t('tool-speedtest.ui.plan.heavy')}</option>
            <option value="custom">{t('tool-speedtest.ui.plan.custom')}</option>
          </select>
        </div>

        {dataLimit === 'custom' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-down-input" className="text-xs font-bold text-text-muted">
                {t('tool-speedtest.ui.downloadMb')}
              </label>
              <input
                id="custom-down-input"
                type="number"
                min="1"
                max="1000"
                value={customDownload}
                onChange={(e) => setCustomDownload(e.target.value)}
                disabled={isRunning}
                className="px-3 py-2 rounded-md border border-border bg-card text-text-main outline-none w-[95px] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="custom-up-input" className="text-xs font-bold text-text-muted">
                {t('tool-speedtest.ui.uploadMb')}
              </label>
              <input
                id="custom-up-input"
                type="number"
                min="1"
                max="1000"
                value={customUpload}
                onChange={(e) => setCustomUpload(e.target.value)}
                disabled={isRunning}
                className="px-3 py-2 rounded-md border border-border bg-card text-text-main outline-none w-[95px] text-sm"
              />
            </div>
          </div>
        )}

        <div>
          {!isConsentGranted ? (
            <Button variant="secondary" onClick={() => grantConsent('speedtest')}>{t('tool-speedtest.ui.allow')}</Button>
          ) : isRunning ? (
            <Button variant="primary" onClick={stopTest}>{t('tool-speedtest.ui.stop')}</Button>
          ) : (
            <Button variant="primary" onClick={startTest}>{t('tool-speedtest.ui.start')}</Button>
          )}
        </div>
      </div>

      {selectedPlan ? (
        <p className="text-xs text-text-muted mb-4">
          {t('tool-speedtest.ui.maximumTransfer', {
            download: formatDecimalMb(selectedPlan.downloadBytes, i18n.language),
            upload: formatDecimalMb(selectedPlan.uploadBytes, i18n.language),
            total: formatDecimalMb(selectedPlan.totalBytes, i18n.language),
          })}
        </p>
      ) : (
        <p role="alert" className="text-xs text-red-500 mb-4">{planValidationError}</p>
      )}

      {constrainedConnection && (
        <p className="text-xs text-amber-600 mb-4">
          {t('tool-speedtest.ui.constrained')}
        </p>
      )}

      {phase === 'cancelled' && (
        <p className="text-xs text-text-muted mb-4">{t('tool-speedtest.ui.cancelled')}</p>
      )}

      {!isConsentGranted && (
        <div className="p-3 bg-app border border-border rounded-xl flex items-center justify-between gap-3 text-xs mb-4">
          <span>🛡️ {t('tool-speedtest.ui.consentDisclosure')}</span>
          <Button variant="secondary" onClick={() => grantConsent('speedtest')} className="text-xs shrink-0">
            {t('tool-speedtest.ui.grantConsent')}
          </Button>
        </div>
      )}

      {/* ── Speedometer + Line Charts ── */}
      {showViz && (
        <div className="flex flex-col md:flex-row gap-4 w-full mb-5 items-stretch">

          {/* Speedometer Box */}
          <div className="flex-[2_1_280px] flex flex-col items-center justify-center bg-card rounded-md border border-border p-3">
            <svg viewBox="0 0 200 140" style={{ width: '100%', height: 'auto', maxHeight: '150px' }}>
              {/* Track */}
              <path d="M 39.38,130 A 70,70 0 1,1 160.62,130"
                fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
              {/* Speed arc (filled) */}
              {ratio > 0 && (() => {
                // compute arc end point at current needle angle
                const startRad = (-120 * Math.PI) / 180;
                const endRad = rad;
                const r = 70;
                const sx = 100 + r * Math.sin(startRad);
                const sy = 95  - r * Math.cos(startRad);
                const ex = 100 + r * Math.sin(endRad);
                const ey = 95  - r * Math.cos(endRad);
                const largeArc = ratio > 0.75 ? 1 : 0;
                return (
                  <path
                    d={`M ${sx.toFixed(2)},${sy.toFixed(2)} A 70,70 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)}`}
                    fill="none"
                    stroke={phase === 'download' ? '#3b82f6' : phase === 'upload' ? '#ef4444' : 'var(--accent)'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                );
              })()}
              {/* Ticks */}
              {ticks.map(t => (
                <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke="var(--border-color)" strokeWidth="1.5" />
              ))}
              {/* Labels */}
              <text x="24"  y="137" fontSize="8" textAnchor="middle" fill="var(--text-muted)">0</text>
              <text x="100" y="18"  fontSize="8" textAnchor="middle" fill="var(--text-muted)">{Math.round(maxScale / 2)}</text>
              <text x="176" y="137" fontSize="8" textAnchor="middle" fill="var(--text-muted)">{maxScale}</text>
              {/* Needle */}
              <line x1="100" y1="95" x2={needleX.toFixed(2)} y2={needleY.toFixed(2)}
                stroke={phase === 'download' ? '#3b82f6' : phase === 'upload' ? '#ef4444' : 'var(--accent)'}
                strokeWidth="3" strokeLinecap="round" />
              <circle cx="100" cy="95" r="7"
                fill={phase === 'download' ? '#3b82f6' : phase === 'upload' ? '#ef4444' : 'var(--accent)'} />
              <circle cx="100" cy="95" r="2.5" fill="var(--bg-card)" />
              {/* Speed text */}
              <text x="100" y="124" fontSize="13" fontWeight="700" textAnchor="middle"
                fill="var(--text-main)" id="speed-display">
                {new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(currentSpeed)} Mbps
              </text>
              <text x="100" y="135" fontSize="8" textAnchor="middle" fill="var(--text-muted)">
                {t(phase === 'download'
                  ? 'tool-speedtest.ui.downloading'
                  : phase === 'upload'
                    ? 'tool-speedtest.ui.uploading'
                    : 'tool-speedtest.ui.speed')}
              </text>
            </svg>
          </div>

          {/* Download Speed Chart */}
          <div className="flex-[2_1_280px] flex flex-col gap-1 bg-card rounded-md border border-border p-3">
            <span className="text-[0.72rem] font-bold text-text-muted uppercase tracking-wider">
              {t('tool-speedtest.ui.downloadChart', {
                speed: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(peakDl),
              })}
            </span>
            <div className="flex-1 flex items-center">
              <svg viewBox="0 0 300 90" style={{ width: '100%', height: 'auto' }}>
                {/* Grid */}
                <line x1="25" y1="10"  x2="285" y2="10"  stroke="var(--border-color)" strokeWidth="0.8" strokeDasharray="3 3" />
                <line x1="25" y1="45"  x2="285" y2="45"  stroke="var(--border-color)" strokeWidth="0.8" strokeDasharray="3 3" />
                <line x1="25" y1="80"  x2="285" y2="80"  stroke="var(--border-color)" strokeWidth="0.8" />
                {/* Y labels */}
                <text x="20" y="13"  fontSize="7" textAnchor="end" fill="var(--text-muted)">{peakDl.toFixed(0)}</text>
                <text x="20" y="48"  fontSize="7" textAnchor="end" fill="var(--text-muted)">{(peakDl / 2).toFixed(0)}</text>
                <text x="20" y="83"  fontSize="7" textAnchor="end" fill="var(--text-muted)">0</text>
                {/* Area fill */}
                {dlChart.areaPath && <path d={dlChart.areaPath} fill="#3b82f6" opacity="0.08" />}
                {/* Line */}
                {dlChart.linePath && (
                  <path d={dlChart.linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </div>
          </div>

          {/* Upload Speed Chart */}
          <div className="flex-[2_1_280px] flex flex-col gap-1 bg-card rounded-md border border-border p-3">
            <span className="text-[0.72rem] font-bold text-text-muted uppercase tracking-wider">
              {t('tool-speedtest.ui.uploadChart', {
                speed: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(peakUl),
              })}
            </span>
            <div className="flex-1 flex items-center">
              <svg viewBox="0 0 300 90" style={{ width: '100%', height: 'auto' }}>
                {/* Grid */}
                <line x1="25" y1="10"  x2="285" y2="10"  stroke="var(--border-color)" strokeWidth="0.8" strokeDasharray="3 3" />
                <line x1="25" y1="45"  x2="285" y2="45"  stroke="var(--border-color)" strokeWidth="0.8" strokeDasharray="3 3" />
                <line x1="25" y1="80"  x2="285" y2="80"  stroke="var(--border-color)" strokeWidth="0.8" />
                {/* Y labels */}
                <text x="20" y="13"  fontSize="7" textAnchor="end" fill="var(--text-muted)">{peakUl.toFixed(0)}</text>
                <text x="20" y="48"  fontSize="7" textAnchor="end" fill="var(--text-muted)">{(peakUl / 2).toFixed(0)}</text>
                <text x="20" y="83"  fontSize="7" textAnchor="end" fill="var(--text-muted)">0</text>
                {/* Area fill */}
                {ulChart.areaPath && <path d={ulChart.areaPath} fill="#ef4444" opacity="0.08" />}
                {/* Line */}
                {ulChart.linePath && (
                  <path d={ulChart.linePath} fill="none" stroke="#ef4444" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </div>
          </div>

        </div>
      )}

      {/* Progress bar */}
      {(phase === 'download' || phase === 'upload') && (
        <div className="w-full bg-border rounded-full h-1.5 overflow-hidden mb-5">
          <div style={{
            width: `${progress}%`,
            background: phase === 'download' ? '#3b82f6' : '#ef4444',
          }} className="h-full transition-all duration-100" />
        </div>
      )}

      {/* Phase labels */}
      {phase === 'ping' && (
        <Spinner container label={t('tool-speedtest.ui.testingLatency')} className="mb-5" />
      )}
      {phase === 'download' && (
        <Spinner container label={t('tool-speedtest.ui.measuringDownload', { progress: progress.toFixed(0) })} className="mb-5" />
      )}
      {phase === 'upload' && (
        <Spinner container label={t('tool-speedtest.ui.measuringUpload', { progress: progress.toFixed(0) })} className="mb-5" />
      )}

      {/* Results */}
      {phase === 'complete' && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-main">{t('tool-speedtest.ui.results')}</h2>
          {error && (
            <p role="status" className="text-sm text-amber-600">{error}</p>
          )}
          {/* Row 1: Speed Performance Metrics */}
          <div className="flex flex-col md:flex-row gap-4 w-full mb-4">
            <ResultDisplay
              label={t('tool-speedtest.ui.averageDownload')}
              value={avgDownloadSpeed != null ? `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(avgDownloadSpeed)} Mbps` : t('tool-speedtest.ui.notAvailable')}
              className="flex-[1_1_180px]"
            />
            <ResultDisplay
              label={t('tool-speedtest.ui.averageUpload')}
              value={avgUploadSpeed != null ? `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(avgUploadSpeed)} Mbps` : t('tool-speedtest.ui.notAvailable')}
              className="flex-[1_1_180px]"
            />
            <ResultDisplay
              label={t('tool-speedtest.ui.latencyPing')}
              value={pingVal != null ? `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(pingVal)} ms` : t('tool-speedtest.ui.notAvailable')}
              className="flex-[1_1_180px]"
            />
          </div>

          {/* Row 2: Connection Details */}
          <div className="flex flex-col md:flex-row gap-4 w-full">
            <ResultDisplay
              label={t('tool-speedtest.ui.actualTransferred')}
              value={t('tool-speedtest.ui.transferValue', {
                download: formatDecimalMb(actualDownloadBytes, i18n.language),
                upload: formatDecimalMb(actualUploadBytes, i18n.language),
              })}
              className="flex-[1_1_250px]"
            />
            <ResultDisplay
              label={t('tool-speedtest.ui.ipAddress')}
              value={clientIp || t('tool-speedtest.ui.fetching')}
              className="flex-[1_1_250px]"
              valueClassName="text-[1.25rem] font-bold"
            />
            <ResultDisplay
              label={t('tool-speedtest.ui.provider')}
              value={clientOrg || t('tool-speedtest.ui.fetching')}
              className="flex-[1_1_250px]"
              valueClassName="text-[1.25rem] font-bold"
            />
          </div>
        </div>
      )}

      {phase === 'error' && error && (
        <div className="text-red-500 font-semibold p-4 rounded bg-red-500/10 border border-red-500/20 mb-5">{error}</div>
      )}
    </Card>
  );
}

