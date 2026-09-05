import React from 'react';
import { useTranslation } from 'react-i18next';
import AutoDetectConverter from './ui/AutoDetectConverter';

function encodeUnicode(text) {
  return Array.from(text)
    .map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');
}

function decodeUnicode(codes, t) {
  const values = codes.trim().split(/[\s,]+/).filter(Boolean);
  const chars = [];

  for (const raw of values) {
    const cleaned = raw.replace(/^U\+/i, '').replace(/^0x/i, '');
    if (!/^[0-9A-F]+$/i.test(cleaned)) {
      return { output: '', error: t('tool-unicode.ui.notHex', { value: raw }) };
    }

    const codePoint = Number.parseInt(cleaned, 16);
    const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;
    if (codePoint > 0x10ffff || isSurrogate) {
      return { output: '', error: t('tool-unicode.ui.invalidScalar', { value: raw }) };
    }
    chars.push(String.fromCodePoint(codePoint));
  }

  return { output: chars.join(''), error: null };
}

function looksLikeUnicodeCodes(text) {
  const values = text.trim().split(/[\s,]+/).filter(Boolean);
  if (!values.length) return false;

  const hasExplicitPrefix = values.some((value) => /^(?:U\+|0x)/i.test(value));
  if (hasExplicitPrefix) return true;

  return values.length > 1
    && values.every((value) => /^[0-9A-F]{2,6}$/i.test(value))
    && values.some((value) => /\d/.test(value));
}

function analyzeUnicode(input, mode = 'auto', t) {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      sourceLabel: mode === 'encode' ? t('tool-unicode.ui.plainText') : mode === 'decode' ? t('tool-unicode.ui.codePoints') : t('tool-unicode.ui.textOrCodePoints'),
      targetLabel: mode === 'encode' ? t('tool-unicode.ui.codePoints') : mode === 'decode' ? t('tool-unicode.ui.plainText') : '',
      output: '',
      outputPlaceholder: t('tool-unicode.ui.convertedPlaceholder'),
      error: null,
    };
  }

  if (mode === 'encode') {
    return {
      sourceLabel: t('tool-unicode.ui.plainText'),
      targetLabel: t('tool-unicode.ui.codePoints'),
      output: encodeUnicode(input),
      outputPlaceholder: t('tool-unicode.ui.pointsPlaceholder'),
      error: null,
    };
  }

  if (mode === 'decode') {
    const decoded = decodeUnicode(trimmed, t);
    return {
      sourceLabel: t('tool-unicode.ui.codePoints'),
      targetLabel: t('tool-unicode.ui.plainText'),
      output: decoded.output,
      outputPlaceholder: t('tool-unicode.ui.decodedPlaceholder'),
      error: decoded.error,
    };
  }

  if (looksLikeUnicodeCodes(trimmed)) {
    const decoded = decodeUnicode(trimmed, t);
    return {
      sourceLabel: t('tool-unicode.ui.codePoints'),
      targetLabel: t('tool-unicode.ui.plainText'),
      output: decoded.output,
      outputPlaceholder: t('tool-unicode.ui.decodedPlaceholder'),
      error: decoded.error,
    };
  }

  return {
    sourceLabel: t('tool-unicode.ui.plainText'),
    targetLabel: t('tool-unicode.ui.codePoints'),
    output: encodeUnicode(input),
    outputPlaceholder: t('tool-unicode.ui.pointsPlaceholder'),
    error: null,
  };
}

export default function UnicodeConverter() {
  const { t } = useTranslation('tools');
  return (
    <AutoDetectConverter
      toolId="tool-unicode"
      kicker={t('navigation:categories.developer')}
      title={t('tool-unicode.title')}
      inputPlaceholder={t('tool-unicode.ui.placeholder')}
      emptyTargetLabel={t('tool-unicode.ui.converted')}
      analyze={(input, mode) => analyzeUnicode(input, mode, t)}
    />
  );
}
