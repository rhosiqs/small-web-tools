/**
 * The HTML half of the GitHub HTML Blocks tool.
 *
 * README HTML is parsed into a plain node tree and filtered against an
 * allow-list before anything reaches React. Nothing here produces markup
 * strings, so no caller can route the result into `dangerouslySetInnerHTML`.
 *
 * The allow-list doubles as the tool's advice: whatever the sanitizer removes is
 * what GitHub's own pipeline removes, so `sanitizeHtmlNodes` reports its
 * removals and the UI shows them instead of maintaining a second hand-written
 * list that could drift from the parser.
 */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

/**
 * Removed together with their contents: these can execute code, reach the
 * network, or collect input, so keeping their text would be worse than losing
 * it. GitHub drops the same set.
 */
const DISCARDED_TAGS = new Set([
  'applet', 'audio', 'base', 'button', 'canvas', 'embed', 'form', 'frame',
  'frameset', 'iframe', 'input', 'link', 'math', 'meta', 'noscript', 'object',
  'portal', 'script', 'select', 'style', 'svg', 'template', 'textarea',
  'track', 'video',
]);

/** Tag to the attributes GitHub keeps on it. An empty list means no attributes. */
export const ALLOWED_HTML = Object.freeze({
  a: ['href', 'id', 'name', 'title'],
  abbr: ['title'],
  b: [], blockquote: ['cite'], br: [], code: [], dd: [], del: ['cite'],
  details: ['open'], div: ['align', 'id'], dl: [], dt: [], em: [],
  h1: ['align', 'id'], h2: ['align', 'id'], h3: ['align', 'id'],
  h4: ['align', 'id'], h5: ['align', 'id'], h6: ['align', 'id'],
  hr: [], i: [],
  img: ['align', 'alt', 'height', 'src', 'title', 'width'],
  ins: ['cite'], kbd: [], li: [], ol: ['start'], p: ['align'], picture: [],
  pre: [], q: ['cite'], s: [], samp: [], source: ['media', 'srcset', 'type'],
  span: [], strong: [], sub: [], summary: [], sup: [],
  table: ['align'], tbody: [], td: ['align', 'colspan', 'rowspan'], tfoot: [],
  th: ['align', 'colspan', 'rowspan'], thead: [], tr: [], u: [], ul: [], var: [],
});

/** Attributes carrying a URL, which needs its own scheme check. */
const URL_ATTRIBUTES = new Set(['cite', 'href', 'src', 'srcset']);

const TAG_PATTERN = /<(\/)?([a-zA-Z][\w-]*)((?:\s+[^\s/>"'=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/)?>/g;
const ATTRIBUTE_PATTERN = /([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const UNSAFE_URL_CHARACTERS = /[\u0000-\u0020]/;

/**
 * Keeps http(s), mailto, and document-relative targets. Anything with another
 * scheme — `javascript:` above all — is refused rather than rewritten.
 */
export function sanitizeHtmlUrl(value) {
  const href = String(value).trim();
  if (!href || href.startsWith('//') || UNSAFE_URL_CHARACTERS.test(href)) return null;
  const scheme = href.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && !['http', 'https', 'mailto'].includes(scheme)) return null;
  return href;
}

function parseAttributes(source) {
  const attributes = {};
  if (!source) return attributes;
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    if (!name) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function appendText(parent, value) {
  if (!value) return;
  const previous = parent.children[parent.children.length - 1];
  if (previous?.type === 'text') previous.value += value;
  else parent.children.push({ type: 'text', value });
}

/**
 * Parses an HTML fragment into `{ type: 'element' | 'text' }` nodes. Unclosed
 * and mismatched tags are tolerated the way a browser tolerates them, because
 * half-typed markup is the normal state of an editor.
 */
export function parseHtmlFragment(source) {
  const text = String(source);
  const root = { children: [] };
  const stack = [root];
  let cursor = 0;

  for (const match of text.matchAll(TAG_PATTERN)) {
    const index = match.index ?? 0;
    appendText(stack[stack.length - 1], text.slice(cursor, index));
    cursor = index + match[0].length;

    const [, closing, rawName, rawAttributes, selfClosing] = match;
    const tag = rawName.toLowerCase();

    if (closing) {
      const open = stack.findLastIndex((node) => node.tag === tag);
      if (open > 0) stack.length = open;
      continue;
    }

    const node = { type: 'element', tag, attributes: parseAttributes(rawAttributes), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !VOID_TAGS.has(tag)) stack.push(node);
  }

  appendText(stack[stack.length - 1], text.slice(cursor));
  return root.children;
}

/**
 * Filters a parsed tree against the allow-list.
 *
 * A dangerous tag is dropped with its contents; any other unknown tag is
 * unwrapped so its text survives, which is what GitHub does to `<font>` and
 * friends. Both cases are reported so the tool can tell the reader what a real
 * README would lose.
 */
export function sanitizeHtmlNodes(nodes) {
  const droppedTags = new Set();
  const droppedAttributes = new Set();

  const walk = (list) => list.flatMap((node) => {
    if (node.type === 'text') return node.value ? [node] : [];

    if (DISCARDED_TAGS.has(node.tag)) {
      droppedTags.add(node.tag);
      return [];
    }

    const allowed = ALLOWED_HTML[node.tag];
    if (!allowed) {
      droppedTags.add(node.tag);
      return walk(node.children);
    }

    const attributes = {};
    for (const [name, value] of Object.entries(node.attributes)) {
      if (!allowed.includes(name)) {
        droppedAttributes.add(name);
        continue;
      }
      if (URL_ATTRIBUTES.has(name)) {
        const url = sanitizeHtmlUrl(value);
        if (url === null) {
          droppedAttributes.add(name);
          continue;
        }
        attributes[name] = url;
        continue;
      }
      attributes[name] = value;
    }

    return [{ type: 'element', tag: node.tag, attributes, children: walk(node.children) }];
  });

  return {
    nodes: walk(nodes),
    droppedTags: [...droppedTags].sort(),
    droppedAttributes: [...droppedAttributes].sort(),
  };
}
