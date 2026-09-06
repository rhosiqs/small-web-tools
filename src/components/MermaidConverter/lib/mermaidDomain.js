export const MERMAID_SOURCE_LIMIT = 100_000;
export const MERMAID_STATEMENT_LIMIT = 1_000;
export const PNG_SCALES = [1, 2, 3];
export const MAX_PNG_PIXELS = 32_000_000;

const SAFE_FILENAME = /[^a-z0-9._-]+/gi;
const BLOCKED_ELEMENTS = 'script,foreignObject,iframe,object,embed,image,audio,video,canvas';
const UNSAFE_VALUE = /(?:javascript:|vbscript:|data:text\/html|@import|-moz-binding|expression\s*\()/i;
const UNSAFE_STYLESHEET = /(?:@import\b|-moz-binding\s*:|expression\s*\()/i;
const EXTERNAL_RESOURCE_FUNCTION = /(?:image-set|-webkit-image-set|cross-fade)\s*\(/i;
const RESOURCE_URL = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\)/gi;
const FRAGMENT_REFERENCE = /^#[^\s'"()]+$/;
const CSS_ESCAPE = /\\(?:[0-9a-f]{1,6}\s?|.)/i;
let mermaidPromise;
let renderCounter = 0;

export function normalizeMermaidFilename(value, extension = 'mmd') {
  const base = String(value || 'diagram').trim().replace(/\.(?:mmd|svg|png)$/i, '') || 'diagram';
  const safe = base.replace(SAFE_FILENAME, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'diagram';
  return `${safe}.${extension}`;
}

export function validateMermaidSource(source) {
  const text = String(source ?? '');
  if (!text.trim()) throw new Error('empty');
  if (new Blob([text]).size > MERMAID_SOURCE_LIMIT) throw new Error('tooLarge');
  const statements = text.split(/\r?\n|;/).filter((line) => line.trim() && !line.trim().startsWith('%%'));
  if (statements.length > MERMAID_STATEMENT_LIMIT) throw new Error('tooManyNodes');
  return text;
}

async function loadMermaid() {
  mermaidPromise ??= import('mermaid').then((module) => module.default ?? module);
  const mermaid = await mermaidPromise;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    suppressErrorRendering: true,
    deterministicIds: true,
    deterministicIDSeed: 'small-web-tools-mermaid',
    maxTextSize: MERMAID_SOURCE_LIMIT,
    maxEdges: MERMAID_STATEMENT_LIMIT,
    theme: 'base',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  return mermaid;
}

function unwrapLinks(document) {
  for (const link of [...document.querySelectorAll('a')]) {
    link.replaceWith(...link.childNodes);
  }
}

// `url(#id)` addresses a paint server inside this same SVG, so it loads nothing;
// every other `url()` target can reach the network and stays blocked.
function loadsExternalResource(css) {
  if (EXTERNAL_RESOURCE_FUNCTION.test(css)) return true;
  for (const match of css.matchAll(RESOURCE_URL)) {
    const target = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!FRAGMENT_REFERENCE.test(target)) return true;
  }
  return false;
}

function sanitizeStyleElements(document) {
  for (const style of [...document.querySelectorAll('style')]) {
    const stylesheet = (style.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (UNSAFE_STYLESHEET.test(stylesheet) || loadsExternalResource(stylesheet) || CSS_ESCAPE.test(stylesheet)) {
      style.remove();
    }
  }
}

function sanitizeAttributes(document) {
  for (const element of [...document.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || UNSAFE_VALUE.test(value)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === 'href' || name === 'xlink:href') && !value.startsWith('#')) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if ((name === 'src' || name === 'srcset') && value) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'style' && (loadsExternalResource(value) || CSS_ESCAPE.test(value))) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function resolveDimensions(root) {
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  let width = Number.parseFloat(root.getAttribute('width') || '');
  let height = Number.parseFloat(root.getAttribute('height') || '');
  if ((!Number.isFinite(width) || !Number.isFinite(height)) && viewBox?.length === 4) {
    width = viewBox[2];
    height = viewBox[3];
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('invalidSvg');
  }
  width = Math.ceil(width);
  height = Math.ceil(height);
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return { width, height };
}

export function sanitizeMermaidSvg(svg, options = {}) {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(svg), 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('invalidSvg');
  const root = document.documentElement;
  if (root.localName !== 'svg') throw new Error('invalidSvg');

  document.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => element.remove());
  unwrapLinks(document);
  sanitizeStyleElements(document);
  sanitizeAttributes(document);

  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', options.ariaLabel || 'Mermaid diagram');
  const dimensions = resolveDimensions(root);
  const background = options.background === 'transparent' ? 'transparent' : (options.background || '#ffffff');
  if (background !== 'transparent') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('data-export-background', 'true');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', background);
    root.insertBefore(rect, root.firstChild);
  }

  return {
    svg: new XMLSerializer().serializeToString(root),
    ...dimensions,
    background,
  };
}

export async function renderMermaidToSvg(source, options = {}) {
  const text = validateMermaidSource(source);
  await document.fonts?.ready;
  const mermaid = await loadMermaid();
  const id = `mermaid-${Date.now().toString(36)}-${(renderCounter += 1).toString(36)}`;
  try {
    await mermaid.parse(text, { suppressErrors: false });
    const result = await mermaid.render(id, text);
    return sanitizeMermaidSvg(result.svg, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/maximum text size|too many edges/i.test(message)) throw new Error('tooLarge');
    throw new Error('parseError');
  } finally {
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
  }
}

export function downloadBlob(content, type, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function svgToPngBlob(render, scale = 2) {
  const boundedScale = PNG_SCALES.includes(Number(scale)) ? Number(scale) : 2;
  const pixelCount = render.width * render.height * boundedScale * boundedScale;
  if (pixelCount > MAX_PNG_PIXELS) throw new Error('pngTooLarge');
  const blob = new Blob([render.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('pngFailed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = render.width * boundedScale;
    canvas.height = render.height * boundedScale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('pngFailed');
    context.scale(boundedScale, boundedScale);
    context.drawImage(image, 0, 0, render.width, render.height);
    return await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('pngFailed')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
