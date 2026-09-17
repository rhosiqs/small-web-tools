import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import Card from './ui/Card';
import Button from './ui/Button';
import FullscreenPreview, {
  FullscreenPreviewButton,
  TRANSPARENT_PREVIEW_CLASS,
} from './ui/FullscreenPreview';
import ToolHeader from './ui/ToolHeader';
import FieldInput from './ui/FieldInput';
import ToggleSwitch from './ui/ToggleSwitch';
import {
  escapeWifiString,
  estimateTextWidth,
  validateBarcode,
} from './QrBarcodeGenerator/lib/encoding';

// Custom canvas rendering for QR Code
const renderCustomQR = (canvas, text, options) => {
  const {
    size = 400,
    margin = 4,
    errorCorrectionLevel = 'H',
    dotsStyle = 'square', // 'square' | 'circle'
    eyesStyle = 'square',  // 'square' | 'rounded' | 'circle'
    fgType = 'solid',      // 'solid' | 'gradient'
    fgColor = '#111827',
    fgGradient = { type: 'linear', color1: '#4338ca', color2: '#06b6d4', angle: 45 },
    bgColor = '#ffffff',
    logoImg = null,
    logoScale = 0.18,
    logoBgShape = 'circle',
    
    // Custom text overlay options
    textLabel = '',
    textLabelMode = 'none',
    labelPosition = 'bottom',
    embeddedPosition = 'center',
    textXOffset = 0,
    textYOffset = 0,
    textSize = 24,
    textColor = '#111827',
    textFont = 'sans-serif',
    textWeight = 'bold',
    textStyle = 'normal',
    textBgEnabled = false,
    textBgColor = '#ffffff',
    textBgPadding = 6,
    textStrokeEnabled = false,
    textStrokeColor = '#ffffff',
    textStrokeWidth = 3,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let qr;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel });
  } catch (err) {
    console.error(err);
    throw err;
  }

  const { modules } = qr;
  const numModules = modules.size;
  const totalModules = numModules + margin * 2;
  const moduleSize = size / totalModules;

  // Calculate layout offsets for external label
  const hasLabel = (textLabelMode === 'label' || textLabelMode === 'both') && textLabel;
  const labelHeight = hasLabel ? (textSize + moduleSize * 0.5) : 0;
  const totalHeight = size + labelHeight;
  const qrYOffset = (hasLabel && labelPosition === 'top') ? labelHeight : 0;

  // Calculate label Y coordinate
  let labelY = 0;
  if (hasLabel) {
    if (labelPosition === 'top') {
      labelY = margin * moduleSize + textSize / 2;
    } else {
      labelY = (margin + numModules) * moduleSize + moduleSize * 0.5 + textSize / 2;
    }
  }

  canvas.width = size;
  canvas.height = totalHeight;

  ctx.clearRect(0, 0, size, totalHeight);
  if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, totalHeight);
  }

  const applyFgStyle = () => {
    if (fgType === 'gradient') {
      let grad;
      if (fgGradient.type === 'linear') {
        const angleRad = (fgGradient.angle * Math.PI) / 180;
        const x1 = size / 2 - (Math.cos(angleRad) * size) / 2;
        const y1 = (size / 2 + qrYOffset) - (Math.sin(angleRad) * size) / 2;
        const x2 = size / 2 + (Math.cos(angleRad) * size) / 2;
        const y2 = (size / 2 + qrYOffset) + (Math.sin(angleRad) * size) / 2;
        grad = ctx.createLinearGradient(x1, y1, x2, y2);
      } else {
        grad = ctx.createRadialGradient(size / 2, size / 2 + qrYOffset, size * 0.05, size / 2, size / 2 + qrYOffset, size * 0.7);
      }
      grad.addColorStop(0, fgGradient.color1);
      grad.addColorStop(1, fgGradient.color2);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = fgColor;
    }
  };

  applyFgStyle();

  const isEye = (r, c) => {
    if (r >= 0 && r < 7 && c >= 0 && c < 7) return 'tl';
    if (r >= 0 && r < 7 && c >= numModules - 7 && c < numModules) return 'tr';
    if (r >= numModules - 7 && r < numModules && c >= 0 && c < 7) return 'bl';
    return null;
  };

  const logoModules = logoImg ? numModules * logoScale : 0;
  const logoStart = (numModules - logoModules) / 2;
  const logoEnd = logoStart + logoModules;
  const isInsideLogoArea = (r, c) => {
    if (!logoImg) return false;
    const pad = 0.5; // padding in module counts
    return r >= logoStart - pad && r < logoEnd + pad && c >= logoStart - pad && c < logoEnd + pad;
  };

  // Calculate text bounding box for clearing modules behind embedded text
  const hasEmbed = (textLabelMode === 'embedded' || textLabelMode === 'both') && textLabel;
  let textMinX = 0, textMaxX = 0, textMinY = 0, textMaxY = 0;
  if (hasEmbed) {
    ctx.save();
    ctx.font = `${textStyle} ${textWeight} ${textSize}px ${textFont}`;
    const textWidth = ctx.measureText(textLabel).width;
    ctx.restore();

    let embedX = size / 2;
    let embedY = size / 2; // relative to QR square (without qrYOffset)

    if (embeddedPosition === 'top') {
      embedY = size * 0.25;
    } else if (embeddedPosition === 'bottom') {
      embedY = size * 0.75;
    } else if (embeddedPosition === 'custom') {
      embedX = size / 2 + (textXOffset / 100) * size;
      embedY = size / 2 + (textYOffset / 100) * size;
    }

    const padX = textBgPadding + moduleSize * 0.3;
    const padY = textBgPadding + moduleSize * 0.3;
    const textHeight = textSize;

    textMinX = embedX - textWidth / 2 - padX;
    textMaxX = embedX + textWidth / 2 + padX;
    textMinY = embedY - textHeight / 2 - padY;
    textMaxY = embedY + textHeight / 2 + padY;
  }

  const isInsideTextArea = (r, c) => {
    if (!hasEmbed) return false;
    const modX = (margin + c) * moduleSize;
    const modY = (margin + r) * moduleSize;
    return (modX + moduleSize >= textMinX && modX <= textMaxX && modY + moduleSize >= textMinY && modY <= textMaxY);
  };

  // Draw Dots
  for (let r = 0; r < numModules; r++) {
    for (let c = 0; c < numModules; c++) {
      if (modules.data[r * numModules + c] === 0) continue;
      if (isEye(r, c)) continue;
      if (isInsideLogoArea(r, c)) continue;
      if (isInsideTextArea(r, c)) continue;

      const x = (margin + c) * moduleSize;
      const y = (margin + r) * moduleSize + qrYOffset;

      ctx.beginPath();
      if (dotsStyle === 'circle') {
        const cx = x + moduleSize / 2;
        const cy = y + moduleSize / 2;
        const radius = (moduleSize / 2) * 0.85;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, moduleSize, moduleSize);
      }
    }
  }

  // Draw Position Eyes
  const drawEye = (startX, startY) => {
    const frameSize = 7 * moduleSize;
    const innerFrameSize = 5 * moduleSize;
    const centerBlockSize = 3 * moduleSize;

    if (eyesStyle === 'circle') {
      const cx = startX + frameSize / 2;
      const cy = startY + frameSize / 2;

      applyFgStyle();
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5 * moduleSize, 0, Math.PI * 2);
      ctx.fill();

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
      } else {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 * moduleSize, 0, Math.PI * 2);
      ctx.fill();

      if (bgColor === 'transparent') {
        ctx.globalCompositeOperation = 'source-over';
      }
      applyFgStyle();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5 * moduleSize, 0, Math.PI * 2);
      ctx.fill();

    } else if (eyesStyle === 'rounded') {
      const drawRounded = (rx, ry, w, h, radius) => {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, w, h, radius);
        } else {
          ctx.rect(rx, ry, w, h);
        }
        ctx.fill();
      };

      const radOuter = 1.6 * moduleSize;
      const radInner = 0.8 * moduleSize;
      const radCenter = 0.5 * moduleSize;

      applyFgStyle();
      drawRounded(startX, startY, frameSize, frameSize, radOuter);

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
      } else {
        ctx.globalCompositeOperation = 'destination-out';
      }
      drawRounded(startX + moduleSize, startY + moduleSize, innerFrameSize, innerFrameSize, radInner);

      if (bgColor === 'transparent') {
        ctx.globalCompositeOperation = 'source-over';
      }
      applyFgStyle();
      drawRounded(startX + 2 * moduleSize, startY + 2 * moduleSize, centerBlockSize, centerBlockSize, radCenter);

    } else {
      // Classic Square
      applyFgStyle();
      ctx.fillRect(startX, startY, frameSize, frameSize);

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
      } else {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.fillRect(startX + moduleSize, startY + moduleSize, innerFrameSize, innerFrameSize);

      if (bgColor === 'transparent') {
        ctx.globalCompositeOperation = 'source-over';
      }
      applyFgStyle();
      ctx.fillRect(startX + 2 * moduleSize, startY + 2 * moduleSize, centerBlockSize, centerBlockSize);
    }
  };

  // Render the three corner eyes
  drawEye(margin * moduleSize, margin * moduleSize + qrYOffset);
  drawEye((margin + numModules - 7) * moduleSize, margin * moduleSize + qrYOffset);
  drawEye(margin * moduleSize, (margin + numModules - 7) * moduleSize + qrYOffset);

  // Draw Logo
  if (logoImg) {
    const centerPx = size / 2;
    const logoPx = size * logoScale;
    const logoX = centerPx - logoPx / 2;
    const logoY = centerPx - logoPx / 2 + qrYOffset;
    const padding = moduleSize * 0.5;

    if (logoBgShape !== 'none') {
      ctx.fillStyle = bgColor === 'transparent' ? '#ffffff' : bgColor;
      ctx.beginPath();
      if (logoBgShape === 'circle') {
        ctx.arc(centerPx, centerPx + qrYOffset, logoPx / 2 + padding, 0, Math.PI * 2);
        ctx.fill();
      } else if (logoBgShape === 'square') {
        ctx.fillRect(logoX - padding, logoY - padding, logoPx + padding * 2, logoPx + padding * 2);
      }
    }

    ctx.save();
    ctx.beginPath();
    const clipRadius = logoPx * 0.2;
    if (ctx.roundRect) {
      ctx.roundRect(logoX, logoY, logoPx, logoPx, clipRadius);
    } else {
      ctx.rect(logoX, logoY, logoPx, logoPx);
    }
    ctx.clip();

    ctx.drawImage(logoImg, logoX, logoY, logoPx, logoPx);
    ctx.restore();
  }

  // Draw External Label
  if (hasLabel) {
    ctx.save();
    ctx.font = `${textStyle} ${textWeight} ${textSize}px ${textFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelX = size / 2;
    // labelY is precalculated at the top

    if (textBgEnabled) {
      const textWidth = ctx.measureText(textLabel).width;
      const bgW = textWidth + textBgPadding * 2;
      const bgH = textSize + textBgPadding * 2;
      const bgX = labelX - bgW / 2;
      const bgY = labelY - bgH / 2;
      ctx.fillStyle = textBgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bgX, bgY, bgW, bgH, 4);
      } else {
        ctx.rect(bgX, bgY, bgW, bgH);
      }
      ctx.fill();
    }

    if (textStrokeEnabled) {
      ctx.strokeStyle = textStrokeColor;
      ctx.lineWidth = textStrokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(textLabel, labelX, labelY);
    }

    ctx.fillStyle = textColor;
    ctx.fillText(textLabel, labelX, labelY);
    ctx.restore();
  }

  // Draw Embedded Text
  if (hasEmbed) {
    ctx.save();
    ctx.font = `${textStyle} ${textWeight} ${textSize}px ${textFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let embedX = size / 2;
    let embedY = size / 2 + qrYOffset;

    if (embeddedPosition === 'top') {
      embedY = size * 0.25 + qrYOffset;
    } else if (embeddedPosition === 'bottom') {
      embedY = size * 0.75 + qrYOffset;
    } else if (embeddedPosition === 'custom') {
      embedX = size / 2 + (textXOffset / 100) * size;
      embedY = size / 2 + (textYOffset / 100) * size + qrYOffset;
    }

    if (textBgEnabled) {
      const textWidth = ctx.measureText(textLabel).width;
      const bgW = textWidth + textBgPadding * 2;
      const bgH = textSize + textBgPadding * 2;
      const bgX = embedX - bgW / 2;
      const bgY = embedY - bgH / 2;
      ctx.fillStyle = textBgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bgX, bgY, bgW, bgH, 4);
      } else {
        ctx.rect(bgX, bgY, bgW, bgH);
      }
      ctx.fill();
    }

    if (textStrokeEnabled) {
      ctx.strokeStyle = textStrokeColor;
      ctx.lineWidth = textStrokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(textLabel, embedX, embedY);
    }

    ctx.fillStyle = textColor;
    ctx.fillText(textLabel, embedX, embedY);
    ctx.restore();
  }
};

// SVG Generator String for QR Code
const generateQRSVG = (text, options) => {
  const {
    margin = 4,
    errorCorrectionLevel = 'H',
    dotsStyle = 'square',
    eyesStyle = 'square',
    fgType = 'solid',
    fgColor = '#111827',
    fgGradient = { type: 'linear', color1: '#4338ca', color2: '#06b6d4', angle: 45 },
    bgColor = '#ffffff',
    logoImgData = null, // base64
    logoScale = 0.18,
    logoBgShape = 'circle',
    
    // Custom text overlay options
    textLabel = '',
    textLabelMode = 'none',
    labelPosition = 'bottom',
    embeddedPosition = 'center',
    textXOffset = 0,
    textYOffset = 0,
    textSize = 24,
    textColor = '#111827',
    textFont = 'sans-serif',
    textWeight = 'bold',
    textStyle = 'normal',
    textBgEnabled = false,
    textBgColor = '#ffffff',
    textBgPadding = 6,
    textStrokeEnabled = false,
    textStrokeColor = '#ffffff',
    textStrokeWidth = 3,
  } = options;

  let qr;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel });
  } catch {
    return '';
  }

  const { modules } = qr;
  const numModules = modules.size;
  const totalModules = numModules + margin * 2;
  const size = 500;
  const moduleSize = size / totalModules;

  // Calculate layout offsets for external label
  const hasLabel = (textLabelMode === 'label' || textLabelMode === 'both') && textLabel;
  const labelHeight = hasLabel ? (textSize + moduleSize * 0.5) : 0;
  const totalHeight = size + labelHeight;
  const qrYOffset = (hasLabel && labelPosition === 'top') ? labelHeight : 0;

  // Calculate label Y coordinate
  let labelY = 0;
  if (hasLabel) {
    if (labelPosition === 'top') {
      labelY = margin * moduleSize + textSize / 2;
    } else {
      labelY = (margin + numModules) * moduleSize + moduleSize * 0.5 + textSize / 2;
    }
  }

  let svgContent = '';

  if (bgColor !== 'transparent') {
    svgContent += `<rect width="${size}" height="${totalHeight}" fill="${bgColor}" />\n`;
  }

  let fillAttr = fgColor;
  let defsContent = '';
  if (fgType === 'gradient') {
    fillAttr = 'url(#qr-gradient)';
    if (fgGradient.type === 'linear') {
      const angleRad = (fgGradient.angle * Math.PI) / 180;
      const x1 = Math.round(50 - Math.cos(angleRad) * 50);
      const y1 = Math.round(50 - Math.sin(angleRad) * 50);
      const x2 = Math.round(50 + Math.cos(angleRad) * 50);
      const y2 = Math.round(50 + Math.sin(angleRad) * 50);
      defsContent += `  <linearGradient id="qr-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">\n`;
    } else {
      defsContent += `  <radialGradient id="qr-gradient" cx="50%" cy="50%" r="70%">\n`;
    }
    defsContent += `    <stop offset="0%" stop-color="${fgGradient.color1}" />\n`;
    defsContent += `    <stop offset="100%" stop-color="${fgGradient.color2}" />\n`;
    defsContent += fgGradient.type === 'linear' ? `  </linearGradient>\n` : `  </radialGradient>\n`;
  }

  if (defsContent) {
    svgContent += `<defs>\n${defsContent}</defs>\n`;
  }

  const isEye = (r, c) => {
    if (r >= 0 && r < 7 && c >= 0 && c < 7) return 'tl';
    if (r >= 0 && r < 7 && c >= numModules - 7 && c < numModules) return 'tr';
    if (r >= numModules - 7 && r < numModules && c >= 0 && c < 7) return 'bl';
    return null;
  };

  const logoModules = logoImgData ? numModules * logoScale : 0;
  const logoStart = (numModules - logoModules) / 2;
  const logoEnd = logoStart + logoModules;
  const isInsideLogoArea = (r, c) => {
    if (!logoImgData) return false;
    const pad = 0.5;
    return r >= logoStart - pad && r < logoEnd + pad && c >= logoStart - pad && c < logoEnd + pad;
  };

  // Calculate text bounding box for clearing modules behind embedded text
  const hasEmbed = (textLabelMode === 'embedded' || textLabelMode === 'both') && textLabel;
  let textMinX = 0, textMaxX = 0, textMinY = 0, textMaxY = 0;
  if (hasEmbed) {
    const textWidth = estimateTextWidth(textLabel, textSize, textWeight);
    let embedX = size / 2;
    let embedY = size / 2; // relative to QR square (without qrYOffset)

    if (embeddedPosition === 'top') {
      embedY = size * 0.25;
    } else if (embeddedPosition === 'bottom') {
      embedY = size * 0.75;
    } else if (embeddedPosition === 'custom') {
      embedX = size / 2 + (textXOffset / 100) * size;
      embedY = size / 2 + (textYOffset / 100) * size;
    }

    const padX = textBgPadding + moduleSize * 0.3;
    const padY = textBgPadding + moduleSize * 0.3;
    const textHeight = textSize;

    textMinX = embedX - textWidth / 2 - padX;
    textMaxX = embedX + textWidth / 2 + padX;
    textMinY = embedY - textHeight / 2 - padY;
    textMaxY = embedY + textHeight / 2 + padY;
  }

  const isInsideTextArea = (r, c) => {
    if (!hasEmbed) return false;
    const modX = (margin + c) * moduleSize;
    const modY = (margin + r) * moduleSize;
    return (modX + moduleSize >= textMinX && modX <= textMaxX && modY + moduleSize >= textMinY && modY <= textMaxY);
  };

  // Draw Dots
  let pathD = '';
  for (let r = 0; r < numModules; r++) {
    for (let c = 0; c < numModules; c++) {
      if (modules.data[r * numModules + c] === 0) continue;
      if (isEye(r, c)) continue;
      if (isInsideLogoArea(r, c)) continue;
      if (isInsideTextArea(r, c)) continue;

      const x = (margin + c) * moduleSize;
      const y = (margin + r) * moduleSize + qrYOffset;

      if (dotsStyle === 'circle') {
        const cx = x + moduleSize / 2;
        const cy = y + moduleSize / 2;
        const radius = (moduleSize / 2) * 0.85;
        pathD += `M ${cx} ${cy} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0 `;
      } else {
        pathD += `M ${x} ${y} h ${moduleSize} v ${moduleSize} h -${moduleSize} Z `;
      }
    }
  }

  if (pathD) {
    svgContent += `<path d="${pathD}" fill="${fillAttr}" />\n`;
  }

  // Draw Position Eyes
  const drawEyeSVG = (startX, startY) => {
    const frameSize = 7 * moduleSize;
    const innerFrameSize = 5 * moduleSize;
    const centerBlockSize = 3 * moduleSize;

    if (eyesStyle === 'circle') {
      const cx = startX + frameSize / 2;
      const cy = startY + frameSize / 2;
      const rOuter = 3.5 * moduleSize;
      const rInner = 2.5 * moduleSize;
      const rCenter = 1.5 * moduleSize;

      const eyePath = `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter} Z ` +
                      `M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner} Z ` +
                      `M ${cx} ${cy - rCenter} A ${rCenter} ${rCenter} 0 1 1 ${cx} ${cy + rCenter} A ${rCenter} ${rCenter} 0 1 1 ${cx} ${cy - rCenter} Z`;

      svgContent += `<path d="${eyePath}" fill="${fillAttr}" fill-rule="evenodd" />\n`;
    } else if (eyesStyle === 'rounded') {
      const radOuter = 1.6 * moduleSize;
      const radInner = 0.8 * moduleSize;
      const radCenter = 0.5 * moduleSize;

      svgContent += `<rect x="${startX}" y="${startY}" width="${frameSize}" height="${frameSize}" rx="${radOuter}" ry="${radOuter}" fill="${fillAttr}" />\n`;
      const innerBgColor = bgColor === 'transparent' ? '#ffffff' : bgColor;
      svgContent += `<rect x="${startX + moduleSize}" y="${startY + moduleSize}" width="${innerFrameSize}" height="${innerFrameSize}" rx="${radInner}" ry="${radInner}" fill="${innerBgColor}" />\n`;
      svgContent += `<rect x="${startX + 2 * moduleSize}" y="${startY + 2 * moduleSize}" width="${centerBlockSize}" height="${centerBlockSize}" rx="${radCenter}" ry="${radCenter}" fill="${fillAttr}" />\n`;
    } else {
      svgContent += `<rect x="${startX}" y="${startY}" width="${frameSize}" height="${frameSize}" fill="${fillAttr}" />\n`;
      const innerBgColor = bgColor === 'transparent' ? '#ffffff' : bgColor;
      svgContent += `<rect x="${startX + moduleSize}" y="${startY + moduleSize}" width="${innerFrameSize}" height="${innerFrameSize}" fill="${innerBgColor}" />\n`;
      svgContent += `<rect x="${startX + 2 * moduleSize}" y="${startY + 2 * moduleSize}" width="${centerBlockSize}" height="${centerBlockSize}" fill="${fillAttr}" />\n`;
    }
  };

  drawEyeSVG(margin * moduleSize, margin * moduleSize + qrYOffset);
  drawEyeSVG((margin + numModules - 7) * moduleSize, margin * moduleSize + qrYOffset);
  drawEyeSVG(margin * moduleSize, (margin + numModules - 7) * moduleSize + qrYOffset);

  if (logoImgData) {
    const centerPx = size / 2;
    const logoPx = size * logoScale;
    const logoX = centerPx - logoPx / 2;
    const logoY = centerPx - logoPx / 2 + qrYOffset;
    const padding = moduleSize * 0.5;

    if (logoBgShape === 'circle') {
      const bgFill = bgColor === 'transparent' ? '#ffffff' : bgColor;
      svgContent += `<circle cx="${centerPx}" cy="${centerPx + qrYOffset}" r="${logoPx / 2 + padding}" fill="${bgFill}" />\n`;
    } else if (logoBgShape === 'square') {
      const bgFill = bgColor === 'transparent' ? '#ffffff' : bgColor;
      svgContent += `<rect x="${logoX - padding}" y="${logoY - padding}" width="${logoPx + padding * 2}" height="${logoPx + padding * 2}" fill="${bgFill}" />\n`;
    }

    const clipId = `logo-clip-svg`;
    const clipRadius = logoPx * 0.2;
    svgContent += `<clipPath id="${clipId}">\n`;
    svgContent += `  <rect x="${logoX}" y="${logoY}" width="${logoPx}" height="${logoPx}" rx="${clipRadius}" ry="${clipRadius}" />\n`;
    svgContent += `</clipPath>\n`;
    svgContent += `<image x="${logoX}" y="${logoY}" width="${logoPx}" height="${logoPx}" href="${logoImgData}" clip-path="url(#${clipId})" />\n`;
  }

  // Draw External Label SVG
  if (hasLabel) {
    const labelX = size / 2;
    // labelY is precalculated at the top

    if (textBgEnabled) {
      const estW = estimateTextWidth(textLabel, textSize, textWeight) + textBgPadding * 2;
      const estH = textSize + textBgPadding * 2;
      const bgX = labelX - estW / 2;
      const bgY = labelY - estH / 2;
      svgContent += `<rect x="${bgX}" y="${bgY}" width="${estW}" height="${estH}" rx="4" ry="4" fill="${textBgColor}" />\n`;
    }

    let strokeAttrs = '';
    if (textStrokeEnabled) {
      strokeAttrs = `stroke="${textStrokeColor}" stroke-width="${textStrokeWidth}" paint-order="stroke fill" stroke-linejoin="round"`;
    }

    svgContent += `<text x="${labelX}" y="${labelY}" font-family="${textFont}" font-size="${textSize}" font-weight="${textWeight}" font-style="${textStyle}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" ${strokeAttrs}>${textLabel}</text>\n`;
  }

  // Draw Embedded Text SVG
  if (hasEmbed) {
    let embedX = size / 2;
    let embedY = size / 2 + qrYOffset;

    if (embeddedPosition === 'top') {
      embedY = size * 0.25 + qrYOffset;
    } else if (embeddedPosition === 'bottom') {
      embedY = size * 0.75 + qrYOffset;
    } else if (embeddedPosition === 'custom') {
      embedX = size / 2 + (textXOffset / 100) * size;
      embedY = size / 2 + (textYOffset / 100) * size + qrYOffset;
    }

    if (textBgEnabled) {
      const estW = estimateTextWidth(textLabel, textSize, textWeight) + textBgPadding * 2;
      const estH = textSize + textBgPadding * 2;
      const bgX = embedX - estW / 2;
      const bgY = embedY - estH / 2;
      svgContent += `<rect x="${bgX}" y="${bgY}" width="${estW}" height="${estH}" rx="4" ry="4" fill="${textBgColor}" />\n`;
    }

    let strokeAttrs = '';
    if (textStrokeEnabled) {
      strokeAttrs = `stroke="${textStrokeColor}" stroke-width="${textStrokeWidth}" paint-order="stroke fill" stroke-linejoin="round"`;
    }

    svgContent += `<text x="${embedX}" y="${embedY}" font-family="${textFont}" font-size="${textSize}" font-weight="${textWeight}" font-style="${textStyle}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" ${strokeAttrs}>${textLabel}</text>\n`;
  }

  return `<svg width="100%" height="100%" viewBox="0 0 ${size} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">\n${svgContent}</svg>`;
};

export default function QrBarcodeGenerator({ initialTab = 'qr' }) {
  const { t } = useTranslation('tools');
  const [activeTab, setActiveTab] = useState(initialTab);

  // ================= QR State =================
  const [qrType, setQrType] = useState('text'); // 'text' | 'wifi'
  const [qrText, setQrText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrPhone, setQrPhone] = useState('');
  
  // WiFi states
  const [qrWifiSsid, setQrWifiSsid] = useState('');
  const [qrWifiPassword, setQrWifiPassword] = useState('');
  const [qrWifiAuth, setQrWifiAuth] = useState('WPA'); // 'WPA' | 'WEP' | 'nopass'
  const [qrWifiHidden, setQrWifiHidden] = useState(false);

  // Email states
  const [qrEmailTo, setQrEmailTo] = useState('');
  const [qrEmailSubject, setQrEmailSubject] = useState('');
  const [qrEmailBody, setQrEmailBody] = useState('');

  // SMS states
  const [qrSmsPhone, setQrSmsPhone] = useState('');
  const [qrSmsMessage, setQrSmsMessage] = useState('');

  // QR Styling states
  const [qrDotsStyle, setQrDotsStyle] = useState('square'); // 'square' | 'circle'
  const [qrEyesStyle, setQrEyesStyle] = useState('square'); // 'square' | 'rounded' | 'circle'
  const [qrFgType, setQrFgType] = useState('solid'); // 'solid' | 'gradient'
  const [qrFgColor, setQrFgColor] = useState('#111827');
  const [qrGradType, setQrGradType] = useState('linear'); // 'linear' | 'radial'
  const [qrGradColor1, setQrGradColor1] = useState('#4f46e5');
  const [qrGradColor2, setQrGradColor2] = useState('#06b6d4');
  const [qrGradAngle, setQrGradAngle] = useState(45);
  const [qrBgColor, setQrBgColor] = useState('#ffffff');
  const [qrBgTransparent, setQrBgTransparent] = useState(false);
  const [qrErrorCorrection, setQrErrorCorrection] = useState('H');
  const [qrExportSize, setQrExportSize] = useState(512);

  // QR Logo states
  const [logoFile, setLogoFile] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [logoImg, setLogoImg] = useState(null);
  const [logoScale, setLogoScale] = useState(0.18);
  const [logoBgShape, setLogoBgShape] = useState('circle');

  // QR Text Label states
  const [qrTextLabel, setQrTextLabel] = useState('');
  const [qrTextLabelMode, setQrTextLabelMode] = useState('none'); // 'none' | 'label' | 'embedded' | 'both'
  const [qrLabelPosition, setQrLabelPosition] = useState('bottom'); // 'top' | 'bottom'
  const [qrEmbeddedPosition, setQrEmbeddedPosition] = useState('center'); // 'center' | 'top' | 'bottom' | 'custom'
  const [qrTextXOffset, setQrTextXOffset] = useState(0); // -50 to 50 (%)
  const [qrTextYOffset, setQrTextYOffset] = useState(0); // -50 to 50 (%)
  const [qrTextSize, setQrTextSize] = useState(24);
  const [qrTextColor, setQrTextColor] = useState('#111827');
  const [qrTextFont, setQrTextFont] = useState('sans-serif');
  const [qrTextWeight, setQrTextWeight] = useState('bold'); // 'normal' | 'bold'
  const [qrTextStyle, setQrTextStyle] = useState('normal'); // 'normal' | 'italic'
  const [qrTextBgEnabled, setQrTextBgEnabled] = useState(true);
  const [qrTextBgColor, setQrTextBgColor] = useState('#ffffff');
  const [qrTextBgPadding, setQrTextBgPadding] = useState(6);
  const [qrTextStrokeEnabled, setQrTextStrokeEnabled] = useState(false);
  const [qrTextStrokeColor, setQrTextStrokeColor] = useState('#ffffff');
  const [qrTextStrokeWidth, setQrTextStrokeWidth] = useState(3);

  // ================= Color Helper Functions =================
  const isValidHex = (val) => /^#[0-9a-fA-F]{6}$/.test(val);

  const handleColorInputChange = (setter) => (e) => {
    setter(e.target.value);
  };

  const handleColorInputBlur = (value, setter, defaultColor = '#000000') => () => {
    if (!value) {
      setter(defaultColor);
      return;
    }
    let val = value.trim();
    let clean = val.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 3) {
      val = '#' + clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    } else if (clean.length === 6) {
      val = '#' + clean;
    } else {
      val = defaultColor;
    }
    setter(val);
  };

  const PRESET_COLORS = [
    '#000000', '#ffffff', '#4f46e5', '#3b82f6',
    '#10b981', '#f59e0b', '#ef4444', '#ec4899',
    '#8b5cf6', '#06b6d4', '#6b7280', '#111827'
  ];

  const [activeColorPicker, setActiveColorPicker] = useState(null); // null | 'fg' | 'grad1' | 'grad2' | 'bg' | 'text' | 'textBg' | 'textStroke' | 'bcLine' | 'bcBg'

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeColorPicker && !e.target.closest('.color-picker-container')) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeColorPicker]);

  const ColorPickerSwatch = ({ pickerKey, color, setter, defaultColor }) => {
    const isOpen = activeColorPicker === pickerKey;
    return (
      <div className="color-picker-container relative shrink-0">
        <button
          type="button"
          className="w-10 h-10 rounded border border-border cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ backgroundColor: isValidHex(color) ? color : defaultColor }}
          onClick={() => setActiveColorPicker(isOpen ? null : pickerKey)}
        />
        {isOpen && (
          <div className="absolute left-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-xl z-50 grid grid-cols-4 gap-1 w-32">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="w-6 h-6 rounded border border-border cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: preset }}
                title={preset}
                onClick={() => {
                  setter(preset);
                  setActiveColorPicker(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Accordion state — which QR advanced section is open
  const [openSection, setOpenSection] = useState(null); // null | 'style' | 'logo' | 'text'
  const toggleSection = (key) => setOpenSection(prev => prev === key ? null : key);

  // Copy status
  const [copied, setCopied] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(null);

  // ================= Barcode State =================
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128'); // CODE128, EAN13, EAN8, UPC, CODE39, ITF, CODABAR
  const [barcodeLineColor, setBarcodeLineColor] = useState('#111827');
  const [barcodeBgColor, setBarcodeBgColor] = useState('#ffffff');
  const [barcodeWidth, setBarcodeWidth] = useState(2);
  const [barcodeHeight, setBarcodeHeight] = useState(80);
  const [barcodeDisplayValue, setBarcodeDisplayValue] = useState(true);
  const [barcodeFontSize, setBarcodeFontSize] = useState(14);
  const [barcodeMargin, setBarcodeMargin] = useState(10);
  const [barcodeError, setBarcodeError] = useState(null);

  // Refs
  const qrCanvasRef = useRef(null);
  const barcodeCanvasRef = useRef(null);
  const barcodeSvgRef = useRef(null);

  const resetQR = () => {
    setQrType('text');
    setQrText('');
    setQrUrl('');
    setQrPhone('');
    setQrWifiSsid('');
    setQrWifiPassword('');
    setQrWifiAuth('WPA');
    setQrWifiHidden(false);
    setQrEmailTo('');
    setQrEmailSubject('');
    setQrEmailBody('');
    setQrSmsPhone('');
    setQrSmsMessage('');
    setQrDotsStyle('square');
    setQrEyesStyle('square');
    setQrFgType('solid');
    setQrFgColor('#111827');
    setQrGradType('linear');
    setQrGradColor1('#4f46e5');
    setQrGradColor2('#06b6d4');
    setQrGradAngle(45);
    setQrBgColor('#ffffff');
    setQrBgTransparent(false);
    setQrErrorCorrection('H');
    setQrExportSize(512);
    setLogoFile(null);
    setLogoBase64(null);
    setLogoImg(null);
    setLogoScale(0.18);
    setLogoBgShape('circle');
    setQrTextLabel('');
    setQrTextLabelMode('none');
    setQrLabelPosition('bottom');
    setQrEmbeddedPosition('center');
    setQrTextXOffset(0);
    setQrTextYOffset(0);
    setQrTextSize(24);
    setQrTextColor('#111827');
    setQrTextFont('sans-serif');
    setQrTextWeight('bold');
    setQrTextStyle('normal');
    setQrTextBgEnabled(true);
    setQrTextBgColor('#ffffff');
    setQrTextBgPadding(6);
    setQrTextStrokeEnabled(false);
    setQrTextStrokeColor('#ffffff');
    setQrTextStrokeWidth(3);
    setOpenSection(null);
  };

  const resetBarcode = () => {
    setBarcodeValue('');
    setBarcodeFormat('CODE128');
    setBarcodeLineColor('#111827');
    setBarcodeBgColor('#ffffff');
    setBarcodeWidth(2);
    setBarcodeHeight(80);
    setBarcodeDisplayValue(true);
    setBarcodeFontSize(14);
    setBarcodeMargin(10);
  };

  // ================= QR Value Compiler =================
  const getQRValue = useCallback(() => {
    switch (qrType) {
      case 'url':
        return qrUrl;
      case 'wifi':
        if (!qrWifiSsid || !qrWifiSsid.trim()) return '';
        const ssidEsc = escapeWifiString(qrWifiSsid);
        const passEsc = escapeWifiString(qrWifiPassword);
        const hidden = qrWifiHidden ? 'true' : 'false';
        return `WIFI:S:${ssidEsc};T:${qrWifiAuth};P:${qrWifiPassword ? passEsc : ''};H:${hidden};;`;
      case 'email':
        return `mailto:${qrEmailTo}?subject=${encodeURIComponent(qrEmailSubject)}&body=${encodeURIComponent(qrEmailBody)}`;
      case 'phone':
        return `tel:${qrPhone}`;
      case 'sms':
        return `sms:${qrSmsPhone}?body=${encodeURIComponent(qrSmsMessage)}`;
      case 'text':
      default:
        return qrText;
    }
  }, [qrEmailBody, qrEmailSubject, qrEmailTo, qrPhone, qrSmsMessage, qrSmsPhone, qrText, qrType, qrUrl, qrWifiAuth, qrWifiHidden, qrWifiPassword, qrWifiSsid]);

  // Render QR Code inside useEffect
  useEffect(() => {
    if (activeTab === 'qr' && qrCanvasRef.current) {
      const value = getQRValue();
      if (!value) return;

      const renderOptions = {
        size: qrExportSize,
        margin: 4,
        errorCorrectionLevel: (logoImg || qrTextLabelMode === 'embedded' || qrTextLabelMode === 'both') ? 'H' : qrErrorCorrection, // force high recovery if logo or text overlay is present
        dotsStyle: qrDotsStyle,
        eyesStyle: qrEyesStyle,
        fgType: qrFgType,
        fgColor: qrFgColor,
        fgGradient: {
          type: qrGradType,
          color1: qrGradColor1,
          color2: qrGradColor2,
          angle: Number(qrGradAngle)
        },
        bgColor: qrBgTransparent ? 'transparent' : qrBgColor,
        logoImg: logoImg,
        logoScale: Number(logoScale),
        logoBgShape: logoBgShape,
        
        // Text options
        textLabel: qrTextLabel,
        textLabelMode: qrTextLabelMode,
        labelPosition: qrLabelPosition,
        embeddedPosition: qrEmbeddedPosition,
        textXOffset: Number(qrTextXOffset),
        textYOffset: Number(qrTextYOffset),
        textSize: Number(qrTextSize),
        textColor: qrTextColor,
        textFont: qrTextFont,
        textWeight: qrTextWeight,
        textStyle: qrTextStyle,
        textBgEnabled: qrTextBgEnabled,
        textBgColor: qrTextBgColor,
        textBgPadding: Number(qrTextBgPadding),
        textStrokeEnabled: qrTextStrokeEnabled,
        textStrokeColor: qrTextStrokeColor,
        textStrokeWidth: Number(qrTextStrokeWidth)
      };

      try {
        renderCustomQR(qrCanvasRef.current, value, renderOptions);
      } catch (err) {
        console.error(err);
      }
    }
  }, [
    activeTab, qrType, qrText, qrUrl, qrPhone,
    qrWifiSsid, qrWifiPassword, qrWifiAuth, qrWifiHidden,
    qrEmailTo, qrEmailSubject, qrEmailBody,
    qrSmsPhone, qrSmsMessage,
    qrDotsStyle, qrEyesStyle, qrFgType, qrFgColor,
    qrGradType, qrGradColor1, qrGradColor2, qrGradAngle,
    qrBgColor, qrBgTransparent, qrErrorCorrection,
    logoImg, logoScale, logoBgShape, qrExportSize,
    qrTextLabel, qrTextLabelMode, qrLabelPosition, qrEmbeddedPosition,
    qrTextXOffset, qrTextYOffset, qrTextSize, qrTextColor, qrTextFont,
    qrTextWeight, qrTextStyle, qrTextBgEnabled, qrTextBgColor, qrTextBgPadding,
    qrTextStrokeEnabled, qrTextStrokeColor, qrTextStrokeWidth, getQRValue
  ]);

  // Render Barcode inside useEffect
  useEffect(() => {
    if (activeTab === 'barcode') {
      const err = validateBarcode(barcodeValue, barcodeFormat);
      setBarcodeError(err ? t('tool-qrbarcode.ui.invalidBarcode') : null);

      if (!err && barcodeCanvasRef.current && barcodeSvgRef.current) {
        const options = {
          format: barcodeFormat,
          lineColor: barcodeLineColor,
          background: barcodeBgColor,
          width: Number(barcodeWidth),
          height: Number(barcodeHeight),
          displayValue: barcodeDisplayValue,
          fontSize: Number(barcodeFontSize),
          margin: Number(barcodeMargin),
        };

        try {
          // Render to Canvas for PNG download
          JsBarcode(barcodeCanvasRef.current, barcodeValue, options);
          // Render to SVG for vector download
          JsBarcode(barcodeSvgRef.current, barcodeValue, options);
        } catch (e) {
          console.error("Barcode drawing error: ", e);
          setBarcodeError(t('tool-qrbarcode.ui.renderFailed'));
        }
      }
    }
  }, [
    activeTab, barcodeValue, barcodeFormat, barcodeLineColor,
    barcodeBgColor, barcodeWidth, barcodeHeight,
    barcodeDisplayValue, barcodeFontSize, barcodeMargin, t
  ]);

  // Handle Logo Image Upload
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = String(event.target?.result || '');
      setLogoBase64(dataUrl);

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        setLogoImg(img);
      };
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoBase64(null);
    setLogoImg(null);
  };

  // Download QR Code PNG
  const handleQrDownloadPNG = () => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `qrcode_${qrType}_${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  // Download QR Code SVG
  const handleQrDownloadSVG = () => {
    const value = getQRValue();
    const svgString = generateQRSVG(value, {
      margin: 4,
      errorCorrectionLevel: (logoImg || qrTextLabelMode === 'embedded' || qrTextLabelMode === 'both') ? 'H' : qrErrorCorrection,
      dotsStyle: qrDotsStyle,
      eyesStyle: qrEyesStyle,
      fgType: qrFgType,
      fgColor: qrFgColor,
      fgGradient: {
        type: qrGradType,
        color1: qrGradColor1,
        color2: qrGradColor2,
        angle: Number(qrGradAngle)
      },
      bgColor: qrBgTransparent ? 'transparent' : qrBgColor,
      logoImgData: logoBase64,
      logoScale: Number(logoScale),
      logoBgShape: logoBgShape,
      
      // Text options
      textLabel: qrTextLabel,
      textLabelMode: qrTextLabelMode,
      labelPosition: qrLabelPosition,
      embeddedPosition: qrEmbeddedPosition,
      textXOffset: Number(qrTextXOffset),
      textYOffset: Number(qrTextYOffset),
      textSize: Number(qrTextSize),
      textColor: qrTextColor,
      textFont: qrTextFont,
      textWeight: qrTextWeight,
      textStyle: qrTextStyle,
      textBgEnabled: qrTextBgEnabled,
      textBgColor: qrTextBgColor,
      textBgPadding: Number(qrTextBgPadding),
      textStrokeEnabled: qrTextStrokeEnabled,
      textStrokeColor: qrTextStrokeColor,
      textStrokeWidth: Number(qrTextStrokeWidth)
    });

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `qrcode_${qrType}_${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy QR Image to Clipboard
  const handleQrCopy = async () => {
    if (!qrCanvasRef.current) return;
    try {
      qrCanvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy image: ', err);
    }
  };

  // Download Barcode PNG
  const handleBarcodeDownloadPNG = () => {
    if (!barcodeCanvasRef.current || barcodeError) return;
    const url = barcodeCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `barcode_${barcodeFormat}_${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  // Download Barcode SVG
  const handleBarcodeDownloadSVG = () => {
    if (!barcodeSvgRef.current || barcodeError) return;
    const svgString = new XMLSerializer().serializeToString(barcodeSvgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `barcode_${barcodeFormat}_${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openFullscreenPreview = () => {
    const isQrPreview = activeTab === 'qr';
    const canvas = isQrPreview ? qrCanvasRef.current : barcodeCanvasRef.current;
    const unavailable = isQrPreview
      ? !getQRValue()
      : !barcodeValue || Boolean(barcodeError);
    if (!canvas || unavailable) return;

    setFullscreenPreview({
      src: canvas.toDataURL('image/png'),
      title: isQrPreview ? t('tool-qrbarcode.ui.qrFullscreen') : t('tool-qrbarcode.ui.barcodeFullscreen'),
      transparent: isQrPreview && qrBgTransparent,
    });
  };

  // Reusable accordion header button
  const AccordionHeader = ({ sectionKey, label, badge = null }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-nav-hover-bg transition-colors text-left group"
    >
      <span className="flex items-center gap-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{label}</span>
        {badge && (
          <span className="text-[10px] font-bold bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">{badge}</span>
        )}
      </span>
      <svg
        viewBox="0 0 24 24" width="14" height="14"
        stroke="currentColor" strokeWidth="2.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        className={`text-text-muted transition-transform duration-200 shrink-0 ${openSection === sectionKey ? 'rotate-180' : ''}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  return (
    <Card id="tool-qrbarcode" variant="tool" size="wide">
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-3 md:flex-row md:items-center">
        <ToolHeader 
          title={t('tool-qrbarcode.ui.title')}
          className="!border-b-0 !pb-0"
        />
        <div className="flex gap-2 shrink-0">
          <Button
            variant={activeTab === 'qr' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setFullscreenPreview(null);
              setActiveTab('qr');
            }}
            className="flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <rect x="7" y="7" width="3" height="3"></rect>
              <rect x="14" y="7" width="3" height="3"></rect>
              <rect x="7" y="14" width="3" height="3"></rect>
            </svg>
            <span>{t('tool-qrbarcode.ui.qrCode')}</span>
          </Button>
          <Button
            variant={activeTab === 'barcode' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setFullscreenPreview(null);
              setActiveTab('barcode');
            }}
            className="flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <line x1="3" y1="5" x2="3" y2="19"></line>
              <line x1="6" y1="5" x2="6" y2="19"></line>
              <line x1="10" y1="5" x2="10" y2="19"></line>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="15" y1="5" x2="15" y2="19"></line>
              <line x1="18" y1="5" x2="18" y2="19"></line>
              <line x1="21" y1="5" x2="21" y2="19"></line>
            </svg>
            <span>{t('tool-qrbarcode.ui.barcode')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        
        {/* ================= LEFT SIDE: CONFIG PANEL ================= */}
        <div className="custom-scrollbar flex flex-col gap-4 pr-3 lg:col-span-3 lg:max-h-[400px] lg:overflow-y-auto">
          
          {activeTab === 'qr' ? (
            <>
              {/* QR TYPE SELECTOR */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-main">{t('tool-qrbarcode.ui.contentType')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'text', name: t('tool-qrbarcode.ui.plainText') },
                    { id: 'wifi', name: t('tool-qrbarcode.ui.wifiNetwork') }
                  ].map(t => (
                    <button 
                      key={t.id}
                      type="button"
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer text-center ${
                        qrType === t.id 
                          ? 'bg-accent-fill border-accent text-accent-on-fill shadow-sm' 
                          : 'bg-card border-border text-text-muted hover:text-text-main hover:bg-nav-hover-bg'
                      }`}
                      onClick={() => setQrType(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC CONTENT INPUTS */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
                {qrType === 'text' && (
                  <FieldInput 
                    as="textarea"
                    id="qr-text"
                    label={t('tool-qrbarcode.ui.plainTextContent')}
                    rows={3}
                    placeholder={t('tool-qrbarcode.ui.textPlaceholder')}
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                  />
                )}

                {qrType === 'wifi' && (
                  <div className="flex flex-col gap-4">
                    <FieldInput 
                      id="wifi-ssid"
                      type="text"
                      label={t('tool-qrbarcode.ui.networkName')}
                      placeholder={t('tool-qrbarcode.ui.ssidPlaceholder')}
                      value={qrWifiSsid}
                      onChange={(e) => setQrWifiSsid(e.target.value)}
                    />
                    <FieldInput 
                      id="wifi-password"
                      type="text"
                      label={t('tool-qrbarcode.ui.password')}
                      placeholder={t('tool-qrbarcode.ui.passwordPlaceholder')}
                      disabled={qrWifiAuth === 'nopass'}
                      value={qrWifiPassword}
                      onChange={(e) => setQrWifiPassword(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5 w-full">
                        <label htmlFor="wifi-auth" className="text-sm font-semibold text-text-main">{t('tool-qrbarcode.ui.security')}</label>
                        <select 
                          id="wifi-auth"
                          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                          value={qrWifiAuth}
                          onChange={(e) => setQrWifiAuth(e.target.value)}
                        >
                          <option value="WPA">WPA/WPA2</option>
                          <option value="WEP">WEP</option>
                          <option value="nopass">{t('tool-qrbarcode.ui.unsecured')}</option>
                        </select>
                      </div>
                      <div className="flex items-center mt-6">
                        <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                          <input 
                            type="checkbox"
                            className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                            checked={qrWifiHidden}
                            onChange={(e) => setQrWifiHidden(e.target.checked)}
                          />
                          {t('tool-qrbarcode.ui.hiddenNetwork')}
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ACCORDION: STYLE CUSTOMIZATION ── */}
              <AccordionHeader sectionKey="style" label={t('tool-qrbarcode.ui.styleCustomization')} />
              {openSection === 'style' && (
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5 shadow-sm -mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-dots-style" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.dotsStyle')}</label>
                      <select 
                        id="qr-dots-style" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        value={qrDotsStyle} 
                        onChange={(e) => setQrDotsStyle(e.target.value)}
                      >
                        <option value="square">{t('tool-qrbarcode.ui.classicSquare')}</option>
                        <option value="circle">{t('tool-qrbarcode.ui.roundedCircles')}</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-eyes-style" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.eyesStyle')}</label>
                      <select 
                        id="qr-eyes-style" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        value={qrEyesStyle} 
                        onChange={(e) => setQrEyesStyle(e.target.value)}
                      >
                        <option value="square">{t('tool-qrbarcode.ui.standardSquare')}</option>
                        <option value="rounded">{t('tool-qrbarcode.ui.smoothRounded')}</option>
                        <option value="circle">{t('tool-qrbarcode.ui.circularRings')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.foregroundType')}</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                        <input 
                          type="radio" 
                          name="fgType" 
                          className="text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                          value="solid" 
                          checked={qrFgType === 'solid'} 
                          onChange={() => setQrFgType('solid')}
                        />
                        {t('tool-qrbarcode.ui.solidColor')}
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                        <input 
                          type="radio" 
                          name="fgType" 
                          className="text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                          value="gradient" 
                          checked={qrFgType === 'gradient'} 
                          onChange={() => setQrFgType('gradient')}
                        />
                        {t('tool-qrbarcode.ui.gradientColor')}
                      </label>
                    </div>
                  </div>

                  {qrFgType === 'solid' ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-fg-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.foregroundColor')}</label>
                      <div className="flex items-center gap-2">
                        <ColorPickerSwatch pickerKey="fg" color={qrFgColor} setter={setQrFgColor} defaultColor="#111827" />
                        <input 
                          id="qr-fg-color"
                          type="text" 
                          className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                          value={qrFgColor} 
                          onChange={handleColorInputChange(setQrFgColor)}
                          onBlur={handleColorInputBlur(qrFgColor, setQrFgColor, '#111827')}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-grad-1" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.startColor')}</label>
                          <div className="flex items-center gap-2">
                            <ColorPickerSwatch pickerKey="grad1" color={qrGradColor1} setter={setQrGradColor1} defaultColor="#4f46e5" />
                            <input 
                              id="qr-grad-1"
                              type="text" 
                              className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                              value={qrGradColor1} 
                              onChange={handleColorInputChange(setQrGradColor1)}
                              onBlur={handleColorInputBlur(qrGradColor1, setQrGradColor1, '#4f46e5')}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-grad-2" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.endColor')}</label>
                          <div className="flex items-center gap-2">
                            <ColorPickerSwatch pickerKey="grad2" color={qrGradColor2} setter={setQrGradColor2} defaultColor="#06b6d4" />
                            <input 
                              id="qr-grad-2"
                              type="text" 
                              className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                              value={qrGradColor2} 
                              onChange={handleColorInputChange(setQrGradColor2)}
                              onBlur={handleColorInputBlur(qrGradColor2, setQrGradColor2, '#06b6d4')}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-grad-style" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.gradientShape')}</label>
                          <select 
                            id="qr-grad-style" 
                            className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                            value={qrGradType} 
                            onChange={(e) => setQrGradType(e.target.value)}
                          >
                            <option value="linear">{t('tool-qrbarcode.ui.linear')}</option>
                            <option value="radial">{t('tool-qrbarcode.ui.radial')}</option>
                          </select>
                        </div>
                        {qrGradType === 'linear' && (
                          <div className="flex flex-col gap-1.5 w-full">
                            <label htmlFor="qr-grad-angle" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.angle', { value: qrGradAngle })}</label>
                            <input 
                              id="qr-grad-angle"
                              type="range" 
                              min="0" 
                              max="360" 
                              step="15"
                              className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                              value={qrGradAngle} 
                              onChange={(e) => setQrGradAngle(Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-bg-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.backgroundColor')}</label>
                      <div className="flex items-center gap-2">
                        <ColorPickerSwatch pickerKey="bg" color={qrBgColor} setter={setQrBgColor} defaultColor="#ffffff" />
                        <input 
                          id="qr-bg-color"
                          type="text" 
                          className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                          disabled={qrBgTransparent}
                          value={qrBgColor} 
                          onChange={handleColorInputChange(setQrBgColor)}
                          onBlur={handleColorInputBlur(qrBgColor, setQrBgColor, '#ffffff')}
                          style={{ opacity: qrBgTransparent ? 0.4 : 1 }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center mt-6">
                      <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                        <input 
                          type="checkbox"
                          className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                          checked={qrBgTransparent}
                          onChange={(e) => setQrBgTransparent(e.target.checked)}
                        />
                        {t('tool-qrbarcode.ui.transparentBg')}
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-error-correct" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.errorCorrection')}</label>
                      <select 
                        id="qr-error-correct" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        disabled={logoImg !== null}
                        value={logoImg ? 'H' : qrErrorCorrection} 
                        onChange={(e) => setQrErrorCorrection(e.target.value)}
                      >
                        <option value="L">{t('tool-qrbarcode.ui.recoveryLow')}</option>
                        <option value="M">{t('tool-qrbarcode.ui.recoveryMedium')}</option>
                        <option value="Q">{t('tool-qrbarcode.ui.recoveryQuartile')}</option>
                        <option value="H">{t('tool-qrbarcode.ui.recoveryHigh')}</option>
                      </select>
                      {logoImg && <span className="text-[10px] text-amber-500 font-semibold mt-1">{t('tool-qrbarcode.ui.highLocked')}</span>}
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-export-size" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.resolution')}</label>
                      <select 
                        id="qr-export-size" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        value={qrExportSize} 
                        onChange={(e) => setQrExportSize(Number(e.target.value))}
                      >
                        <option value={256}>256 x 256 px</option>
                        <option value={512}>512 x 512 px</option>
                        <option value={1024}>1024 x 1024 px</option>
                        <option value={2048}>2048 x 2048 px</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ACCORDION: EMBED LOGO ── */}
              <AccordionHeader sectionKey="logo" label={t('tool-qrbarcode.ui.embedLogo')} badge={logoImg ? t('tool-qrbarcode.ui.oneLogo') : null} />
              {openSection === 'logo' && (
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm -mt-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.uploadLogo')}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label htmlFor="logo-file-picker">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-app hover:bg-nav-hover-bg cursor-pointer text-text-main transition-colors text-xs font-bold shadow-sm select-none">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                          </svg>
                          {logoFile ? t('tool-qrbarcode.ui.changeLogo') : t('tool-qrbarcode.ui.chooseLogo')}
                        </span>
                      </label>
                      <input 
                        id="logo-file-picker"
                        type="file" 
                        accept="image/png, image/jpeg, image/svg+xml"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      {logoFile && (
                        <span className="bg-app border border-border text-text-muted px-2.5 py-1 rounded-md text-xs font-mono max-w-[200px] truncate">
                          {logoFile.name}
                        </span>
                      )}
                      {logoImg && (
                        <Button variant="secondary" size="sm" className="text-red-500 hover:text-red-600 font-bold ml-auto" onClick={removeLogo}>
                          {t('tool-qrbarcode.ui.removeLogo')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {logoImg && (
                    <div className="border-t border-border pt-4 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="logo-scale" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.logoSize', { value: Math.round(logoScale * 100) })}</label>
                          <input 
                            id="logo-scale"
                            type="range" 
                            min="0.10" 
                            max="0.25" 
                            step="0.01"
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                            value={logoScale} 
                            onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="logo-bg-shape" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.logoBackground')}</label>
                          <select 
                            id="logo-bg-shape" 
                            className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                            value={logoBgShape} 
                            onChange={(e) => setLogoBgShape(e.target.value)}
                          >
                            <option value="none">{t('tool-qrbarcode.ui.noneOverlaid')}</option>
                            <option value="circle">{t('tool-qrbarcode.ui.whiteCircle')}</option>
                            <option value="square">{t('tool-qrbarcode.ui.whiteSquare')}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ACCORDION: TEXT OVERLAY ── */}
              <AccordionHeader sectionKey="text" label={t('tool-qrbarcode.ui.textOverlay')} badge={qrTextLabelMode !== 'none' ? t(`tool-qrbarcode.ui.mode.${qrTextLabelMode}`) : null} />
              {openSection === 'text' && (
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm -mt-2">
                  <FieldInput 
                    id="qr-text-label-input"
                    type="text"
                    label={t('tool-qrbarcode.ui.textContent')}
                    placeholder={t('tool-qrbarcode.ui.overlayPlaceholder')}
                    value={qrTextLabel}
                    onChange={(e) => setQrTextLabel(e.target.value)}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-text-label-mode" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.displayMode')}</label>
                      <select 
                        id="qr-text-label-mode" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        value={qrTextLabelMode} 
                        onChange={(e) => setQrTextLabelMode(e.target.value)}
                      >
                        <option value="none">{t('tool-qrbarcode.ui.mode.none')}</option>
                        <option value="label">{t('tool-qrbarcode.ui.mode.label')}</option>
                        <option value="embedded">{t('tool-qrbarcode.ui.mode.embedded')}</option>
                        <option value="both">{t('tool-qrbarcode.ui.mode.both')}</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="qr-text-font" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.fontFamily')}</label>
                      <select 
                        id="qr-text-font" 
                        className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                        disabled={qrTextLabelMode === 'none'}
                        value={qrTextFont} 
                        onChange={(e) => setQrTextFont(e.target.value)}
                      >
                        <option value="sans-serif">{t('tool-qrbarcode.ui.sansSerif')}</option>
                        <option value="serif">{t('tool-qrbarcode.ui.serif')}</option>
                        <option value="monospace">{t('tool-qrbarcode.ui.monospace')}</option>
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Impact">Impact</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Trebuchet MS">Trebuchet MS</option>
                        <option value="Verdana">Verdana</option>
                      </select>
                    </div>
                  </div>

                  {qrTextLabelMode !== 'none' && (
                    <div className="border-t border-border pt-4 flex flex-col gap-4">
                      
                      {/* Size and Color */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-text-size" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.fontSize', { value: qrTextSize })}</label>
                          <input 
                            id="qr-text-size"
                            type="range" 
                            min="12" 
                            max="64" 
                            step="1"
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                            value={qrTextSize} 
                            onChange={(e) => setQrTextSize(parseInt(e.target.value))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-text-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.textColor')}</label>
                          <div className="flex items-center gap-2">
                            <ColorPickerSwatch pickerKey="text" color={qrTextColor} setter={setQrTextColor} defaultColor="#111827" />
                            <input 
                              id="qr-text-color"
                              type="text" 
                              className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                              value={qrTextColor} 
                              onChange={handleColorInputChange(setQrTextColor)}
                              onBlur={handleColorInputBlur(qrTextColor, setQrTextColor, '#111827')}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weight and Style */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-text-weight" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.fontWeight')}</label>
                          <select 
                            id="qr-text-weight" 
                            className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                            value={qrTextWeight} 
                            onChange={(e) => setQrTextWeight(e.target.value)}
                          >
                            <option value="normal">{t('tool-qrbarcode.ui.normal')}</option>
                            <option value="bold">{t('tool-qrbarcode.ui.bold')}</option>
                            <option value="bolder">{t('tool-qrbarcode.ui.extraBold')}</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                          <label htmlFor="qr-text-style" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.fontStyle')}</label>
                          <select 
                            id="qr-text-style" 
                            className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                            value={qrTextStyle} 
                            onChange={(e) => setQrTextStyle(e.target.value)}
                          >
                            <option value="normal">{t('tool-qrbarcode.ui.normal')}</option>
                            <option value="italic">{t('tool-qrbarcode.ui.italic')}</option>
                          </select>
                        </div>
                      </div>

                      {/* Positions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                        {(qrTextLabelMode === 'label' || qrTextLabelMode === 'both') && (
                          <div className="flex flex-col gap-1.5 w-full">
                            <label htmlFor="qr-label-pos" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.labelPosition')}</label>
                            <select 
                              id="qr-label-pos" 
                              className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                              value={qrLabelPosition} 
                              onChange={(e) => setQrLabelPosition(e.target.value)}
                            >
                              <option value="bottom">{t('tool-qrbarcode.ui.belowQr')}</option>
                              <option value="top">{t('tool-qrbarcode.ui.aboveQr')}</option>
                            </select>
                          </div>
                        )}
                        {(qrTextLabelMode === 'embedded' || qrTextLabelMode === 'both') && (
                          <div className="flex flex-col gap-1.5 w-full">
                            <label htmlFor="qr-embed-pos" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.embeddedPosition')}</label>
                            <select 
                              id="qr-embed-pos" 
                              className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
                              value={qrEmbeddedPosition} 
                              onChange={(e) => setQrEmbeddedPosition(e.target.value)}
                            >
                              <option value="center">{t('tool-qrbarcode.ui.center')}</option>
                              <option value="top">{t('tool-qrbarcode.ui.topThird')}</option>
                              <option value="bottom">{t('tool-qrbarcode.ui.bottomThird')}</option>
                              <option value="custom">{t('tool-qrbarcode.ui.customCoordinates')}</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Custom coordinates offset */}
                      {qrEmbeddedPosition === 'custom' && (qrTextLabelMode === 'embedded' || qrTextLabelMode === 'both') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-app border border-border rounded-lg p-3">
                          <div className="flex flex-col gap-1.5 w-full">
                            <label htmlFor="qr-text-x" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.horizontalPosition', { value: qrTextXOffset })}</label>
                            <input 
                              id="qr-text-x"
                              type="range" 
                              min="-50" 
                              max="50" 
                              step="1"
                              className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2"
                              value={qrTextXOffset} 
                              onChange={(e) => setQrTextXOffset(parseInt(e.target.value))}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 w-full">
                            <label htmlFor="qr-text-y" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.verticalPosition', { value: qrTextYOffset })}</label>
                            <input 
                              id="qr-text-y"
                              type="range" 
                              min="-50" 
                              max="50" 
                              step="1"
                              className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2"
                              value={qrTextYOffset} 
                              onChange={(e) => setQrTextYOffset(parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Background block settings */}
                      <div className="border-t border-border pt-4 flex flex-col gap-3">
                        <div className="flex items-center">
                          <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                            <input 
                              type="checkbox"
                              className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                              checked={qrTextBgEnabled}
                              onChange={(e) => setQrTextBgEnabled(e.target.checked)}
                            />
                            {t('tool-qrbarcode.ui.drawTextBackground')}
                          </label>
                        </div>

                        {qrTextBgEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-app border border-border rounded-lg p-3">
                            <div className="flex flex-col gap-1.5 w-full">
                              <label htmlFor="qr-text-bg-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.backgroundColor')}</label>
                              <div className="flex items-center gap-2">
                                <ColorPickerSwatch pickerKey="textBg" color={qrTextBgColor} setter={setQrTextBgColor} defaultColor="#ffffff" />
                                <input 
                                  id="qr-text-bg-color"
                                  type="text" 
                                  className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                                  value={qrTextBgColor} 
                                  onChange={handleColorInputChange(setQrTextBgColor)}
                                  onBlur={handleColorInputBlur(qrTextBgColor, setQrTextBgColor, '#ffffff')}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                              <label htmlFor="qr-text-bg-pad" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.backgroundPadding', { value: qrTextBgPadding })}</label>
                              <input 
                                id="qr-text-bg-pad"
                                type="range" 
                                min="0" 
                                max="30" 
                                step="1"
                                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2"
                                value={qrTextBgPadding} 
                                onChange={(e) => setQrTextBgPadding(parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stroke Outline settings */}
                      <div className="border-t border-border pt-4 flex flex-col gap-3">
                        <div className="flex items-center">
                          <label className="flex items-center gap-2 text-sm font-semibold text-text-main cursor-pointer">
                            <input 
                              type="checkbox"
                              className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                              checked={qrTextStrokeEnabled}
                              onChange={(e) => setQrTextStrokeEnabled(e.target.checked)}
                            />
                            {t('tool-qrbarcode.ui.addOutline')}
                          </label>
                        </div>

                        {qrTextStrokeEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-app border border-border rounded-lg p-3">
                            <div className="flex flex-col gap-1.5 w-full">
                              <label htmlFor="qr-text-stroke-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.outlineColor')}</label>
                              <div className="flex items-center gap-2">
                                <ColorPickerSwatch pickerKey="textStroke" color={qrTextStrokeColor} setter={setQrTextStrokeColor} defaultColor="#ffffff" />
                                <input 
                                  id="qr-text-stroke-color"
                                  type="text" 
                                  className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                                  value={qrTextStrokeColor} 
                                  onChange={handleColorInputChange(setQrTextStrokeColor)}
                                  onBlur={handleColorInputBlur(qrTextStrokeColor, setQrTextStrokeColor, '#ffffff')}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                              <label htmlFor="qr-text-stroke-width" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.outlineThickness', { value: qrTextStrokeWidth })}</label>
                              <input 
                                id="qr-text-stroke-width"
                                type="range" 
                                min="1" 
                                max="8" 
                                step="1"
                                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2"
                                value={qrTextStrokeWidth} 
                                onChange={(e) => setQrTextStrokeWidth(parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}

              <div className="mt-2">
                <Button variant="secondary" className="w-full" onClick={resetQR}>
                  {t('tool-qrbarcode.ui.resetQr')}
                </Button>
              </div>
            </>
          ) : (
            // ================= BARCODE INPUTS & STYLING =================
            <>
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
                <FieldInput 
                  id="barcode-val"
                  type="text" 
                  label={t('tool-qrbarcode.ui.barcodeValue')}
                  value={barcodeValue} 
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  error={barcodeError}
                />

                <div className="flex flex-col gap-1.5 w-full">
                  <label htmlFor="barcode-format" className="text-sm font-semibold text-text-main">{t('tool-qrbarcode.ui.format')}</label>
                  <select 
                    id="barcode-format" 
                    className="bg-app border border-border rounded-lg px-3 py-2.5 text-sm text-text-main outline-none focus:border-accent"
                    value={barcodeFormat} 
                    onChange={(e) => setBarcodeFormat(e.target.value)}
                  >
                    <option value="CODE128">{t('tool-qrbarcode.ui.code128')}</option>
                    <option value="EAN13">{t('tool-qrbarcode.ui.ean13')}</option>
                    <option value="EAN8">{t('tool-qrbarcode.ui.ean8')}</option>
                    <option value="UPC">{t('tool-qrbarcode.ui.upca')}</option>
                    <option value="CODE39">{t('tool-qrbarcode.ui.code39')}</option>
                    <option value="ITF">{t('tool-qrbarcode.ui.itf')}</option>
                    <option value="CODABAR">Codabar</option>
                  </select>
                </div>

                <ToggleSwitch
                  id="barcode-display-value"
                  checked={barcodeDisplayValue}
                  onChange={(event) => setBarcodeDisplayValue(event.target.checked)}
                  label={t('tool-qrbarcode.ui.showReadable')}
                />
              </div>

              <AccordionHeader sectionKey="barcode-style" label={t('tool-qrbarcode.ui.barcodeStyling')} />
              {openSection === 'barcode-style' && (
                <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5 shadow-sm -mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-line-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.lineColor')}</label>
                      <div className="flex items-center gap-2">
                        <ColorPickerSwatch pickerKey="bcLine" color={barcodeLineColor} setter={setBarcodeLineColor} defaultColor="#111827" />
                        <input 
                          id="bc-line-color"
                          type="text" 
                          className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                          value={barcodeLineColor} 
                          onChange={handleColorInputChange(setBarcodeLineColor)}
                          onBlur={handleColorInputBlur(barcodeLineColor, setBarcodeLineColor, '#111827')}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-bg-color" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.backgroundColor')}</label>
                      <div className="flex items-center gap-2">
                        <ColorPickerSwatch pickerKey="bcBg" color={barcodeBgColor} setter={setBarcodeBgColor} defaultColor="#ffffff" />
                        <input 
                          id="bc-bg-color"
                          type="text" 
                          className="bg-app border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono w-full uppercase"
                          value={barcodeBgColor} 
                          onChange={handleColorInputChange(setBarcodeBgColor)}
                          onBlur={handleColorInputBlur(barcodeBgColor, setBarcodeBgColor, '#ffffff')}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-width" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.barWidth', { value: barcodeWidth })}</label>
                      <input 
                        id="bc-width"
                        type="range" 
                        min="1" 
                        max="4" 
                        step="1"
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                        value={barcodeWidth} 
                        onChange={(e) => setBarcodeWidth(parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-height" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.barHeight', { value: barcodeHeight })}</label>
                      <input 
                        id="bc-height"
                        type="range" 
                        min="40" 
                        max="150" 
                        step="5"
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                        value={barcodeHeight} 
                        onChange={(e) => setBarcodeHeight(parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  {barcodeDisplayValue && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-font-size" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.fontSize', { value: barcodeFontSize })}</label>
                      <input
                        id="bc-font-size"
                        type="range"
                        min="10"
                        max="24"
                        step="1"
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                        value={barcodeFontSize}
                        onChange={(e) => setBarcodeFontSize(parseInt(e.target.value))}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="bc-margin" className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-qrbarcode.ui.outerMargin', { value: barcodeMargin })}</label>
                      <input 
                        id="bc-margin"
                        type="range" 
                        min="0" 
                        max="40" 
                        step="5"
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent my-2.5"
                        value={barcodeMargin} 
                        onChange={(e) => setBarcodeMargin(parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2">
                <Button variant="secondary" className="w-full" onClick={resetBarcode}>
                  {t('tool-qrbarcode.ui.resetBarcode')}
                </Button>
              </div>
            </>
          )}

        </div>

        {/* ================= RIGHT SIDE: STICKY PREVIEW CARD ================= */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-3 lg:col-span-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <h2 className="border-b border-border pb-2 text-center text-xs font-bold uppercase tracking-wider text-text-muted">{t('tool-qrbarcode.ui.livePreview')}</h2>

            <div className="relative flex h-[170px] select-none items-center justify-center rounded-xl border border-dashed border-border bg-app p-2">
              <FullscreenPreviewButton
                disabled={activeTab === 'qr' ? !getQRValue() : !barcodeValue || Boolean(barcodeError)}
                label={activeTab === 'qr' ? t('tool-qrbarcode.ui.openQrFullscreen') : t('tool-qrbarcode.ui.openBarcodeFullscreen')}
                onClick={openFullscreenPreview}
              />
              {activeTab === 'qr' ? (
                <div className="flex items-center justify-center h-full w-full">
                  {!getQRValue() ? (
                    <div className="flex flex-col items-center gap-2 text-text-muted/60 text-center">
                      <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 animate-pulse">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <rect x="7" y="7" width="3" height="3"></rect>
                        <rect x="14" y="7" width="3" height="3"></rect>
                        <rect x="7" y="14" width="3" height="3"></rect>
                      </svg>
                      <p className="text-xs font-medium">{t('tool-qrbarcode.ui.enterQrContent')}</p>
                    </div>
                  ) : (
                    <canvas ref={qrCanvasRef} id="qr-preview-canvas" className="max-h-full max-w-full bg-transparent border border-border/30 rounded-lg shadow-sm" />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full w-full">
                  {!barcodeValue ? (
                    <div className="flex flex-col items-center gap-2 text-text-muted/60 text-center">
                      <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 animate-pulse">
                        <line x1="3" y1="5" x2="3" y2="19"></line>
                        <line x1="6" y1="5" x2="6" y2="19"></line>
                        <line x1="10" y1="5" x2="10" y2="19"></line>
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="15" y1="5" x2="15" y2="19"></line>
                        <line x1="18" y1="5" x2="18" y2="19"></line>
                        <line x1="21" y1="5" x2="21" y2="19"></line>
                      </svg>
                      <p className="text-xs font-medium">{t('tool-qrbarcode.ui.enterBarcodeValue')}</p>
                    </div>
                  ) : barcodeError ? (
                    <div className="flex flex-col items-center gap-2 text-red-500/70 text-center">
                      <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <p className="text-xs font-semibold">{barcodeError}</p>
                    </div>
                  ) : (
                    <div className="max-h-full max-w-full flex justify-center overflow-x-auto p-1 bg-white rounded-lg">
                      <canvas ref={barcodeCanvasRef} className="max-h-full max-w-full object-contain" />
                      {/* Hidden SVG reference specifically for high-fidelity export */}
                      <svg ref={barcodeSvgRef} style={{ display: 'none' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeTab === 'qr' ? (
                <>
                  <Button variant="primary" size="sm" disabled={!getQRValue()} onClick={handleQrDownloadPNG} className="w-full">
                    {t('tool-qrbarcode.ui.downloadPng')}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!getQRValue()} onClick={handleQrDownloadSVG} className="w-full">
                    {t('tool-qrbarcode.ui.downloadSvg')}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!getQRValue()} onClick={handleQrCopy} className="col-span-2 w-full sm:col-span-1">
                    {copied ? t('tool-qrbarcode.ui.copied') : t('tool-qrbarcode.ui.copyImage')}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="sm" disabled={!barcodeValue || !!barcodeError} onClick={handleBarcodeDownloadPNG} className="w-full">
                    {t('tool-qrbarcode.ui.downloadPng')}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!barcodeValue || !!barcodeError} onClick={handleBarcodeDownloadSVG} className="w-full">
                    {t('tool-qrbarcode.ui.downloadSvg')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      <FullscreenPreview
        open={Boolean(fullscreenPreview)}
        onClose={() => setFullscreenPreview(null)}
        title={fullscreenPreview?.title}
        surfaceClassName={fullscreenPreview?.transparent ? TRANSPARENT_PREVIEW_CLASS : 'bg-white'}
      >
        {fullscreenPreview && (
          <img
            src={fullscreenPreview.src}
            alt={fullscreenPreview.title}
            className="max-h-[76vh] max-w-full object-contain"
          />
        )}
      </FullscreenPreview>
    </Card>
  );
}
