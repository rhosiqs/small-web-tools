const BLOCKED_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
]);

const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src']);
const LENGTH_WITH_ABSOLUTE_UNIT = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(px|in|cm|mm|q|pt|pc)?\s*$/i;
// CSS absolute units expressed in CSS pixels (96 per inch), the unit an SVG user unit maps to.
const PIXELS_PER_UNIT = {
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
  pt: 96 / 72,
  pc: 16,
};
// A stylesheet is kept only when it cannot reach outside the SVG; CSS escapes are
// rejected because they can disguise `url(` or `@import` from these checks.
const UNSAFE_STYLESHEET = /(?:@import\b|-moz-binding\s*:|expression\s*\(|image-set\s*\(|cross-fade\s*\(|\\)/i;

function hasUnsafeUrl(value) {
  return value !== '' && !value.startsWith('#') && !value.startsWith('data:image/');
}

function hasUnsafeCssUrl(value) {
  return [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
    .some((match) => hasUnsafeUrl(match[2].trim()));
}

function hasUnsafeStylesheet(element) {
  const css = (element.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
  return UNSAFE_STYLESHEET.test(css) || hasUnsafeCssUrl(css);
}

function parseLength(value) {
  const match = String(value || '').match(LENGTH_WITH_ABSOLUTE_UNIT);
  if (!match) return null;
  const parsed = Number(match[1]) * PIXELS_PER_UNIT[(match[2] || 'px').toLowerCase()];
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) / 1000 : null;
}

function parseViewBox(value) {
  const parts = String(value || '').trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [, , width, height] = parts;
  return width > 0 && height > 0 ? { width, height } : null;
}

export function inspectAndSanitizeSvg(markup) {
  if (!markup.trim()) return { error: 'Paste SVG markup or choose an SVG file.' };

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) {
    return { error: 'The SVG markup is not valid XML.' };
  }

  const svg = documentNode.documentElement;
  if (svg.localName.toLowerCase() !== 'svg') {
    return { error: 'The document must have an <svg> root element.' };
  }

  let removedItems = 0;
  [...svg.querySelectorAll('*')].forEach((element) => {
    const localName = element.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(localName) || (localName === 'style' && hasUnsafeStylesheet(element))) {
      element.remove();
      removedItems += 1;
      return;
    }

    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const isUnsafe = name.startsWith('on')
        || (URL_ATTRIBUTES.has(name) && hasUnsafeUrl(value))
        || ((name === 'style' || name === 'fill' || name === 'stroke') && hasUnsafeCssUrl(value));
      if (isUnsafe) {
        element.removeAttribute(attribute.name);
        removedItems += 1;
      }
    });
  });

  [...svg.attributes].forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim();
    if (
      name.startsWith('on')
      || (URL_ATTRIBUTES.has(name) && hasUnsafeUrl(value))
      || ((name === 'style' || name === 'fill' || name === 'stroke') && hasUnsafeCssUrl(value))
    ) {
      svg.removeAttribute(attribute.name);
      removedItems += 1;
    }
  });

  const viewBox = parseViewBox(svg.getAttribute('viewBox'));
  const width = parseLength(svg.getAttribute('width')) || viewBox?.width || 512;
  const height = parseLength(svg.getAttribute('height')) || viewBox?.height || 512;

  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  // An explicit pixel size gives the image an intrinsic size, which some browsers
  // require before they will draw an SVG into a canvas.
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  return {
    markup: new XMLSerializer().serializeToString(svg),
    width,
    height,
    removedItems,
  };
}

export function calculateLockedDimension(changedAxis, value, ratio) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }
  return changedAxis === 'width'
    ? Math.max(1, Math.round(parsed / ratio))
    : Math.max(1, Math.round(parsed * ratio));
}

export function validateExportSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return 'Width and height must be positive whole numbers.';
  }
  if (width > 8192 || height > 8192) return 'Each dimension must be 8,192 pixels or less.';
  if (width * height > 40_000_000) return 'The output must be 40 megapixels or less.';
  return '';
}
