import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { RESOURCE_LIMITS, validateFileSize } from '../lib/resourceLimits';

// ── Supported format labels for display ──────────────────────────────────────
const FORMAT_LABELS = {
  QR_CODE: 'QR Code',
  DATA_MATRIX: 'Data Matrix',
  AZTEC: 'Aztec',
  PDF_417: 'PDF 417',
  CODE_128: 'Code 128',
  CODE_39: 'Code 39',
  CODE_93: 'Code 93',
  EAN_13: 'EAN-13',
  EAN_8: 'EAN-8',
  UPC_A: 'UPC-A',
  UPC_E: 'UPC-E',
  ITF: 'ITF',
  RSS_14: 'RSS 14',
  RSS_EXPANDED: 'RSS Expanded',
  CODABAR: 'Codabar',
  MAXICODE: 'MaxiCode',
};

// ── Play a retro beep sound using the Web Audio API ──────────────────────────
const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1046, ctx.currentTime); // C6
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio API not available — silently skip
  }
};

// ── Parse structured QR payload types ────────────────────────────────────────
const parseQRPayload = (text) => {
  if (!text) return { type: 'text', raw: text };

  // URL
  if (/^https?:\/\//i.test(text) || /^ftp:\/\//i.test(text)) {
    return { type: 'url', raw: text, url: text };
  }

  // WiFi: WIFI:S:<SSID>;T:<Auth>;P:<Password>;H:<Hidden>;;
  const wifiMatch = text.match(/^WIFI:(?:.*?S:(.*?);)?(?:.*?T:(.*?);)?(?:.*?P:(.*?);)?(?:.*?H:(.*?);)?/i);
  if (wifiMatch && text.toUpperCase().startsWith('WIFI:')) {
    const ssid = (wifiMatch[1] || '').replace(/\\(.)/g, '$1');
    const security = wifiMatch[2] || 'nopass';
    const password = (wifiMatch[3] || '').replace(/\\(.)/g, '$1');
    const hidden = wifiMatch[4] === 'true';
    return { type: 'wifi', raw: text, ssid, security, password, hidden };
  }

  // Email: mailto:...
  if (/^mailto:/i.test(text)) {
    const url = new URL(text.replace(/^mailto:/i, 'mailto:'));
    const to = url.pathname || '';
    const subject = url.searchParams.get('subject') || '';
    const body = url.searchParams.get('body') || '';
    return { type: 'email', raw: text, to, subject, body };
  }

  // Phone: tel:...
  if (/^tel:/i.test(text)) {
    const phone = text.replace(/^tel:/i, '').trim();
    return { type: 'phone', raw: text, phone };
  }

  // SMS: sms:...
  if (/^sms:/i.test(text)) {
    const parts = text.replace(/^sms:/i, '').split('?');
    const phone = parts[0] || '';
    const bodyMatch = (parts[1] || '').match(/body=([^&]*)/);
    const message = bodyMatch ? decodeURIComponent(bodyMatch[1]) : '';
    return { type: 'sms', raw: text, phone, message };
  }

  return { type: 'text', raw: text };
};

// ── Content-Aware Result Widget ───────────────────────────────────────────────
function ResultWidget({ parsed }) {
  const { t } = useTranslation('tools');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Stopping an already-closed scanner is harmless.
    }
  };

  const { type } = parsed;

  if (type === 'url') {
    return (
      <div className="flex gap-3.5 items-start">
        <div className="w-9.5 h-9.5 rounded-lg bg-nav-active-bg text-accent flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.urlDetected')}</div>
          <div className="text-[0.9rem] text-accent underline underline-offset-2 cursor-pointer break-all leading-normal mb-2.5">{parsed.url}</div>
          <div className="flex gap-2 flex-wrap">
            <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-accent-gradient text-white px-3 py-1.5 rounded text-xs font-semibold hover:-translate-y-px hover:shadow-[0_4px_10px_var(--accent-light)] transition-all duration-200 shadow-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              {t('tool-qrbarcodescan.ui.openLink')}
            </a>
            <Button variant="secondary" size="sm" onClick={() => copyText(parsed.url)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copied ? t('tool-qrbarcodescan.ui.copied') : t('tool-qrbarcodescan.ui.copy')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'wifi') {
    return (
      <div className="flex gap-3.5 items-start">
        <div className="w-9.5 h-9.5 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <line x1="12" y1="20" x2="12.01" y2="20"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.wifiNetwork')}</div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            <div className="flex gap-2.5 items-baseline">
              <span className="text-[0.78rem] font-semibold text-text-muted w-[110px] shrink-0">{t('tool-qrbarcodescan.ui.networkSsid')}</span>
              <span className="text-[0.88rem] text-text-main break-all">{parsed.ssid || t('tool-qrbarcodescan.ui.hiddenValue')}</span>
            </div>
            <div className="flex gap-2.5 items-baseline">
              <span className="text-[0.78rem] font-semibold text-text-muted w-[110px] shrink-0">{t('tool-qrbarcodescan.ui.security')}</span>
              <span className="text-[0.88rem] text-text-main break-all">{parsed.security || t('tool-qrbarcodescan.ui.none')}</span>
            </div>
            {parsed.password && (
              <div className="flex gap-2.5 items-baseline">
                <span className="text-[0.78rem] font-semibold text-text-muted w-[110px] shrink-0">{t('tool-qrbarcodescan.ui.password')}</span>
                <span className="text-[0.88rem] text-text-main break-all inline-flex items-center gap-1.5">
                  <span className="font-mono text-[0.9rem] tracking-wider">
                    {showPassword ? parsed.password : '•'.repeat(parsed.password.length)}
                  </span>
                  <button className="bg-transparent border-none text-text-muted cursor-pointer p-0.5 inline-flex items-center rounded transition-colors hover:text-accent shrink-0" onClick={() => setShowPassword(v => !v)} title={showPassword ? t('tool-qrbarcodescan.ui.hide') : t('tool-qrbarcodescan.ui.show')}>
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                  <button className="bg-transparent border-none text-text-muted cursor-pointer p-0.5 inline-flex items-center rounded transition-colors hover:text-accent shrink-0" onClick={() => copyText(parsed.password)} title={t('tool-qrbarcodescan.ui.copyPassword')}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </span>
              </div>
            )}
            {parsed.hidden && (
              <div className="flex gap-2.5 items-baseline">
                <span className="text-[0.78rem] font-semibold text-text-muted w-[110px] shrink-0">{t('tool-qrbarcodescan.ui.hidden')}</span>
                <span className="text-[0.88rem] text-text-main break-all">{t('tool-qrbarcodescan.ui.yes')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'email') {
    return (
      <div className="flex gap-3.5 items-start">
        <div className="w-9.5 h-9.5 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.emailDetected')}</div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            {parsed.to && <div className="flex gap-2.5 items-start"><span className="text-[0.78rem] font-semibold text-text-muted w-[60px] shrink-0 pt-0.5">{t('tool-qrbarcodescan.ui.to')}</span><span className="text-[0.88rem] text-text-main break-all leading-normal">{parsed.to}</span></div>}
            {parsed.subject && <div className="flex gap-2.5 items-start"><span className="text-[0.78rem] font-semibold text-text-muted w-[60px] shrink-0 pt-0.5">{t('tool-qrbarcodescan.ui.subject')}</span><span className="text-[0.88rem] text-text-main break-all leading-normal">{parsed.subject}</span></div>}
            {parsed.body && <div className="flex gap-2.5 items-start"><span className="text-[0.78rem] font-semibold text-text-muted w-[60px] shrink-0 pt-0.5">{t('tool-qrbarcodescan.ui.body')}</span><span className="text-[0.88rem] text-text-main break-all leading-normal">{parsed.body}</span></div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={parsed.raw} className="inline-flex items-center gap-1.5 bg-accent-gradient text-white px-3 py-1.5 rounded text-xs font-semibold hover:-translate-y-px hover:shadow-[0_4px_10px_var(--accent-light)] transition-all duration-200 shadow-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {t('tool-qrbarcodescan.ui.composeEmail')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'phone') {
    return (
      <div className="flex gap-3.5 items-start">
        <div className="w-9.5 h-9.5 rounded-lg bg-emerald-500/10 text-accent flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.95a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16.92z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.phoneNumber')}</div>
          <div className="text-[0.9rem] text-text-main break-all leading-normal mb-2.5">{parsed.phone}</div>
          <div className="flex gap-2 flex-wrap">
            <a href={parsed.raw} className="inline-flex items-center gap-1.5 bg-accent-gradient text-white px-3 py-1.5 rounded text-xs font-semibold hover:-translate-y-px hover:shadow-[0_4px_10px_var(--accent-light)] transition-all duration-200 shadow-sm">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/>
              </svg>
              {t('tool-qrbarcodescan.ui.call')}
            </a>
            <Button variant="secondary" size="sm" onClick={() => copyText(parsed.phone)}>
              {copied ? t('tool-qrbarcodescan.ui.copied') : t('tool-qrbarcodescan.ui.copyNumber')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'sms') {
    return (
      <div className="flex gap-3.5 items-start">
        <div className="w-9.5 h-9.5 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.smsMessage')}</div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            {parsed.phone && <div className="flex gap-2.5 items-start"><span className="text-[0.78rem] font-semibold text-text-muted w-[60px] shrink-0 pt-0.5">{t('tool-qrbarcodescan.ui.to')}</span><span className="text-[0.88rem] text-text-main break-all leading-normal">{parsed.phone}</span></div>}
            {parsed.message && <div className="flex gap-2.5 items-start"><span className="text-[0.78rem] font-semibold text-text-muted w-[60px] shrink-0 pt-0.5">{t('tool-qrbarcodescan.ui.message')}</span><span className="text-[0.88rem] text-text-main break-all leading-normal">{parsed.message}</span></div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={parsed.raw} className="inline-flex items-center gap-1.5 bg-accent-gradient text-white px-3 py-1.5 rounded text-xs font-semibold hover:-translate-y-px hover:shadow-[0_4px_10px_var(--accent-light)] transition-all duration-200 shadow-sm">{t('tool-qrbarcodescan.ui.sendSms')}</a>
          </div>
        </div>
      </div>
    );
  }

  // Default: plain text
  return (
    <div className="flex gap-3.5 items-start">
      <div className="w-9.5 h-9.5 rounded-lg bg-nav-active-bg text-accent flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="17" y1="10" x2="3" y2="10"/>
          <line x1="21" y1="6" x2="3" y2="6"/>
          <line x1="21" y1="14" x2="3" y2="14"/>
          <line x1="17" y1="18" x2="3" y2="18"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted mb-1.5">{t('tool-qrbarcodescan.ui.textData')}</div>
        <pre className="font-mono text-[0.84rem] whitespace-pre-wrap break-all bg-card border border-border rounded-lg p-2.5 px-3 mb-2.5 max-h-[160px] overflow-y-auto text-text-main leading-relaxed">{parsed.raw}</pre>
        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => copyText(parsed.raw)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {copied ? t('tool-qrbarcodescan.ui.copied') : t('tool-qrbarcodescan.ui.copyText')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Scanner Component ────────────────────────────────────────────────────
const SCAN_MODE_CAMERA = 'camera';
const SCAN_MODE_FILE = 'file';
const READER_ID = 'qrscan-camera-reader';

export default function QrBarcodeScanner() {
  const { t } = useTranslation('tools');
  const [scanMode, setScanMode] = useState(SCAN_MODE_CAMERA);

  // Camera state
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // File state
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [fileScanning, setFileScanning] = useState(false);

  // Result state
  const [lastResult, setLastResult] = useState(null); // { text, format }
  const [history, setHistory] = useState([]);
  const parsed = lastResult ? parseQRPayload(lastResult.text) : null;

  const html5QrcodeRef = useRef(null);
  const scannerMountedRef = useRef(false);
  const fileInputRef = useRef(null);

  // ── Cleanup scanner on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && scannerMountedRef.current) {
        html5QrcodeRef.current.stop().catch(() => {});
        scannerMountedRef.current = false;
      }
    };
  }, []);

  // ── Stop camera when switching scan mode ───────────────────────────────────
  const switchMode = (mode) => {
    if (mode === scanMode) return;
    if (isScanning) {
      stopScanning();
    }
    setScanMode(mode);
    setLastResult(null);
    setFilePreviewUrl(null);
    setFileError(null);
    setCameraError(null);
  };

  // ── Handle successful scan ─────────────────────────────────────────────────
  const onScanSuccess = useCallback((decodedText, decodedResult) => {
    // Prevent duplicate consecutive results
    setLastResult(prev => {
      if (prev && prev.text === decodedText) return prev;
      playBeep();
      const format = decodedResult?.result?.format?.formatName || 'Unknown';
      const newResult = { text: decodedText, format };
      setHistory(h => [newResult, ...h].slice(0, 10));
      return newResult;
    });
  }, []);

  // ── Request camera permission & list cameras ───────────────────────────────
  const requestCamerasAndStart = async () => {
    setCameraError(null);
    setPermissionRequested(true);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError(t('tool-qrbarcodescan.ui.noCameras'));
        return;
      }
      setCameras(devices);
      // Prefer back camera on mobile
      const backCamera = devices.find(d =>
        /back|rear|environment/i.test(d.label)
      );
      const preferredId = backCamera ? backCamera.id : devices[0].id;
      setSelectedCamera(preferredId);
      startScanning(preferredId);
    } catch {
      setCameraError(t('tool-qrbarcodescan.ui.cameraDenied'));
    }
  };

  // ── Start camera scanning ──────────────────────────────────────────────────
  const startScanning = async (cameraId) => {
    if (isScanning) return;
    const readerEl = document.getElementById(READER_ID);
    if (!readerEl) return;

    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(READER_ID, { verbose: false });
      }
      await html5QrcodeRef.current.start(
        cameraId || selectedCamera || { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScanSuccess,
        () => {} // ignore per-frame errors
      );
      scannerMountedRef.current = true;
      setIsScanning(true);
      setCameraError(null);
    } catch {
      setCameraError(t('tool-qrbarcodescan.ui.cameraStartFailed'));
    }
  };

  // ── Stop camera scanning ───────────────────────────────────────────────────
  const stopScanning = async () => {
    if (!html5QrcodeRef.current || !scannerMountedRef.current) return;
    try {
      await html5QrcodeRef.current.stop();
      scannerMountedRef.current = false;
      setIsScanning(false);
    } catch {
      setIsScanning(false);
      scannerMountedRef.current = false;
    }
  };

  // ── Change selected camera ─────────────────────────────────────────────────
  const handleCameraChange = async (e) => {
    const newId = e.target.value;
    setSelectedCamera(newId);
    if (isScanning) {
      await stopScanning();
      // Brief timeout to allow DOM cleanup
      setTimeout(() => startScanning(newId), 200);
    }
  };

  // ── File scanning ──────────────────────────────────────────────────────────
  const scanFile = async (file) => {
    if (!file) return;
    const sizeCheck = validateFileSize(file, RESOURCE_LIMITS.MAX_QR_IMAGE_BYTES, 'QR image');
    if (!sizeCheck.valid) {
      setFileError(t('tool-qrbarcodescan.ui.fileTooLarge'));
      return;
    }
    if (!/^image\//i.test(file.type)) {
      setFileError(t('tool-qrbarcodescan.ui.selectImage'));
      return;
    }
    setFileError(null);
    setLastResult(null);
    setFileScanning(true);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);

    try {
      // Create a temporary, off-screen div for Html5Qrcode file scanning
      let tempDiv = document.getElementById('qrscan-file-reader-temp');
      if (!tempDiv) {
        tempDiv = document.createElement('div');
        tempDiv.id = 'qrscan-file-reader-temp';
        tempDiv.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
        document.body.appendChild(tempDiv);
      }

      const fileScanner = new Html5Qrcode('qrscan-file-reader-temp', { verbose: false });
      const result = await fileScanner.scanFile(file, false);
      playBeep();
      const newResult = { text: result, format: 'Unknown' };
      setLastResult(newResult);
      setHistory(h => [newResult, ...h].slice(0, 10));
    } catch {
      setFileError(t('tool-qrbarcodescan.ui.notFound'));
    } finally {
      setFileScanning(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) scanFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) scanFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearResult = () => {
    setLastResult(null);
    setFilePreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFileError(null);
  };

  const clearHistory = () => setHistory([]);
  return (
    <Card variant="tool" size="wide" id="tool-qrbarcodescan" className="active">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-border pb-4">
        <ToolHeader 
          title={t('tool-qrbarcodescan.ui.title')}
          className="!border-b-0 !pb-0"
        />
        <div className="flex gap-2 shrink-0">
          <Button
            variant={scanMode === SCAN_MODE_CAMERA ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchMode(SCAN_MODE_CAMERA)}
            className="flex items-center gap-1.5"
            id="qrscan-tab-camera"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>{t('tool-qrbarcodescan.ui.cameraScan')}</span>
          </Button>
          <Button
            variant={scanMode === SCAN_MODE_FILE ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => switchMode(SCAN_MODE_FILE)}
            className="flex items-center gap-1.5"
            id="qrscan-tab-file"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>{t('tool-qrbarcodescan.ui.uploadImage')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-7 items-start">
        {/* ── Left: Scanner / Upload Panel ── */}
        <div className="flex flex-col gap-4">

          {/* ──── Camera Mode ──── */}
          {scanMode === SCAN_MODE_CAMERA && (
            <div className="flex flex-col gap-3">
              {!permissionRequested ? (
                <div className="bg-card border border-border rounded-2xl p-10 px-6 flex flex-col items-center text-center gap-3">
                  <div className="text-accent bg-accent/10 rounded-full w-20 h-20 flex items-center justify-center mb-1">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <p className="text-[1.1rem] font-bold text-text-main m-0">{t('tool-qrbarcodescan.ui.cameraRequired')}</p>
                  <p className="text-[0.88rem] text-text-muted max-w-[320px] leading-relaxed m-0">{t('tool-qrbarcodescan.ui.cameraPrivacy')}</p>
                  <Button id="qrscan-start-camera-btn" variant="primary" className="flex items-center gap-2" onClick={requestCamerasAndStart}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    {t('tool-qrbarcodescan.ui.enableCamera')}
                  </Button>
                  {cameraError && <p className="text-[0.84rem] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 px-3.5 mt-1">{cameraError}</p>}
                </div>
              ) : (
                <>
                  {/* Camera controls */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {cameras.length > 1 && (
                      <select
                        id="qrscan-camera-select"
                        className="flex-1 min-w-[140px] bg-card border border-border rounded-lg text-text-main text-[0.85rem] px-2.5 py-2 cursor-pointer outline-none focus:border-accent"
                        value={selectedCamera}
                        onChange={handleCameraChange}
                      >
                        {cameras.map(cam => (
                          <option key={cam.id} value={cam.id}>
                            {cam.label || t('tool-qrbarcodescan.ui.cameraFallback', { id: cam.id.slice(0, 8) })}
                          </option>
                        ))}
                      </select>
                    )}
                    {isScanning ? (
                      <Button id="qrscan-stop-btn" variant="secondary" className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:border-red-500/30" onClick={stopScanning}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="1"/>
                        </svg>
                        {t('tool-qrbarcodescan.ui.stopCamera')}
                      </Button>
                    ) : (
                      <Button id="qrscan-start-btn" variant="primary" size="sm" className="flex items-center gap-2" onClick={() => startScanning()}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        {t('tool-qrbarcodescan.ui.startCamera')}
                      </Button>
                    )}
                  </div>

                  {cameraError && <p className="text-[0.84rem] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 px-3.5 mt-1">{cameraError}</p>}

                  {/* Camera viewfinder */}
                  <div className="relative rounded-2xl overflow-hidden bg-black max-h-[220px] aspect-square w-full">
                    <div id={READER_ID} className="w-full h-full" />
                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="absolute w-7 h-7 border-t-[3px] border-l-[3px] border-accent rounded-tl top-4 left-4" />
                        <div className="absolute w-7 h-7 border-t-[3px] border-r-[3px] border-accent rounded-tr top-4 right-4" />
                        <div className="absolute w-7 h-7 border-b-[3px] border-l-[3px] border-accent rounded-bl bottom-4 left-4" />
                        <div className="absolute w-7 h-7 border-b-[3px] border-r-[3px] border-accent rounded-br bottom-4 right-4" />
                        <div className="absolute left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-transparent via-accent via-[#a3f07a] via-accent to-transparent rounded shadow-[0_0_8px_2px_var(--accent),0_0_16px_4px_rgba(79,185,73,0.4)] animate-[qrscan-laser-sweep_2.2s_ease-in-out_infinite]" />
                      </div>
                    )}
                  </div>

                  {!isScanning && !cameraError && (
                    <p className="text-[0.83rem] text-text-muted text-center mt-1 flex items-center justify-center gap-1.5">{t('tool-qrbarcodescan.ui.cameraStopped')}</p>
                  )}
                  {isScanning && !lastResult && (
                    <p className="text-[0.83rem] text-accent text-center mt-1 flex items-center justify-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" /> {t('tool-qrbarcodescan.ui.scanningCamera')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ──── File Upload Mode ──── */}
          {scanMode === SCAN_MODE_FILE && (
            <div className="flex flex-col gap-3">
              <div
                id="qrscan-dropzone"
                className={`border-2 border-dashed border-border rounded-2xl cursor-pointer transition-colors duration-200 max-h-[220px] aspect-square w-full flex items-center justify-center overflow-hidden bg-card relative hover:border-accent hover:bg-accent/5 ${isDragging ? 'border-accent bg-accent/5' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id="qrscan-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {filePreviewUrl ? (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img src={filePreviewUrl} alt={t('tool-qrbarcodescan.ui.previewAlt')} className="w-full h-full object-contain rounded-xl" />
                    {fileScanning && (
                      <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center gap-3 text-white text-[0.9rem] font-semibold rounded-xl overflow-hidden">
                        <div className="absolute left-[8%] right-[8%] h-[2px] bg-gradient-to-r from-transparent via-accent via-[#a3f07a] via-accent to-transparent shadow-[0_0_8px_2px_var(--accent)] animate-[qrscan-laser-sweep_1.5s_ease-in-out_infinite]" />
                        <span>{t('tool-qrbarcodescan.ui.scanning')}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 p-6 text-center text-text-muted">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <p className="text-base font-semibold text-text-main m-0">{t('tool-qrbarcodescan.ui.dropImage')}</p>
                    <p className="text-[0.84rem] m-0">{t('tool-qrbarcodescan.ui.browseFiles')}</p>
                    <p className="text-[0.76rem] m-0 opacity-70">{t('tool-qrbarcodescan.ui.supportedImages')}</p>
                  </div>
                )}
              </div>

              {filePreviewUrl && (
                <div className="flex gap-2.5 flex-wrap">
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    {t('tool-qrbarcodescan.ui.chooseDifferent')}
                  </Button>
                  <Button variant="secondary" onClick={clearResult}>{t('tool-qrbarcodescan.ui.clear')}</Button>
                </div>
              )}

              {fileError && (
                <div className="flex items-start gap-2 text-[0.84rem] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 px-3.5 mt-3 leading-normal">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {fileError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Results Panel ── */}
        <div className="flex flex-col gap-4 md:sticky md:top-20">
          {lastResult ? (
            <div className="bg-card border border-border rounded-2xl p-4.5 shadow-card animate-[fadeInScale_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
              <div className="flex items-center gap-2 mb-3.5 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-accent rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold tracking-wide">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {t('tool-qrbarcodescan.ui.decoded')}
                </div>
                {lastResult.format && lastResult.format !== 'Unknown' && (
                  <span className="bg-nav-active-bg text-text-muted rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold">{FORMAT_LABELS[lastResult.format] || lastResult.format}</span>
                )}
                <button className="ml-auto bg-transparent border-none text-text-muted cursor-pointer p-1 rounded transition-colors hover:text-red-500" onClick={clearResult} title={t('tool-qrbarcodescan.ui.clearResult')}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {parsed && <ResultWidget parsed={parsed} />}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 px-5 flex flex-col items-center text-center gap-2 text-text-muted">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h3v3m0 4h4m0 0v-4m-7 4h3"/>
              </svg>
              <p className="text-[0.95rem] font-semibold text-text-main m-0">{t('tool-qrbarcodescan.ui.noResult')}</p>
              <p className="text-[0.83rem] m-0 leading-relaxed">
                {scanMode === SCAN_MODE_CAMERA
                  ? t('tool-qrbarcodescan.ui.cameraPrompt')
                  : t('tool-qrbarcodescan.ui.uploadPrompt')}
              </p>
            </div>
          )}

          {/* Supported Formats */}
          <div className="bg-card border border-border rounded-2xl p-4 px-4.5">
            <div className="text-[0.8rem] font-bold uppercase tracking-wider text-text-muted mb-2.5">{t('tool-qrbarcodescan.ui.supportedFormats')}</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-emerald-500/10 text-accent border-emerald-500/20">QR Code</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-emerald-500/10 text-accent border-emerald-500/20">Data Matrix</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-emerald-500/10 text-accent border-emerald-500/20">Aztec</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-emerald-500/10 text-accent border-emerald-500/20">PDF 417</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">Code 128</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">Code 39</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">Code 93</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">EAN-13</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">EAN-8</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">UPC-A</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">UPC-E</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">ITF</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">Codabar</span>
              <span className="rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold border bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20">RSS 14</span>
            </div>
            <div className="flex gap-3.5 mt-1.5">
              <span className="inline-flex items-center gap-1.5 text-[0.76rem] text-text-muted"><span className="w-2 h-2 rounded-full shrink-0 bg-accent" />{t('tool-qrbarcodescan.ui.codes2d')}</span>
              <span className="inline-flex items-center gap-1.5 text-[0.76rem] text-text-muted"><span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />{t('tool-qrbarcodescan.ui.barcodes1d')}</span>
            </div>
          </div>

          {/* Scan History */}
          {history.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 px-4.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[0.8rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-qrbarcodescan.ui.history')}</span>
                <Button variant="secondary" size="sm" className="px-2.5 py-1 text-[0.78rem]" onClick={clearHistory}>{t('tool-qrbarcodescan.ui.clear')}</Button>
              </div>
              <ul className="list-none m-0 p-0 flex flex-col gap-1">
                {history.map((item, idx) => {
                  const p = parseQRPayload(item.text);
                  const typeIcon = {
                    url: '🔗',
                    wifi: '📶',
                    email: '✉️',
                    phone: '📞',
                    sms: '💬',
                    text: '📄',
                  }[p.type] || '📄';
                  return (
                    <li key={idx} className="flex items-center gap-2 p-1.5 px-2.5 rounded-lg cursor-pointer transition-all border border-transparent hover:bg-nav-hover-bg hover:border-border" onClick={() => setLastResult(item)} title={t('tool-qrbarcodescan.ui.clickView')}>
                      <span className="text-base shrink-0">{typeIcon}</span>
                      <span className="text-[0.82rem] text-text-muted truncate">{item.text.length > 60 ? item.text.slice(0, 60) + '…' : item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
