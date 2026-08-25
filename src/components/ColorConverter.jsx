import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import FieldInput from './ui/FieldInput';

function parseHexColor(value) {
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function parseRgbColor(value) {
  const trimmed = value.trim();
  const match =
    trimmed.match(
      /^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i
    ) || trimmed.match(/^([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})$/);

  if (!match) {
    return null;
  }

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  if ([r, g, b].some((val) => Number.isNaN(val) || val < 0 || val > 255)) {
    return null;
  }

  return { r, g, b };
}

function parseHslColor(value) {
  const trimmed = value.trim();
  const match =
    trimmed.match(
      /^hsl\(\s*([0-9]{1,3}(?:\.\d+)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*\)$/i
    ) ||
    trimmed.match(
      /^([0-9]{1,3}(?:\.\d+)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*,\s*([0-9]{1,3}(?:\.\d+)?)%$/
    );

  if (!match) {
    return null;
  }

  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);

  if ([h, s, l].some((val) => Number.isNaN(val))) {
    return null;
  }
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
    return null;
  }

  return { h, s, l };
}

function rgbToHex({ r, g, b }) {
  const toHex = (val) => val.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb({ h, s, l }) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hPrime >= 0 && hPrime < 1) {
    r1 = c;
    g1 = x;
  } else if (hPrime < 2) {
    r1 = x;
    g1 = c;
  } else if (hPrime < 3) {
    g1 = c;
    b1 = x;
  } else if (hPrime < 4) {
    g1 = x;
    b1 = c;
  } else if (hPrime < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = lNorm - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function formatRgb({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHsl({ h, s, l }) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function parseHsbColor(value) {
  const trimmed = value.trim();
  const match =
    trimmed.match(
      /^hsb\(\s*([0-9]{1,3}(?:\.\d+)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*\)$/i
    ) ||
    trimmed.match(
      /^hsv\(\s*([0-9]{1,3}(?:\.\d+)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*\)$/i
    ) ||
    trimmed.match(
      /^([0-9]{1,3}(?:\.\d+)?)\s*,\s*([0-9]{1,3}(?:\.\d+)?)%\s*,\s*([0-9]{1,3}(?:\.\d+)?)%$/
    );
  if (!match) return null;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const b = Number(match[3]);
  if ([h, s, b].some(Number.isNaN)) return null;
  if (h < 0 || h > 360 || s < 0 || s > 100 || b < 0 || b > 100) return null;
  return { h, s, b };
}

function parseCmykColor(value) {
  const trimmed = value.trim();
  const match =
    trimmed.match(
      /^cmyk\(\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?\s*\)$/i
    ) ||
    trimmed.match(
      /^([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*([0-9]{1,3}(?:\.\d+)?)%?$/
    );
  if (!match) return null;
  const c = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  const k = Number(match[4]);
  if ([c, m, y, k].some(Number.isNaN)) return null;
  if (c < 0 || c > 100 || m < 0 || m > 100 || y < 0 || y > 100 || k < 0 || k > 100) return null;
  return { c, m, y, k };
}

function parseLabColor(value) {
  const trimmed = value.trim();
  const match =
    trimmed.match(
      /^lab\(\s*([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*(-?[0-9]{1,3}(?:\.\d+)?)\s*,\s*(-?[0-9]{1,3}(?:\.\d+)?)\s*\)$/i
    ) ||
    trimmed.match(
      /^([0-9]{1,3}(?:\.\d+)?)%?\s*,\s*(-?[0-9]{1,3}(?:\.\d+)?)\s*,\s*(-?[0-9]{1,3}(?:\.\d+)?)$/
    );
  if (!match) return null;
  const l = Number(match[1]);
  const a = Number(match[2]);
  const b = Number(match[3]);
  if ([l, a, b].some(Number.isNaN)) return null;
  if (l < 0 || l > 100 || a < -128 || a > 127 || b < -128 || b > 127) return null;
  return { l, a, b };
}

function rgbToHsb({ r, g, b }) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    b: Math.round(max * 100),
  };
}

function hsbToRgb({ h, s, b }) {
  const sNorm = s / 100;
  const bNorm = b / 100;
  const c = bNorm * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hPrime >= 0 && hPrime < 1) { r1 = c; g1 = x; }
  else if (hPrime < 2) { r1 = x; g1 = c; }
  else if (hPrime < 3) { g1 = c; b1 = x; }
  else if (hPrime < 4) { g1 = x; b1 = c; }
  else if (hPrime < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = bNorm - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function rgbToCmyk({ r, g, b }) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
}

function cmykToRgb({ c, m, y, k }) {
  const cNorm = c / 100;
  const mNorm = m / 100;
  const yNorm = y / 100;
  const kNorm = k / 100;
  const r = Math.round(255 * (1 - cNorm) * (1 - kNorm));
  const g = Math.round(255 * (1 - mNorm) * (1 - kNorm));
  const b = Math.round(255 * (1 - yNorm) * (1 - kNorm));
  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b))
  };
}

function rgbToLab({ r, g, b }) {
  let rL = r / 255;
  let gL = g / 255;
  let bL = b / 255;
  rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
  gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
  bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

  // sRGB to D65 XYZ
  const x65 = rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375;
  const y65 = rL * 0.2126729 + gL * 0.7151522 + bL * 0.0721750;
  const z65 = rL * 0.0193339 + gL * 0.1191920 + bL * 0.9503041;

  // Bradford chromatic adaptation: D65 -> D50 XYZ (CSS Color 4)
  const xD50 = 0.9555766 * x65 - 0.0230393 * y65 + 0.0631636 * z65;
  const yD50 = -0.0282895 * x65 + 1.0099916 * y65 + 0.0210077 * z65;
  const zD50 = 0.0122982 * x65 - 0.0204830 * y65 + 1.3299098 * z65;

  // D50 reference white
  const xN = xD50 / 0.96422;
  const yN = yD50 / 1.00000;
  const zN = zD50 / 0.82521;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xN);
  const fy = f(yN);
  const fz = f(zN);

  const lVal = 116 * fy - 16;
  const aVal = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return {
    l: Math.round(lVal),
    a: Math.round(aVal),
    b: Math.round(bVal)
  };
}

function labToRgb({ l, a, b }) {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const f = (t) => (t > 0.20689655 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787);
  const xN = f(fx);
  const yN = f(fy);
  const zN = f(fz);

  const xD50 = xN * 0.96422;
  const yD50 = yN * 1.00000;
  const zD50 = zN * 0.82521;

  // Inverse Bradford chromatic adaptation: D50 -> D65 XYZ
  const x65 = 1.0478112 * xD50 + 0.0228866 * yD50 - 0.0501270 * zD50;
  const y65 = 0.0295424 * xD50 + 0.9904844 * yD50 - 0.0170491 * zD50;
  const z65 = -0.0092345 * xD50 + 0.0150436 * yD50 + 0.7521316 * zD50;

  // D65 XYZ to Linear sRGB
  let rL = 3.2404542 * x65 - 1.5371385 * y65 - 0.4985314 * z65;
  let gL = -0.9692660 * x65 + 1.8760108 * y65 + 0.0415560 * z65;
  let bL = 0.0556434 * x65 - 0.2040259 * y65 + 1.0572252 * z65;

  rL = Math.max(0, Math.min(1, rL));
  gL = Math.max(0, Math.min(1, gL));
  bL = Math.max(0, Math.min(1, bL));

  const toSrgb = (c) => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  const rOut = Math.round(toSrgb(rL) * 255);
  const gOut = Math.round(toSrgb(gL) * 255);
  const bOut = Math.round(toSrgb(bL) * 255);

  return {
    r: Math.max(0, Math.min(255, rOut)),
    g: Math.max(0, Math.min(255, gOut)),
    b: Math.max(0, Math.min(255, bOut))
  };
}

function formatHsb({ h, s, b }) {
  return `hsb(${h}, ${s}%, ${b}%)`;
}

function formatCmyk({ c, m, y, k }) {
  return `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
}

function formatLab({ l, a, b }) {
  return `lab(${l}%, ${a}, ${b})`;
}

// HSL Swatches Block Grid Generation (12 columns x 10 rows)
const SWATCH_GRID = (() => {
  const grid = [];
  const rowsCount = 10;
  
  // Grayscale values for Column 1
  const grayscaleL = [100, 89, 78, 67, 56, 45, 34, 23, 12, 0];
  
  // 11 Hue columns spaced across spectrum
  const hues = [0, 25, 45, 80, 140, 180, 205, 230, 265, 300, 330];
  // Lightness levels for Hues
  const hueL = [95, 85, 75, 65, 55, 45, 35, 25, 15, 8];

  for (let r = 0; r < rowsCount; r++) {
    const row = [];
    
    // Column 1: Grayscale (S = 0%)
    const grayRgb = hslToRgb({ h: 0, s: 0, l: grayscaleL[r] });
    const grayHex = rgbToHex(grayRgb);
    row.push(grayHex);

    // Columns 2-12: Hues (S = 100%)
    for (let c = 0; c < hues.length; c++) {
      const hueRgb = hslToRgb({ h: hues[c], s: 100, l: hueL[r] });
      const hueHex = rgbToHex(hueRgb);
      row.push(hueHex);
    }
    
    grid.push(row);
  }
  
  return grid;
})();

// A palette is user data and belongs in browser storage only. Earlier versions
// also mirrored it into a `path=/` cookie, which attached it to every request to
// the origin. Cookies are now read once so existing palettes survive, then
// cleared; nothing is written back.
const PRESETS_STORAGE_KEY = 'customPresets';

const isHexPalette = (value) => Array.isArray(value)
  && value.every((item) => typeof item === 'string' && /^#[0-9a-f]{3,8}$/iu.test(item));

const clearLegacyPresetCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${PRESETS_STORAGE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

const readLegacyPresetCookie = () => {
  if (typeof document === 'undefined') return null;
  const parts = `; ${document.cookie}`.split(`; ${PRESETS_STORAGE_KEY}=`);
  if (parts.length !== 2) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(parts.pop().split(';').shift()));
    return isHexPalette(parsed) ? parsed : null;
  } catch {
    // Ignore malformed legacy cookie data and use the default palette.
    return null;
  }
};

const readStoredPalette = (key) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return isHexPalette(parsed) ? parsed : null;
  } catch {
    // Storage may be unavailable or hold data written by another version.
    return null;
  }
};

const writeStoredPalette = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; the in-memory palette remains usable.
  }
};

// 12 Curated modern presets
const DEFAULT_PRESETS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#4F46E5", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#94A3B8", // Slate
  "#1E293B", // Charcoal
];

export default function ColorConverter() {
  const { t } = useTranslation('tools');
  const [input, setInput] = useState('#4F46E5');
  const [hslState, setHslState] = useState({ h: 244, s: 76, l: 59 }); // HSL Spectrum Selector coordinates
  const [swatchSelectedHex, setSwatchSelectedHex] = useState('#4F46E5'); // HSL Swatches Grid highlight state
  const [isSynced, setIsSynced] = useState(true); // Sync selection state toggle
  const [sliderModel, setSliderModel] = useState('HSB'); // Interactive Slider model
  
  const [recentColors, setRecentColors] = useState(() => readStoredPalette('recentColors') || []);

  // State for Customizable Standard Palettes
  const [presets, setPresets] = useState(() => {
    const stored = readStoredPalette(PRESETS_STORAGE_KEY);
    if (stored) {
      clearLegacyPresetCookie();
      return stored;
    }

    const migrated = readLegacyPresetCookie();
    clearLegacyPresetCookie();
    if (migrated) {
      writeStoredPalette(PRESETS_STORAGE_KEY, migrated);
      return migrated;
    }

    return DEFAULT_PRESETS;
  });

  const [isEditingPresets, setIsEditingPresets] = useState(false);

  const svRef = useRef(null);
  const lRef = useRef(null);
  const fileInputRef = useRef(null);

  const trimmed = input.trim();

    let hexVal = "";
  let rgbVal = "";
  let hslVal = "";
  let hsbVal = "";
  let cmykVal = "";
  let labVal = "";
    let statusText = t('tool-color.ui.enterColor');
  let swatchBg = "transparent";

  // Parse current text input to update the outputs
  if (trimmed) {
    const parsedHsl = parseHslColor(trimmed);
    const parsedHsb = parseHsbColor(trimmed);
    const parsedCmyk = parseCmykColor(trimmed);
    const parsedLab = parseLabColor(trimmed);

    const rgb =
      parseHexColor(trimmed) ||
      parseRgbColor(trimmed) ||
      (parsedHsl ? hslToRgb(parsedHsl) : null) ||
      (parsedHsb ? hsbToRgb(parsedHsb) : null) ||
      (parsedCmyk ? cmykToRgb(parsedCmyk) : null) ||
      (parsedLab ? labToRgb(parsedLab) : null);

    if (rgb) {
      const hex = rgbToHex(rgb);
      const computedHsl = rgbToHsl(rgb);
      const computedHsb = rgbToHsb(rgb);
      const computedCmyk = rgbToCmyk(rgb);
      const computedLab = rgbToLab(rgb);

      hexVal = hex;
      rgbVal = formatRgb(rgb);
      hslVal = formatHsl(computedHsl);
      hsbVal = formatHsb(computedHsb);
      cmykVal = formatCmyk(computedCmyk);
      labVal = formatLab(computedLab);
      
      statusText = "";
      swatchBg = hex;
    } else {
      statusText = t('tool-color.ui.invalidFormat');
    }
  }

  // Derive slider states from the always-valid hslState
  const activeRgb = hslToRgb(hslState);
  const activeHsb = rgbToHsb(activeRgb);
  const activeCmyk = rgbToCmyk(activeRgb);
  const activeLab = rgbToLab(activeRgb);



    // Handle manual typing in the text input box and update coordinates
  const handleUserTextChange = (e) => {
    const val = e.target.value;
    setInput(val);

    const trimmedVal = val.trim();
    if (!trimmedVal) return;

    const parsedHsl = parseHslColor(trimmedVal);
    const parsedHsb = parseHsbColor(trimmedVal);
    const parsedCmyk = parseCmykColor(trimmedVal);
    const parsedLab = parseLabColor(trimmedVal);

    const rgb =
      parseHexColor(trimmedVal) ||
      parseRgbColor(trimmedVal) ||
      (parsedHsl ? hslToRgb(parsedHsl) : null) ||
      (parsedHsb ? hsbToRgb(parsedHsb) : null) ||
      (parsedCmyk ? cmykToRgb(parsedCmyk) : null) ||
      (parsedLab ? labToRgb(parsedLab) : null);

    if (rgb) {
      const computedHsl = rgbToHsl(rgb);
      const hex = rgbToHex(rgb);

      // Always update HSL Spectrum Selector coordinates
      setHslState(computedHsl);

      // Only update Swatches Grid selection if Sync mode is active
      if (isSynced) {
        setSwatchSelectedHex(hex);
      }
    }
  };

  // Handle Sync toggle click
  const handleSyncToggle = () => {
    const nextSync = !isSynced;
    setIsSynced(nextSync);
    if (nextSync) {
      // Force sync Swatches Grid highlight to match current Spectrum selector color
      const rgb = hslToRgb(hslState);
      const hex = rgbToHex(rgb);
      setSwatchSelectedHex(hex);
    }
  };

  // Add a hex color to recent colors list
  const addRecentColor = (hex) => {
    if (!hex) return;
    const formatted = hex.toUpperCase();
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toUpperCase() !== formatted);
      const next = [formatted, ...filtered].slice(0, 8);
      writeStoredPalette('recentColors', next);
      return next;
    });
  };

  // Clear Recent Colors
  const handleClearRecents = () => {
    setRecentColors([]);
    try {
      localStorage.removeItem("recentColors");
    } catch {
      // Storage may be unavailable; clearing the in-memory list is sufficient.
    }
  };

  // Eyedropper API
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const handleEyeDropper = async () => {
    const EyeDropperClass = window.EyeDropper;
    if (!hasEyeDropper || !EyeDropperClass) return;
    try {
      const eyeDropper = new EyeDropperClass();
      const result = await eyeDropper.open();
      const hex = result.sRGBHex;
      setInput(hex);
      setSwatchSelectedHex(hex);
      addRecentColor(hex);
      if (isSynced) {
        setHslState(rgbToHsl(parseHexColor(hex)));
      }
    } catch (err) {
      console.log("EyeDropper cancelled or failed", err);
    }
  };

  // Drag handlers for Hue-Saturation Board
  const updateSv = (clientX, clientY) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    const h = Math.round((x / rect.width) * 360);
    const s = Math.round((1 - y / rect.height) * 100);
    const l = hslState.l; // Preserve current Lightness

    const nextHsl = { h, s, l };
    setHslState(nextHsl);

    const rgb = hslToRgb(nextHsl);
    const hex = rgbToHex(rgb);
    setInput(hex);

    if (isSynced) {
      setSwatchSelectedHex(hex);
    }
  };

  const handleSvMouseDown = (e) => {
    e.preventDefault();
    updateSv(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent) => {
      updateSv(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Add final selected color to recents
      setHslState((curr) => {
        const rgb = hslToRgb(curr);
        addRecentColor(rgbToHex(rgb));
        return curr;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSvTouchStart = (e) => {
    updateSv(e.touches[0].clientX, e.touches[0].clientY);

    const handleTouchMove = (moveEvent) => {
      updateSv(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      setHslState((curr) => {
        const rgb = hslToRgb(curr);
        addRecentColor(rgbToHex(rgb));
        return curr;
      });
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Drag handlers for Lightness Slider
  const updateL = (clientX, clientY) => {
    if (!lRef.current) return;
    const rect = lRef.current.getBoundingClientRect();
    let y = clientY - rect.top;

    y = Math.max(0, Math.min(y, rect.height));

    const l = Math.round((1 - y / rect.height) * 100);
    const h = hslState.h;
    const s = hslState.s;

    const nextHsl = { h, s, l };
    setHslState(nextHsl);

    const rgb = hslToRgb(nextHsl);
    const hex = rgbToHex(rgb);
    setInput(hex);

    if (isSynced) {
      setSwatchSelectedHex(hex);
    }
  };

  const handleLMouseDown = (e) => {
    e.preventDefault();
    updateL(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent) => {
      updateL(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setHslState((curr) => {
        const rgb = hslToRgb(curr);
        addRecentColor(rgbToHex(rgb));
        return curr;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleLTouchStart = (e) => {
    updateL(e.touches[0].clientX, e.touches[0].clientY);

    const handleTouchMove = (moveEvent) => {
      updateL(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      setHslState((curr) => {
        const rgb = hslToRgb(curr);
        addRecentColor(rgbToHex(rgb));
        return curr;
      });
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

    // Handle manual input confirm to add to recent list
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const trimmedVal = input.trim();
      const parsedHsl = parseHslColor(trimmedVal);
      const parsedHsb = parseHsbColor(trimmedVal);
      const parsedCmyk = parseCmykColor(trimmedVal);
      const parsedLab = parseLabColor(trimmedVal);

      const rgb =
        parseHexColor(trimmedVal) ||
        parseRgbColor(trimmedVal) ||
        (parsedHsl ? hslToRgb(parsedHsl) : null) ||
        (parsedHsb ? hsbToRgb(parsedHsb) : null) ||
        (parsedCmyk ? cmykToRgb(parsedCmyk) : null) ||
        (parsedLab ? labToRgb(parsedLab) : null);

      if (rgb) {
        addRecentColor(rgbToHex(rgb));
      }
    }
  };

  const handleInputBlur = () => {
    const trimmedVal = input.trim();
    const parsedHsl = parseHslColor(trimmedVal);
    const parsedHsb = parseHsbColor(trimmedVal);
    const parsedCmyk = parseCmykColor(trimmedVal);
    const parsedLab = parseLabColor(trimmedVal);

    const rgb =
      parseHexColor(trimmedVal) ||
      parseRgbColor(trimmedVal) ||
      (parsedHsl ? hslToRgb(parsedHsl) : null) ||
      (parsedHsb ? hsbToRgb(parsedHsb) : null) ||
      (parsedCmyk ? cmykToRgb(parsedCmyk) : null) ||
      (parsedLab ? labToRgb(parsedLab) : null);

    if (rgb) {
      addRecentColor(rgbToHex(rgb));
    }
  };

  // Swatch click helper (Updates Code Converter input and highlights cell)
  const handleSwatchClick = (hex) => {
    setInput(hex);
    setSwatchSelectedHex(hex);
    addRecentColor(hex);

    // Sync HSL Spectrum selector coordinates if sync is active
    if (isSynced) {
      const rgb = parseHexColor(hex);
      if (rgb) {
        setHslState(rgbToHsl(rgb));
      }
    }
  };

  // Preset customization controls
  const handleAddPreset = () => {
    if (swatchBg && swatchBg !== 'transparent') {
      const formatted = swatchBg.toUpperCase();
      if (presets.includes(formatted)) {
        alert(t('tool-color.ui.duplicateColor'));
        return;
      }
      const next = [...presets, formatted];
      setPresets(next);
      writeStoredPalette(PRESETS_STORAGE_KEY, next);
    }
  };

  const handleDeletePreset = (indexToDelete) => {
    const next = presets.filter((_, idx) => idx !== indexToDelete);
    setPresets(next);
    writeStoredPalette(PRESETS_STORAGE_KEY, next);
  };

  const handleResetPresets = () => {
    if (window.confirm("Are you sure you want to reset the Standard Palette to the default 12 colors?")) {
      setPresets(DEFAULT_PRESETS);
      try {
        localStorage.removeItem(PRESETS_STORAGE_KEY);
      } catch {
        // Storage may be unavailable; the default palette remains active.
      }
      clearLegacyPresetCookie();
    }
  };

  const handleExportPresets = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(presets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "custom_color_palette.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportPresets = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        if (isHexPalette(parsed)) {
          setPresets(parsed);
          writeStoredPalette(PRESETS_STORAGE_KEY, parsed);
        } else {
          alert(t('tool-color.ui.invalidPalette'));
        }
      } catch {
        alert(t('tool-color.ui.parseFailed'));
      }
    };
    fileReader.readAsText(file);
    e.target.value = "";
  };

  const handleSliderValueChange = (newRgb, formattedString) => {
    const hex = rgbToHex(newRgb);
    setHslState(rgbToHsl(newRgb));
    setInput(formattedString);
    if (isSynced) {
      setSwatchSelectedHex(hex);
    }
  };

  const renderSlider = (label, value, min, max, gradient, onChange) => {
    return (
      <div className="grid grid-cols-[76px_minmax(0,1fr)_36px] items-center gap-2 text-[0.78rem]" key={label}>
        <span className="truncate font-semibold text-text-muted">{label}</span>
        <input
          type="range"
          className="interactive-slider-input min-w-0"
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          aria-label={label}
          style={{
            '--track-background': gradient,
            '--thumb-color': `rgb(${activeRgb.r}, ${activeRgb.g}, ${activeRgb.b})`
          }}
        />
        <span className="text-right font-mono font-medium text-text-main">{value}</span>
      </div>
    );
  };

  const renderInteractiveSliders = () => {
    let sliders = [];
    if (sliderModel === 'HSB') {
      sliders.push(renderSlider(t('tool-color.ui.hue'), activeHsb.h, 0, 360,
        `linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)`,
        (e) => {
          const h = Number(e.target.value);
          const newHsb = { ...activeHsb, h };
          handleSliderValueChange(hsbToRgb(newHsb), formatHsb(newHsb));
        }));
      const s0Rgb = hsbToRgb({ h: activeHsb.h, s: 0, b: activeHsb.b });
      const s100Rgb = hsbToRgb({ h: activeHsb.h, s: 100, b: activeHsb.b });
      sliders.push(renderSlider(t('tool-color.ui.saturation'), activeHsb.s, 0, 100,
        `linear-gradient(to right, rgb(${s0Rgb.r}, ${s0Rgb.g}, ${s0Rgb.b}), rgb(${s100Rgb.r}, ${s100Rgb.g}, ${s100Rgb.b}))`,
        (e) => {
          const s = Number(e.target.value);
          const newHsb = { ...activeHsb, s };
          handleSliderValueChange(hsbToRgb(newHsb), formatHsb(newHsb));
        }));
      const b100Rgb = hsbToRgb({ h: activeHsb.h, s: activeHsb.s, b: 100 });
      sliders.push(renderSlider(t('tool-color.ui.brightness'), activeHsb.b, 0, 100,
        `linear-gradient(to right, #000000, rgb(${b100Rgb.r}, ${b100Rgb.g}, ${b100Rgb.b}))`,
        (e) => {
          const b = Number(e.target.value);
          const newHsb = { ...activeHsb, b };
          handleSliderValueChange(hsbToRgb(newHsb), formatHsb(newHsb));
        }));
    } else if (sliderModel === 'HSL') {
      sliders.push(renderSlider(t('tool-color.ui.hue'), hslState.h, 0, 360,
        `linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)`,
        (e) => {
          const h = Number(e.target.value);
          const newHsl = { ...hslState, h };
          handleSliderValueChange(hslToRgb(newHsl), formatHsl(newHsl));
        }));
      const s0Rgb = hslToRgb({ h: hslState.h, s: 0, l: hslState.l });
      const s100Rgb = hslToRgb({ h: hslState.h, s: 100, l: hslState.l });
      sliders.push(renderSlider(t('tool-color.ui.saturation'), hslState.s, 0, 100,
        `linear-gradient(to right, rgb(${s0Rgb.r}, ${s0Rgb.g}, ${s0Rgb.b}), rgb(${s100Rgb.r}, ${s100Rgb.g}, ${s100Rgb.b}))`,
        (e) => {
          const s = Number(e.target.value);
          const newHsl = { ...hslState, s };
          handleSliderValueChange(hslToRgb(newHsl), formatHsl(newHsl));
        }));
      const l50Rgb = hslToRgb({ h: hslState.h, s: hslState.s, l: 50 });
      sliders.push(renderSlider(t('tool-color.ui.luminance'), hslState.l, 0, 100,
        `linear-gradient(to right, #000000, rgb(${l50Rgb.r}, ${l50Rgb.g}, ${l50Rgb.b}) 50%, #ffffff)`,
        (e) => {
          const l = Number(e.target.value);
          const newHsl = { ...hslState, l };
          handleSliderValueChange(hslToRgb(newHsl), formatHsl(newHsl));
        }));
    } else if (sliderModel === 'RGB') {
      sliders.push(renderSlider(t('tool-color.ui.red'), activeRgb.r, 0, 255,
        `linear-gradient(to right, rgb(0, ${activeRgb.g}, ${activeRgb.b}), rgb(255, ${activeRgb.g}, ${activeRgb.b}))`,
        (e) => {
          const r = Number(e.target.value);
          const newRgb = { ...activeRgb, r };
          handleSliderValueChange(newRgb, formatRgb(newRgb));
        }));
      sliders.push(renderSlider(t('tool-color.ui.green'), activeRgb.g, 0, 255,
        `linear-gradient(to right, rgb(${activeRgb.r}, 0, ${activeRgb.b}), rgb(${activeRgb.r}, 255, ${activeRgb.b}))`,
        (e) => {
          const g = Number(e.target.value);
          const newRgb = { ...activeRgb, g };
          handleSliderValueChange(newRgb, formatRgb(newRgb));
        }));
      sliders.push(renderSlider(t('tool-color.ui.blue'), activeRgb.b, 0, 255,
        `linear-gradient(to right, rgb(${activeRgb.r}, ${activeRgb.g}, 0), rgb(${activeRgb.r}, ${activeRgb.g}, 255))`,
        (e) => {
          const b = Number(e.target.value);
          const newRgb = { ...activeRgb, b };
          handleSliderValueChange(newRgb, formatRgb(newRgb));
        }));
    } else if (sliderModel === 'CMYK') {
      sliders.push(renderSlider(t('tool-color.ui.cyan'), activeCmyk.c, 0, 100,
        `linear-gradient(to right, rgb(${cmykToRgb({ ...activeCmyk, c: 0 }).r}, ${cmykToRgb({ ...activeCmyk, c: 0 }).g}, ${cmykToRgb({ ...activeCmyk, c: 0 }).b}), rgb(${cmykToRgb({ ...activeCmyk, c: 100 }).r}, ${cmykToRgb({ ...activeCmyk, c: 100 }).g}, ${cmykToRgb({ ...activeCmyk, c: 100 }).b}))`,
        (e) => {
          const c = Number(e.target.value);
          const newCmyk = { ...activeCmyk, c };
          handleSliderValueChange(cmykToRgb(newCmyk), formatCmyk(newCmyk));
        }));
      sliders.push(renderSlider(t('tool-color.ui.magenta'), activeCmyk.m, 0, 100,
        `linear-gradient(to right, rgb(${cmykToRgb({ ...activeCmyk, m: 0 }).r}, ${cmykToRgb({ ...activeCmyk, m: 0 }).g}, ${cmykToRgb({ ...activeCmyk, m: 0 }).b}), rgb(${cmykToRgb({ ...activeCmyk, m: 100 }).r}, ${cmykToRgb({ ...activeCmyk, m: 100 }).g}, ${cmykToRgb({ ...activeCmyk, m: 100 }).b}))`,
        (e) => {
          const m = Number(e.target.value);
          const newCmyk = { ...activeCmyk, m };
          handleSliderValueChange(cmykToRgb(newCmyk), formatCmyk(newCmyk));
        }));
      sliders.push(renderSlider(t('tool-color.ui.yellow'), activeCmyk.y, 0, 100,
        `linear-gradient(to right, rgb(${cmykToRgb({ ...activeCmyk, y: 0 }).r}, ${cmykToRgb({ ...activeCmyk, y: 0 }).g}, ${cmykToRgb({ ...activeCmyk, y: 0 }).b}), rgb(${cmykToRgb({ ...activeCmyk, y: 100 }).r}, ${cmykToRgb({ ...activeCmyk, y: 100 }).g}, ${cmykToRgb({ ...activeCmyk, y: 100 }).b}))`,
        (e) => {
          const y = Number(e.target.value);
          const newCmyk = { ...activeCmyk, y };
          handleSliderValueChange(cmykToRgb(newCmyk), formatCmyk(newCmyk));
        }));
      sliders.push(renderSlider(t('tool-color.ui.key'), activeCmyk.k, 0, 100,
        `linear-gradient(to right, rgb(${cmykToRgb({ ...activeCmyk, k: 0 }).r}, ${cmykToRgb({ ...activeCmyk, k: 0 }).g}, ${cmykToRgb({ ...activeCmyk, k: 0 }).b}), rgb(${cmykToRgb({ ...activeCmyk, k: 100 }).r}, ${cmykToRgb({ ...activeCmyk, k: 100 }).g}, ${cmykToRgb({ ...activeCmyk, k: 100 }).b}))`,
        (e) => {
          const k = Number(e.target.value);
          const newCmyk = { ...activeCmyk, k };
          handleSliderValueChange(cmykToRgb(newCmyk), formatCmyk(newCmyk));
        }));
    } else if (sliderModel === 'LAB') {
      sliders.push(renderSlider(t('tool-color.ui.luminance'), activeLab.l, 0, 100,
        `linear-gradient(to right, rgb(${labToRgb({ ...activeLab, l: 0 }).r}, ${labToRgb({ ...activeLab, l: 0 }).g}, ${labToRgb({ ...activeLab, l: 0 }).b}), rgb(${labToRgb({ ...activeLab, l: 100 }).r}, ${labToRgb({ ...activeLab, l: 100 }).g}, ${labToRgb({ ...activeLab, l: 100 }).b}))`,
        (e) => {
          const l = Number(e.target.value);
          const newLab = { ...activeLab, l };
          handleSliderValueChange(labToRgb(newLab), formatLab(newLab));
        }));
      sliders.push(renderSlider(t('tool-color.ui.greenRed'), activeLab.a, -128, 127,
        `linear-gradient(to right, rgb(${labToRgb({ ...activeLab, a: -128 }).r}, ${labToRgb({ ...activeLab, a: -128 }).g}, ${labToRgb({ ...activeLab, a: -128 }).b}), rgb(${labToRgb({ ...activeLab, a: 127 }).r}, ${labToRgb({ ...activeLab, a: 127 }).g}, ${labToRgb({ ...activeLab, a: 127 }).b}))`,
        (e) => {
          const a = Number(e.target.value);
          const newLab = { ...activeLab, a };
          handleSliderValueChange(labToRgb(newLab), formatLab(newLab));
        }));
      sliders.push(renderSlider(t('tool-color.ui.blueYellow'), activeLab.b, -128, 127,
        `linear-gradient(to right, rgb(${labToRgb({ ...activeLab, b: -128 }).r}, ${labToRgb({ ...activeLab, b: -128 }).g}, ${labToRgb({ ...activeLab, b: -128 }).b}), rgb(${labToRgb({ ...activeLab, b: 127 }).r}, ${labToRgb({ ...activeLab, b: 127 }).g}, ${labToRgb({ ...activeLab, b: 127 }).b}))`,
        (e) => {
          const b = Number(e.target.value);
          const newLab = { ...activeLab, b };
          handleSliderValueChange(labToRgb(newLab), formatLab(newLab));
        }));
    }

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-2">
          {sliders}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <div className="relative">
            <select
              aria-label={t('tool-color.ui.sliderModelAria')}
              value={sliderModel}
              onChange={(e) => setSliderModel(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-app border border-border text-text-main font-sans text-sm cursor-pointer outline-none hover:bg-border-hover"
            >
              <option value="HSB">HSB</option>
              <option value="HSL">HSL</option>
              <option value="RGB">RGB</option>
              <option value="CMYK">CMYK</option>
              <option value="LAB">LAB</option>
            </select>
          </div>
          <div className="flex gap-2">
            {hasEyeDropper && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleEyeDropper}
                title={t('tool-color.ui.pickScreen')}
                className="p-1.5"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 22l6-6M8 16l4 4M19.5 4.5a3.53 3.53 0 0 1 0 5L12 17l-5-5 7.5-7.5a3.53 3.53 0 0 1 5 0z"></path>
                </svg>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                let copyStr = '';
                if (sliderModel === 'HSB') copyStr = formatHsb(activeHsb);
                else if (sliderModel === 'HSL') copyStr = formatHsl(hslState);
                else if (sliderModel === 'RGB') copyStr = formatRgb(activeRgb);
                else if (sliderModel === 'CMYK') copyStr = formatCmyk(activeCmyk);
                else if (sliderModel === 'LAB') copyStr = formatLab(activeLab);
                navigator.clipboard.writeText(copyStr);
              }}
              title={t('tool-color.ui.copyCode')}
              className="p-1.5"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card id="tool-color" variant="tool" size="wide">
      <ToolHeader 
        title={t('tool-color.ui.title')}
      />
      
      <div className="grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Panel 1: Code Converter Inputs/Outputs */}
        <div className="flex w-full flex-col gap-2.5">
          <h3 className="border-b border-border pb-2 text-[0.95rem] uppercase tracking-wider text-text-muted">{t('tool-color.ui.converter')}</h3>
          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="color-input" className="text-xs font-semibold text-text-main">{t('tool-color.ui.codeLabel')}</label>
            <div className="flex gap-2 w-full">
              <input
                id="color-input"
                type="text"
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-text-main outline-none transition-all placeholder:text-text-muted/50 focus:border-accent focus:ring-4 focus:ring-accent-light/20"
                placeholder="#4F46E5 or rgb(79, 70, 229) or hsl(244, 76%, 59%)"
                value={input}
                onChange={handleUserTextChange}
                onKeyDown={handleInputKeyDown}
                onBlur={handleInputBlur}
              />
              {hasEyeDropper && (
                <Button
                  type="button"
                  variant="secondary"
                  title={t('tool-color.ui.pickScreen')}
                  onClick={handleEyeDropper}
                  className="h-10 w-10 p-0"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 22l6-6M8 16l4 4M19.5 4.5a3.53 3.53 0 0 1 0 5L12 17l-5-5 7.5-7.5a3.53 3.53 0 0 1 5 0z"></path>
                  </svg>
                </Button>
              )}
            </div>
          </div>
          
          <div
            className="h-9 w-full rounded-lg border border-border shadow-inner"
            id="color-preview-swatch"
            style={{ backgroundColor: swatchBg }}
          />
          
          <div className="flex w-full gap-3">
            <div className="flex-1">
              <FieldInput id="color-hex" label="HEX" type="text" readOnly value={hexVal} />
            </div>
            <div className="flex-1">
              <FieldInput 
                id="color-selected-format" 
                label={sliderModel}
                type="text" 
                readOnly 
                value={
                  sliderModel === 'HSB' ? hsbVal :
                  sliderModel === 'HSL' ? hslVal :
                  sliderModel === 'RGB' ? rgbVal :
                  sliderModel === 'CMYK' ? cmykVal :
                  sliderModel === 'LAB' ? labVal : ''
                } 
              />
            </div>
          </div>
          
          {statusText && <p className="text-xs font-medium text-red-500" id="color-status">{statusText}</p>}

          <div>
            {renderInteractiveSliders()}
          </div>
        </div>

        {/* Panel 2: Visual Swatches Grid Selector */}
        <div className="flex flex-col gap-3 w-full">
          <div className="flex justify-between items-center w-full pb-2 border-b border-border">
            <h3 className="text-[0.95rem] text-text-muted uppercase tracking-wider">{t('tool-color.ui.hslSwatches')}</h3>
            <button
              type="button"
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-extrabold tracking-wide shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                isSynced
                  ? 'border-accent bg-accent text-white shadow-[0_3px_12px_var(--accent-light)] hover:bg-accent-hover'
                  : 'border-amber-500 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
              }`}
              onClick={handleSyncToggle}
              title={isSynced ? t('tool-color.ui.disconnectSync') : t('tool-color.ui.connectSync')}
              aria-pressed={isSynced}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full border-2 ${
                  isSynced ? 'border-white bg-white' : 'border-amber-500 bg-transparent'
                }`}
              />
              {isSynced ? t('tool-color.ui.syncOn') : t('tool-color.ui.syncOff')}
            </button>
          </div>
          
          <div className="grid grid-cols-12 gap-0.5 w-full rounded-lg border border-border bg-app p-1">
            {SWATCH_GRID.map((row, rIdx) => 
              row.map((hex, cIdx) => {
                const isSelected = swatchSelectedHex.toUpperCase() === hex.toUpperCase();
                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    type="button"
                    className={`aspect-square w-full border-none cursor-pointer relative p-0 rounded-[2px] transition-transform duration-100 hover:scale-125 hover:z-[5] hover:shadow-[0_4px_10px_rgba(0,0,0,0.25)] hover:rounded ${isSelected ? 'outline-[2.5px] outline-solid outline-text-main -outline-offset-[2.5px] shadow-[0_0_0_1.5px_#ffffff,_0_3px_8px_rgba(0,0,0,0.3)] dark:shadow-[0_0_0_1.5px_#1f2937,_0_3px_8px_rgba(0,0,0,0.4)] z-10 rounded scale-110' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => handleSwatchClick(hex)}
                  />
                );
              })
            )}
          </div>

          {/* Standard Palette section */}
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex justify-between items-center w-full mb-0.5">
              <span className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-color.ui.standardPalettes')}</span>
              <div className="flex gap-1.5 items-center">
                {!isEditingPresets ? (
                  <button
                    type="button"
                    className="bg-card border border-border color-text-muted rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-border-hover hover:text-text-main"
                    onClick={() => setIsEditingPresets(true)}
                  >
                    {t('tool-color.ui.customize')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="bg-accent border border-accent text-white rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-accent-hover hover:border-accent-hover"
                      onClick={() => setIsEditingPresets(false)}
                    >
                      {t('tool-color.ui.done')}
                    </button>
                    <button
                      type="button"
                      className="bg-card border border-border text-[#ef4444] border-red-500/20 rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-red-500/5 hover:border-red-500"
                      onClick={handleResetPresets}
                      title={t('tool-color.ui.resetTitle')}
                    >
                      {t('tool-color.ui.reset')}
                    </button>
                    <button
                      type="button"
                      className="bg-card border border-border color-text-muted rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-border-hover hover:text-text-main"
                      onClick={handleExportPresets}
                      title={t('tool-color.ui.exportTitle')}
                    >
                      {t('tool-color.ui.export')}
                    </button>
                    <button
                      type="button"
                      className="bg-card border border-border color-text-muted rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-border-hover hover:text-text-main"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      title={t('tool-color.ui.importTitle')}
                    >
                      {t('tool-color.ui.import')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={handleImportPresets}
                    />
                  </>
                )}
              </div>
            </div>
            
            <div className={`flex flex-wrap gap-2 ${isEditingPresets ? 'gap-2.5' : ''}`}>
              {presets.map((hex, idx) => (
                <div key={`${hex}-${idx}`} className="relative inline-block">
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md border border-border cursor-pointer shadow-sm transition-transform duration-200 hover:scale-[1.15] hover:shadow-md hover:border-accent"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => !isEditingPresets && handleSwatchClick(hex)}
                  />
                  {isEditingPresets && (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full bg-[#ef4444] text-white border-none text-[10px] font-bold flex items-center justify-center cursor-pointer shadow-md transition-transform duration-150 hover:scale-120 hover:bg-[#dc2626]"
                      title={t('tool-color.ui.deleteColor')}
                      onClick={() => handleDeletePreset(idx)}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              {isEditingPresets && swatchBg && swatchBg !== 'transparent' && (
                <button
                  type="button"
                  className="w-6 h-6 rounded-md border-2 border-dashed border-border bg-transparent color-text-muted text-[0.95rem] font-semibold flex items-center justify-center cursor-pointer transition-all duration-200 hover:border-accent hover:color-accent hover:bg-accent-light hover:scale-108"
                  title={t('tool-color.ui.addCurrent', { color: swatchBg })}
                  onClick={handleAddPreset}
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panel 3: Visual HSL Spectrum Selector */}
        <div className="flex flex-col gap-3 w-full">
          <h3 className="text-[0.95rem] text-text-muted uppercase tracking-wider mb-1 pb-2 border-b border-border">{t('tool-color.ui.hslSpectrum')}</h3>
          
          <div className="flex gap-4 w-full items-stretch">
            {/* 2D Hue-Saturation board */}
            <div
              ref={svRef}
              className="relative flex-1 aspect-[6/5] rounded-xl border border-border overflow-hidden cursor-crosshair shadow-inner"
              onMouseDown={handleSvMouseDown}
              onTouchStart={handleSvTouchStart}
            >
              {/* Rainbow horizontal overlay + gray vertical overlay */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(128,128,128,0) 0%, rgba(128,128,128,1) 100%)' }} />
              
              {/* Slider marker indicator */}
              <div
                className="absolute w-[18px] h-[18px] rounded-full border-[2.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),_0_2px_6px_rgba(0,0,0,0.4)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${(hslState.h / 360) * 100}%`,
                  top: `${100 - hslState.s}%`,
                  backgroundColor: `hsl(${hslState.h}, ${hslState.s}%, ${hslState.l}%)`
                }}
              />
            </div>

            {/* Vertical Lightness slider */}
            <div className="flex flex-col items-center gap-1.5 self-stretch">
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-color.ui.lightness')}</span>
              <div
                ref={lRef}
                className="relative w-7 flex-1 rounded-full border border-border cursor-ns-resize shadow-inner"
                style={{
                  background: `linear-gradient(to top, #000 0%, hsl(${hslState.h}, ${hslState.s}%, 50%) 50%, #fff 100%)`
                }}
                onMouseDown={handleLMouseDown}
                onTouchStart={handleLTouchStart}
              >
                {/* Vertical slider handle indicator */}
                <div
                  className="absolute left-[-2px] right-[-2px] h-2 bg-white border-2 border-slate-700 rounded -translate-y-1/2 shadow-md pointer-events-none"
                  style={{
                    top: `${100 - hslState.l}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Recent Colors section */}
          {recentColors.length > 0 && (
            <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-dashed border-border">
              <div className="flex justify-between items-center w-full">
                <span className="text-[0.72rem] font-bold uppercase tracking-wider text-text-muted">{t('tool-color.ui.recentColors')}</span>
                <button
                  type="button"
                  className="bg-card border border-border text-[#ef4444] border-red-500/20 rounded-md text-[0.65rem] font-bold uppercase p-[4px_8px] cursor-pointer transition-colors duration-200 hover:bg-red-500/5 hover:border-red-500"
                  onClick={handleClearRecents}
                >
                  {t('tool-color.ui.clear')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentColors.map((hex, idx) => (
                  <button
                    key={`${hex}-${idx}`}
                    type="button"
                    className="w-6 h-6 rounded-md border border-border cursor-pointer shadow-sm transition-transform duration-200 hover:scale-[1.15] hover:shadow-md hover:border-accent"
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => handleSwatchClick(hex)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </Card>
  );
}
