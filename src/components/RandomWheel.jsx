import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import FieldInput from './ui/FieldInput';
import {
  createDrawRecord,
  verifyDrawRecord,
} from '../lib/verifiableRandom';

const colors = [
  "hsl(224, 76%, 60%)",  // indigo
  "hsl(142, 72%, 45%)",  // emerald
  "hsl(38, 92%, 50%)",   // amber
  "hsl(330, 81%, 60%)",  // pink/rose
  "hsl(194, 91%, 48%)",  // cyan
  "hsl(262, 83%, 62%)",  // purple
  "hsl(16, 90%, 54%)",   // orange
  "hsl(209, 89%, 52%)"   // bright blue
];

export default function RandomWheel() {
  const { t, i18n } = useTranslation('tools');
  const [items, setItems] = useState([
    { text: '1', id: 0, disabled: false },
    { text: '2', id: 1, disabled: false },
    { text: '3', id: 2, disabled: false },
    { text: '4', id: 3, disabled: false },
    { text: '5', id: 4, disabled: false },
  ]);
  
  const [textareaVal, setTextareaVal] = useState("1\n2\n3\n4\n5");
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  
  const [winner, setWinner] = useState(null);
  const [showWinnerBanner, setShowWinnerBanner] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  
  const [showClearModal, setShowClearModal] = useState(false);
  const [drawRecord, setDrawRecord] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');

  const canvasRef = useRef(null);
  const rotationAngleRef = useRef(0);
  const animationFrameRef = useRef(null);
  const actionsRef = useRef({ drawWheel: null, spin: null, resetItems: null });

  // Sync textarea edits to items state
  const handleTextareaChange = (val) => {
    setTextareaVal(val);
    const lines = val.split(/\r?\n/).map(line => line.trim());
    
    // Remember disabled status by text value
    const disabledTexts = new Set(
      items.filter(item => item.disabled).map(item => item.text)
    );

    let parsedCount = 0;
    const newItems = [];
    lines.forEach(line => {
      if (line !== "") {
        newItems.push({
          text: line,
          id: parsedCount++,
          disabled: disabledTexts.has(line)
        });
      }
    });
    setItems(newItems);
  };

  const drawWheel = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpi = window.devicePixelRatio || 1;
    const size = 450;
    const radius = 210;
    const centerX = size / 2;
    const centerY = size / 2;

    canvas.width = size * dpi;
    canvas.height = size * dpi;
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, size, size);

    const activeItems = items.filter(item => !item.disabled);

    if (activeItems.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(148, 163, 184, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "var(--border-color)";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "var(--text-muted)";
      ctx.font = '500 16px "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t('tool-wheel.ui.noActiveOptions'), centerX, centerY);

      ctx.beginPath();
      ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
      ctx.fillStyle = "var(--bg-card)";
      ctx.fill();
      ctx.strokeStyle = "var(--border-color)";
      ctx.lineWidth = 3;
      ctx.stroke();
      return;
    }

    const arcSize = (2 * Math.PI) / activeItems.length;

    // Draw sectors
    for (let i = 0; i < activeItems.length; i++) {
      const startAngle = angle + i * arcSize;
      const endAngle = angle + (i + 1) * arcSize;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw text labels
    for (let i = 0; i < activeItems.length; i++) {
      const startAngle = angle + i * arcSize;
      const midAngle = startAngle + arcSize / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);

      const isLeftHalf = Math.cos(midAngle) < 0;
      ctx.fillStyle = "#ffffff";
      
      let fontSize = 16;
      if (activeItems.length > 20) fontSize = 10;
      else if (activeItems.length > 12) fontSize = 12;
      else if (activeItems.length > 8) fontSize = 14;

      ctx.font = `bold ${fontSize}px "TASA Orbiter", "Inter", sans-serif`;
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(15, 23, 42, 0.35)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const label = activeItems[i].text;
      let displayLabel = label;
      if (label.length > 16) {
        displayLabel = label.substring(0, 14) + "...";
      }

      if (isLeftHalf) {
        ctx.rotate(midAngle + Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(displayLabel, -(radius - 28), 0);
      } else {
        ctx.rotate(midAngle);
        ctx.textAlign = "right";
        ctx.fillText(displayLabel, radius - 28, 0);
      }
      
      ctx.restore();
    }

    // Center hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.fillStyle = isDark ? "#111827" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = isDark ? "#6366f1" : "#4f46e5";
    ctx.lineWidth = 4;
    ctx.stroke();
  }, [items, t]);

  // Redraw when items, rotationAngle or theme changes
  useEffect(() => {
    drawWheel(rotationAngle);
  }, [drawWheel, i18n.language, rotationAngle]);

  // Cleanup animation frame only on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle key listeners and redraw on theme change
  useEffect(() => {
    // Redraw on theme toggles
    const handleThemeChange = () => {
      setTimeout(() => actionsRef.current.drawWheel?.(rotationAngleRef.current), 50);
    };

    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", handleThemeChange);
    }

    // Keyboard Shortcuts
    const handleKeyDown = (e) => {
      // Do not intercept if focus is inside input/textarea fields
      const activeEl = /** @type {HTMLElement | null} */ (document.activeElement);
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
        if (e.key === "Escape" && activeEl.id === "wheel-text-input") {
          setIsEditing(false);
        }
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        actionsRef.current.spin?.();
      } else if (e.key.toLowerCase() === "r") {
        actionsRef.current.resetItems?.();
      } else if (e.key.toLowerCase() === "c") {
        setShowClearModal(true);
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsEditing(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (toggleBtn) {
        toggleBtn.removeEventListener("click", handleThemeChange);
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [items, isSpinning, allowDuplicate]);

  const spin = async () => {
    if (isSpinning) return;
    
    // Auto-save edit mode if open
    setIsEditing(false);

    const activeItems = items.filter(item => !item.disabled);
    if (activeItems.length === 0) {
      alert(t('tool-wheel.ui.addActiveOption'));
      return;
    }

    let record;
    try {
      record = await createDrawRecord(activeItems.map((item) => item.text));
    } catch {
      alert(t('tool-wheel.ui.drawFailed'));
      return;
    }

    setDrawRecord(record);
    setIsSpinning(true);
    setShowWinnerBanner(false);

    const winIndex = record.winnerIndex;
    const arcSize = (2 * Math.PI) / activeItems.length;
    
    const targetSectorCenter = winIndex * arcSize + arcSize / 2;
    const spinsCount = 7;
    const targetAngle = 2 * Math.PI * spinsCount - targetSectorCenter;

    const startAngleVal = rotationAngleRef.current % (2 * Math.PI);
    let startTime = null;
    const duration = 4000; // 4 seconds

    const animate = (time) => {
      const currentTime = time || performance.now();
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // quintic ease-out deceleration curve
      const ease = 1 - Math.pow(1 - progress, 5);
      const angle = startAngleVal + (targetAngle - startAngleVal) * ease;
      rotationAngleRef.current = angle;

      drawWheel(angle);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        rotationAngleRef.current = targetAngle;
        setRotationAngle(targetAngle);
        
        // Announce winner
        const winItem = activeItems[winIndex];
        setWinner(winItem);
        setShowWinnerBanner(true);

        if (!allowDuplicate) {
          setItems(prevItems => 
            prevItems.map(it => it.id === winItem.id ? { ...it, disabled: true } : it)
          );
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const resetItems = () => {
    if (isSpinning) return;
    setItems(prevItems => prevItems.map(it => ({ ...it, disabled: false })));
    setShowWinnerBanner(false);
  };

  actionsRef.current = { drawWheel, spin, resetItems };

  const copyDrawRecord = async () => {
    if (!drawRecord) return;
    await navigator.clipboard.writeText(JSON.stringify(drawRecord, null, 2));
  };

  const downloadDrawRecord = () => {
    if (!drawRecord) return;
    const blob = new Blob([JSON.stringify(drawRecord, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'random-wheel-draw-record.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const verifyImportedRecord = async () => {
    try {
      const record = JSON.parse(verificationInput);
      const result = await verifyDrawRecord(record);
      setVerificationStatus(result.valid
        ? t('tool-wheel.ui.verifiedWinner', { winner: result.winnerName })
        : t('tool-wheel.ui.invalidRecord'));
    } catch {
      setVerificationStatus(t('tool-wheel.ui.invalidJson'));
    }
  };

  const confirmClear = () => {
    setShowClearModal(false);
    setTextareaVal("");
    setItems([]);
    setIsEditing(true);
    setShowWinnerBanner(false);
  };

  return (
    <Card id="tool-wheel" variant="tool" size="wide">
      <ToolHeader 
        title={t('tool-wheel.ui.title')}
      />

      <div className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        
        {/* Left side: Wheel Canvas & Win Banner */}
        <div className="relative flex min-h-[390px] w-full flex-col items-center justify-center rounded-2xl border border-border bg-app p-4 max-[768px]:min-h-0 max-[768px]:p-[20px_12px]">
          <div className="z-[5] mb-3 select-none rounded-full border border-white/10 bg-slate-900/75 px-6 py-2 text-center font-display text-base font-bold tracking-wide text-white shadow-lg backdrop-blur-md dark:bg-black/75 max-[768px]:mb-4 max-[768px]:px-6 max-[768px]:py-2 max-[768px]:text-[1.1rem]" id="wheel-display-title">
            {title || t('tool-wheel.ui.defaultTitle')}
          </div>
          <div className="relative aspect-square w-full max-w-[300px] cursor-pointer overflow-visible rounded-full bg-card shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:scale-[1.01]" id="wheel-canvas-wrapper">
            <canvas ref={canvasRef} id="wheel-canvas" className="w-full h-full block" width="450" height="450" onClick={spin}></canvas>
            <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center drop-shadow-md pointer-events-none" onClick={spin}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="red">
                <polygon points="24,12 0,4 0,20" />
              </svg>
            </div>
            <div className="absolute left-1/2 top-1/2 z-[8] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-full border-4 border-accent bg-gradient-to-br from-card to-app font-display text-[0.85rem] font-extrabold tracking-wider text-accent shadow-[0_4px_12px_rgba(0,0,0,0.15),_inset_0_2px_4px_rgba(255,255,255,0.2)] transition-all duration-200 hover:scale-108 hover:border-white hover:bg-accent hover:text-white hover:shadow-[0_6px_18px_rgba(79,70,229,0.4)] active:scale-96 max-[768px]:h-[50px] max-[768px]:w-[50px] max-[768px]:text-[0.7rem]" id="wheel-spin-btn-center" onClick={spin}>
              <span>{t('tool-wheel.ui.spin')}</span>
            </div>
          </div>

          {/* Result overlay banner */}
          {showWinnerBanner && winner && (
            <div id="wheel-result-banner" className="mt-6 w-full max-w-[420px] bg-accent-light border-2 border-accent rounded-xl p-[16px_20px] flex items-center justify-between gap-4 animate-[bannerPopIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)]" style={{ display: 'flex' }}>
              <span className="text-[0.75rem] uppercase font-bold text-text-muted tracking-wider">{t('tool-wheel.ui.winningSelection')}</span>
              <strong className="text-xl md:text-2xl font-bold text-accent font-display flex-grow text-center word-break break-all" id="wheel-result-text">{winner.text}</strong>
              <button
                id="wheel-result-close"
                className="background-transparent border-none text-text-muted text-2xl cursor-pointer transition-colors duration-200 px-1 line-height-none hover:text-text-main"
                aria-label={t('tool-wheel.ui.closeBanner')}
                onClick={() => setShowWinnerBanner(false)}
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Right side: Controls & Options */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-sidebar p-4 max-[768px]:p-4">
          <div className="flex gap-3 w-full">
            <Button id="wheel-spin-btn" className="flex-1" variant="primary" onClick={spin} disabled={isSpinning}>{t('tool-wheel.ui.spin')}</Button>
            <Button id="wheel-reset-btn" className="flex-1" variant="secondary" onClick={resetItems} disabled={isSpinning}>{t('tool-wheel.ui.reset')}</Button>
          </div>

          {/* Options Box with View Mode and Edit Mode */}
          <div className="flex min-h-[190px] flex-col overflow-hidden rounded-xl border border-border bg-app">
            <div className="flex-grow flex flex-col">
              {/* View Mode (List View) */}
              {!isEditing && (
                <div id="wheel-list-view" className="flex h-[190px] flex-col gap-2 overflow-y-auto p-3" role="group" aria-label={t('tool-wheel.ui.optionsListAria')} tabIndex={0}>
                  {items.length === 0 ? (
                    <div className="text-text-muted italic p-3 text-sm text-center">
                      {t('tool-wheel.ui.noOptions')}
                    </div>
                  ) : (
                    items.map(item => (
                      <div key={item.id} className={`p-[8px_12px] rounded-lg text-[0.95rem] bg-card border border-border text-text-main font-medium transition-all duration-200 break-all text-left ${item.disabled ? '!bg-slate-500/5 dark:!bg-slate-400/5 !border-border !text-text-muted line-through opacity-65' : ''}`}>
                        {item.text}
                      </div>
                    ))
                  )}
                </div>
              )}
              {/* Edit Mode (Textarea Input) */}
              {isEditing && (
                <textarea
                  id="wheel-text-input"
                  className="h-[190px] w-full resize-none border-none bg-transparent p-3 font-sans text-[0.95rem] leading-relaxed text-text-main outline-none"
                  placeholder={t('tool-wheel.ui.optionsPlaceholder')}
                  value={textareaVal}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  disabled={isSpinning}
                />
              )}
            </div>
            
            <div className="flex gap-2 p-2 justify-end items-center border-t border-border bg-card">
              <label className="flex items-center gap-2 cursor-pointer select-none mr-auto">
                <input
                  type="checkbox"
                  id="wheel-allow-duplicate"
                  className="w-auto cursor-pointer"
                  checked={allowDuplicate}
                  onChange={(e) => setAllowDuplicate(e.target.checked)}
                  disabled={isSpinning}
                />
                <span className="text-xs text-text-muted font-medium">{t('tool-wheel.ui.allowRepeat')}</span>
              </label>

              <Button
                id="wheel-title-btn"
                size="sm"
                variant="secondary"
                onClick={() => setShowTitleInput(prev => !prev)}
                disabled={isSpinning}
              >
                {t('tool-wheel.ui.titleButton')}
              </Button>
              <Button
                id="wheel-edit-btn"
                size="sm"
                variant={isEditing ? 'primary' : 'secondary'}
                onClick={() => setIsEditing(prev => !prev)}
                disabled={isSpinning}
              >
                {isEditing ? t('tool-wheel.ui.done') : t('tool-wheel.ui.edit')}
              </Button>
              <Button
                id="wheel-clear-btn"
                size="sm"
                variant="secondary"
                onClick={() => !isSpinning && setShowClearModal(true)}
                disabled={isSpinning}
              >
                {t('tool-wheel.ui.clear')}
              </Button>
            </div>
          </div>

          {drawRecord && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-app p-3">
              <span className="w-full text-xs text-text-muted">
                {t('tool-wheel.ui.recorded', { algorithm: drawRecord.algorithm, index: drawRecord.winnerIndex })}
              </span>
              <Button size="sm" variant="secondary" onClick={copyDrawRecord}>{t('tool-wheel.ui.copyRecord')}</Button>
              <Button size="sm" variant="secondary" onClick={downloadDrawRecord}>{t('tool-wheel.ui.downloadJson')}</Button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-app p-3">
            <button
              type="button"
              className="text-xs font-semibold text-accent"
              onClick={() => setShowVerification((value) => !value)}
            >
              {showVerification ? t('tool-wheel.ui.hideVerification') : t('tool-wheel.ui.verifyDraw')}
            </button>
            {showVerification && (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  aria-label={t('tool-wheel.ui.recordJsonAria')}
                  value={verificationInput}
                  onChange={(event) => setVerificationInput(event.target.value)}
                  placeholder={t('tool-wheel.ui.recordJsonPlaceholder')}
                  className="h-28 resize-y rounded border border-border bg-card p-2 font-mono text-xs text-text-main"
                />
                <Button size="sm" variant="secondary" onClick={verifyImportedRecord}>{t('tool-wheel.ui.verifyRecord')}</Button>
                {verificationStatus && <p className="text-xs text-text-muted">{verificationStatus}</p>}
              </div>
            )}
          </div>

          {showTitleInput && (
            <div id="wheel-title-input-group" className="flex flex-col gap-2 w-full">
              <FieldInput
                id="wheel-title-input"
                label={t('tool-wheel.ui.editTitle')}
                type="text"
                placeholder={t('tool-wheel.ui.defaultTitle')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}

          <p className="text-center text-[0.72rem] text-text-muted">
            {t('tool-wheel.ui.shortcuts')}
          </p>
          <p className="text-center text-[0.72rem] text-text-muted">
            {t('tool-wheel.ui.disclaimer')}
          </p>
        </div>

      </div>

      {/* Confirmation Clear Modal */}
      {showClearModal && (
        <div id="wheel-clear-modal" className="fixed inset-0 z-[1000] flex items-center justify-center p-5" style={{ display: 'flex' }}>
          <div id="wheel-clear-modal-backdrop" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowClearModal(false)}></div>
          <div className="relative bg-card border border-border rounded-2xl p-7 max-w-[420px] w-full shadow-2xl z-[1001] flex flex-col gap-4 animate-[modalSlideIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
            <h2 className="font-display text-lg font-bold text-text-main">{t('tool-wheel.ui.clearAllTitle')}</h2>
            <p className="text-sm text-text-muted leading-relaxed">{t('tool-wheel.ui.clearAllBody')}</p>
            <div className="flex gap-3 justify-end mt-2">
              <Button id="wheel-confirm-clear-btn" variant="dangerConfirm" onClick={confirmClear}>{t('tool-wheel.ui.confirmClear')}</Button>
              <Button id="wheel-cancel-clear-btn" variant="secondary" onClick={() => setShowClearModal(false)}>{t('tool-wheel.ui.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
