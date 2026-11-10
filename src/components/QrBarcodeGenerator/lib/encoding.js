export function escapeWifiString(value) {
  if (!value) return '';
  return value.replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/"/g, '\\"');
}

// Escapes text for an XML text node or a double-quoted attribute value.
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function estimateTextWidth(text, fontSize, weight) {
  const ratio = weight === 'bold' || weight === 'bolder' ? 0.62 : 0.55;
  return text.length * fontSize * ratio;
}

export function validateBarcode(value, format) {
  if (!value) return 'Input cannot be empty';
  const rules = {
    EAN13: [/^\d{12,13}$/, 'EAN-13 must be 12 or 13 digits'],
    EAN8: [/^\d{7,8}$/, 'EAN-8 must be 7 or 8 digits'],
    UPC: [/^\d{11,12}$/, 'UPC-A must be 11 or 12 digits'],
    CODE39: [/^[0-9A-Z\-.\s$/+%=]+$/, 'Code 39 only supports A-Z (uppercase), 0-9, space, and characters: - . $ / + % ='],
    CODABAR: [/^[0-9\-$:/.+ABCD]+$/i, 'Codabar only supports digits, - $ : / . +, and A/B/C/D start/stop characters'],
  };
  if (format === 'ITF') {
    if (!/^\d+$/.test(value)) return 'ITF must be digits only';
    if (value.length % 2 !== 0) return 'ITF must contain an even number of digits';
    return null;
  }
  const rule = rules[format];
  if (rule && !rule[0].test(format === 'CODE39' ? value.toUpperCase() : value)) return rule[1];
  if ((!rule || format === 'CODE128') && /[^\x00-\x7F]/.test(value)) {
    return 'Code 128 only supports standard ASCII characters';
  }
  return null;
}
