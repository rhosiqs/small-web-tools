const TABLE_DELIMITER_PATTERN = /^:?-{3,}:?$/;

export const MARKDOWN_FILE_LIMIT_BYTES = 2 * 1024 * 1024;

export function sanitizeMarkdownLink(value) {
  const href = value.trim();
  if (!href || href.startsWith('//') || /[\u0000-\u001f\s]/.test(href)) return null;
  const scheme = href.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && !['http', 'https', 'mailto'].includes(scheme)) return null;
  return href;
}

export function normalizeMarkdownFilename(value) {
  const withoutExtension = value.trim().replace(/\.(?:md|markdown)$/i, '');
  const safeBase = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/g, '')
    .slice(0, 120);
  return `${safeBase || 'document'}.md`;
}

/**
 * Hosts whose images may appear in the preview. The list mirrors the `img-src`
 * directive in `public/_headers` and the `markdownimages` entry in
 * `config/network-services.json`; an image is only fetched when the host
 * appears in all three, so keep them in step.
 */
export const REMOTE_IMAGE_HOSTS = Object.freeze([
  'img.shields.io',
  'badgen.net',
  'github.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
]);

export const REMOTE_IMAGE_SERVICE_ID = 'markdownimages';

const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

/**
 * Dropped together with their contents. These can run code, reach the network,
 * or collect input, so keeping their text would be worse than losing it.
 */
const DISCARDED_HTML_TAGS = new Set([
  'applet', 'audio', 'base', 'button', 'canvas', 'embed', 'form', 'frame', 'frameset',
  'iframe', 'input', 'link', 'math', 'meta', 'noscript', 'object', 'portal', 'script',
  'select', 'source', 'style', 'svg', 'template', 'textarea', 'track', 'video',
]);

/** Tag to the attributes it may keep. A tag absent here loses itself but keeps its text. */
const ALLOWED_HTML_ATTRIBUTES = {
  a: ['href', 'title'], abbr: ['title'], b: [], blockquote: [], br: [], caption: [],
  center: [], cite: [], code: [], dd: [], del: [], details: ['open'], div: ['align'],
  dl: [], dt: [], em: [], figcaption: [], figure: [], h1: ['align'], h2: ['align'],
  h3: ['align'], h4: ['align'], h5: ['align'], h6: ['align'], hr: [], i: [],
  img: ['src', 'alt', 'title', 'width', 'height', 'align'], ins: [], kbd: [], li: [],
  mark: [], ol: ['start'], p: ['align'], picture: [], pre: [], q: [], s: [], samp: [],
  small: [], span: [], strong: [], sub: [], summary: [], sup: [], table: ['align'],
  tbody: [], td: ['align', 'colspan', 'rowspan'], tfoot: [], th: ['align', 'colspan', 'rowspan'],
  thead: [], tr: [], u: [], ul: [],
};

const HTML_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const NUMERIC_HTML_ATTRIBUTES = new Set(['width', 'height', 'colspan', 'rowspan', 'start']);
const HTML_TAG_PATTERN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
const HTML_ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const HTML_NAMED_ENTITIES = {
  amp: '&', apos: "'", copy: '©', gt: '>', hellip: '…', lt: '<',
  mdash: '—', nbsp: ' ', ndash: '–', quot: '"', reg: '®', times: '×',
};

function decodeHtmlEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (raw, body) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : raw;
    }
    return HTML_NAMED_ENTITIES[body.toLowerCase()] ?? raw;
  });
}

function parseHtmlAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(HTML_ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    if (name in attributes) continue;
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

/**
 * Split raw markup into text, comments, and tags. Anything that does not match
 * the tag shape stays text, so prose such as `3 < 5` survives untouched.
 */
function scanHtml(input) {
  const tokens = [];
  let cursor = 0;

  for (const match of input.matchAll(HTML_TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'text', value: input.slice(cursor, index) });
    const raw = match[0];
    if (raw.startsWith('<!--')) {
      tokens.push({ kind: 'comment' });
    } else {
      const [, closing, name, attributes, selfClosing] = raw.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*?)(\/?)>$/);
      const tag = name.toLowerCase();
      tokens.push({
        kind: closing ? 'close' : 'open',
        name: tag,
        attributes: closing ? {} : parseHtmlAttributes(attributes),
        selfClosing: Boolean(selfClosing) || VOID_HTML_TAGS.has(tag),
      });
    }
    cursor = index + raw.length;
  }

  if (cursor < input.length) tokens.push({ kind: 'text', value: input.slice(cursor) });
  return tokens;
}

/** Build a tree, closing anything the author left open rather than discarding it. */
function buildHtmlTree(tokens) {
  const root = { name: '#root', children: [] };
  const stack = [root];

  for (const token of tokens) {
    const parent = stack[stack.length - 1];
    if (token.kind === 'comment') continue;
    if (token.kind === 'text') {
      parent.children.push({ type: 'text', value: token.value });
      continue;
    }
    if (token.kind === 'open') {
      const node = { type: 'element', name: token.name, attributes: token.attributes, children: [] };
      parent.children.push(node);
      if (!token.selfClosing) stack.push(node);
      continue;
    }
    const openIndex = [...stack].reverse().findIndex((candidate) => candidate.name === token.name);
    if (openIndex < 0) continue;
    stack.length -= openIndex + 1;
  }

  return root.children;
}

/**
 * Decide how an image should appear. Nothing is fetched unless the reader has
 * granted consent and the host is one the content policy can actually load.
 */
export function resolveImagePresentation(href, { allowRemoteImages = false } = {}) {
  if (!href) return { render: false, reason: 'unsupported' };
  if (!/^https?:/i.test(href)) return { render: false, reason: 'relative' };
  let hostname = '';
  try {
    hostname = new URL(href).hostname.toLowerCase();
  } catch {
    return { render: false, reason: 'unsupported' };
  }
  if (!REMOTE_IMAGE_HOSTS.includes(hostname)) return { render: false, reason: 'blockedHost' };
  if (!allowRemoteImages) return { render: false, reason: 'consent' };
  return { render: true, reason: null };
}

function sanitizeHtmlAttributes(name, attributes) {
  const allowed = ALLOWED_HTML_ATTRIBUTES[name];
  const kept = {};

  for (const [attribute, value] of Object.entries(attributes)) {
    if (!allowed.includes(attribute)) continue;
    if (attribute === 'align' && !HTML_ALIGNMENTS.has(value.toLowerCase())) continue;
    if (NUMERIC_HTML_ATTRIBUTES.has(attribute) && !/^\d{1,4}$/.test(value)) continue;
    if (attribute === 'href') {
      const href = sanitizeMarkdownLink(value);
      if (href) kept.href = href;
      continue;
    }
    kept[attribute] = attribute === 'align' ? value.toLowerCase() : value;
  }

  return kept;
}

function sanitizeHtmlNodes(nodes, options) {
  const sanitized = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.value.trim()) {
        sanitized.push({ type: 'inline', inline: tokenizeInlineMarkdown(decodeHtmlEntities(node.value), options) });
      }
      continue;
    }

    const { name } = node;
    if (DISCARDED_HTML_TAGS.has(name)) continue;
    if (!ALLOWED_HTML_ATTRIBUTES[name]) {
      sanitized.push(...sanitizeHtmlNodes(node.children, options));
      continue;
    }

    const attributes = sanitizeHtmlAttributes(name, node.attributes);

    if (name === 'img') {
      const src = sanitizeMarkdownLink(node.attributes.src || '');
      const presentation = resolveImagePresentation(src, options);
      sanitized.push({
        type: 'image',
        alt: node.attributes.alt || '',
        href: src,
        title: attributes.title,
        width: attributes.width,
        height: attributes.height,
        ...presentation,
      });
      continue;
    }

    if (name === 'a' && !attributes.href) {
      sanitized.push(...sanitizeHtmlNodes(node.children, options));
      continue;
    }

    sanitized.push({
      type: 'element',
      name,
      attributes,
      children: sanitizeHtmlNodes(node.children, options),
    });
  }

  return sanitized;
}

/**
 * Turn raw markup into the node tree the preview renders. The tree is built
 * from an allow list and never reaches `innerHTML`, so the renderer creates
 * every element itself.
 */
export function parseHtmlFragment(html, options = {}) {
  return sanitizeHtmlNodes(buildHtmlTree(scanHtml(html)), options);
}

export function tokenizeInlineMarkdown(value, options = {}) {
  const tokens = [];
  const pattern = /(`[^`\n]+`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ type: 'text', value: value.slice(cursor, index) });

    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('![')) {
      const href = sanitizeMarkdownLink(match[3] || '');
      tokens.push({
        type: 'image',
        alt: match[2] || '',
        href,
        ...resolveImagePresentation(href, options),
      });
    } else if (raw.startsWith('[')) {
      tokens.push({
        type: 'link',
        value: match[4] || '',
        href: sanitizeMarkdownLink(match[5] || ''),
      });
    } else if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ type: 'strong', value: match[6] || match[7] || '' });
    } else if (raw.startsWith('~~')) {
      tokens.push({ type: 'strike', value: match[8] || '' });
    } else {
      tokens.push({ type: 'emphasis', value: match[9] || match[10] || '' });
    }
    cursor = index + raw.length;
  }

  if (cursor < value.length) tokens.push({ type: 'text', value: value.slice(cursor) });
  return tokens;
}

/**
 * Tokenize a run that may mix Markdown with inline HTML. The markup is scanned
 * first so a tag can wrap Markdown (`<b>**bold**</b>`) without either syntax
 * confusing the other.
 */
function tokenizeInline(value, options) {
  if (!value.includes('<')) return tokenizeInlineMarkdown(value, options);

  const tokens = [];
  for (const node of parseHtmlFragment(value, options)) {
    if (node.type === 'inline') tokens.push(...node.inline);
    else if (node.type === 'image') tokens.push(node);
    else tokens.push({ type: 'html', node });
  }
  return tokens;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableDelimiter(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => TABLE_DELIMITER_PATTERN.test(cell));
}

function parseListItem(line, options) {
  const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
  const content = unordered?.[1] || ordered?.[1];
  if (!content) return null;

  const task = content.match(/^\[([ xX])\]\s+(.+)$/);
  return {
    ordered: Boolean(ordered),
    task: Boolean(task),
    checked: task ? task[1].toLowerCase() === 'x' : false,
    inline: tokenizeInline(task ? task[2] : content, options),
  };
}

function startsHtmlBlock(line) {
  const match = line.match(/^\s{0,3}<(!--|\/?([a-zA-Z][a-zA-Z0-9-]*))/);
  if (!match) return false;
  if (match[1] === '!--') return true;
  const name = match[2].toLowerCase();
  return Boolean(ALLOWED_HTML_ATTRIBUTES[name]) || DISCARDED_HTML_TAGS.has(name);
}

/**
 * Collect the lines of an HTML block. CommonMark ends such a block at the first
 * blank line, which splits the centred header most README files open with, so
 * the block runs to its matching closing tag instead. Markup left unclosed
 * stops at the next Markdown heading or fence rather than swallowing the rest
 * of the document.
 */
function collectHtmlBlock(lines, start) {
  const raw = [];
  let index = start;
  let depth = 0;

  while (index < lines.length) {
    if (index > start && depth > 0 && /^(?:#{1,6}\s|\s*```)/.test(lines[index])) break;
    raw.push(lines[index]);
    index += 1;
    for (const token of scanHtml(lines[index - 1])) {
      if (token.kind === 'open' && !token.selfClosing) depth += 1;
      else if (token.kind === 'close') depth -= 1;
    }
    if (depth <= 0) break;
  }

  return { raw: raw.join('\n'), next: index };
}

export function parseMarkdown(markdown, options = {}) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const startLine = index;
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: 'codeBlock',
        language: fence[1] || '',
        value: code.join('\n'),
        startLine,
        endLine: Math.max(startLine, index - 1),
      });
      continue;
    }

    if (startsHtmlBlock(line)) {
      const { raw, next } = collectHtmlBlock(lines, index);
      index = next;
      const nodes = parseHtmlFragment(raw, options);
      if (nodes.length > 0) blocks.push({ type: 'html', nodes, startLine, endLine: index - 1 });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        inline: tokenizeInline(heading[2].replace(/\s+#+\s*$/, ''), options),
        startLine,
        endLine: startLine,
      });
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) {
      blocks.push({ type: 'rule', startLine, endLine: startLine });
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDelimiter(lines[index + 1])) {
      const header = splitTableRow(line).map((cell) => tokenizeInline(cell, options));
      const alignments = splitTableRow(lines[index + 1]).map((cell) => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        return 'left';
      });
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]).map((cell) => tokenizeInline(cell, options)));
        index += 1;
      }
      blocks.push({ type: 'table', header, alignments, rows, startLine, endLine: index - 1 });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push({
        type: 'quote',
        inline: tokenizeInline(quote.join('\n'), options),
        startLine,
        endLine: index - 1,
      });
      continue;
    }

    const firstListItem = parseListItem(line, options);
    if (firstListItem) {
      const items = [firstListItem];
      index += 1;
      while (index < lines.length) {
        const nextItem = parseListItem(lines[index], options);
        if (!nextItem || nextItem.ordered !== firstListItem.ordered) break;
        items.push(nextItem);
        index += 1;
      }
      blocks.push({
        type: 'list',
        ordered: firstListItem.ordered,
        items,
        startLine,
        endLine: index - 1,
      });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(?:#{1,6}\s+|\s*```|\s*>|\s*[-+*]\s+|\s*\d+[.)]\s+)/.test(lines[index])
      && !startsHtmlBlock(lines[index])
      && !(lines[index].includes('|') && index + 1 < lines.length && isTableDelimiter(lines[index + 1]))
    ) {
      const previous = paragraph[paragraph.length - 1];
      paragraph[paragraph.length - 1] = previous.endsWith('  ') ? `${previous.trimEnd()}\n` : `${previous} `;
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({
      type: 'paragraph',
      inline: tokenizeInline(paragraph.join('').trim(), options),
      startLine,
      endLine: index - 1,
    });
  }

  return blocks;
}
