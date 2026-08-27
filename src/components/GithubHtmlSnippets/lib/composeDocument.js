import { parseMarkdown } from '../../MarkdownPreviewer/lib/markdownDomain.js';
import { parseHtmlFragment, sanitizeHtmlNodes } from './githubHtml.js';

/**
 * Splits a README into the two kinds of thing it is made of, so each half is
 * handled by the parser that understands it.
 *
 * Markdown parsing is deliberately borrowed from the Markdown Previewer's domain
 * module rather than reimplemented — a second Markdown parser in the same
 * codebase would drift. The HTML half is this tool's own, because the Previewer
 * shows HTML as text where this tool has to render it.
 */

const HTML_LINE = /^\s*<[a-zA-Z!/]/;
const VOID_OR_SELF_CLOSING = /<\s*(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b|\/\s*>/i;
const ANY_TAG = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;

/**
 * How far an HTML block runs. Depth decides it, so a `<details>` holding blank
 * lines and Markdown stays one block; an already-balanced opening line ends
 * where a blank line ends it, the way Markdown's own HTML blocks behave.
 */
function readHtmlBlock(lines, start) {
  let depth = 0;
  let index = start;

  do {
    const line = lines[index];
    for (const match of line.matchAll(ANY_TAG)) {
      const [raw, closing, name] = match;
      if (VOID_OR_SELF_CLOSING.test(raw) && !closing) continue;
      if (name.startsWith('!')) continue;
      depth += closing ? -1 : 1;
    }
    index += 1;
  } while (index < lines.length && (depth > 0 || (lines[index].trim() !== '' && HTML_LINE.test(lines[index]))));

  return index;
}

/**
 * Turns source text into an ordered list of renderable segments plus the single
 * list of everything GitHub would remove from it.
 *
 * @returns {{ segments: Array<object>, droppedTags: string[], droppedAttributes: string[] }}
 */
export function composeDocument(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  const droppedTags = new Set();
  const droppedAttributes = new Set();

  let index = 0;
  let markdownBuffer = [];

  const flushMarkdown = () => {
    if (markdownBuffer.length === 0) return;
    const blocks = parseMarkdown(markdownBuffer.join('\n'));
    if (blocks.length > 0) segments.push({ kind: 'markdown', blocks });
    markdownBuffer = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    // A fenced block wins over the HTML scan: `<div>` inside a fence is sample
    // code, not markup to render.
    if (/^\s*```/.test(line)) {
      markdownBuffer.push(lines[index]);
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        markdownBuffer.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        markdownBuffer.push(lines[index]);
        index += 1;
      }
      continue;
    }

    if (HTML_LINE.test(line)) {
      flushMarkdown();
      const end = readHtmlBlock(lines, index);
      const sanitized = sanitizeHtmlNodes(parseHtmlFragment(lines.slice(index, end).join('\n')));
      sanitized.droppedTags.forEach((tag) => droppedTags.add(tag));
      sanitized.droppedAttributes.forEach((attribute) => droppedAttributes.add(attribute));
      if (sanitized.nodes.length > 0) segments.push({ kind: 'html', nodes: sanitized.nodes });
      index = end;
      continue;
    }

    markdownBuffer.push(line);
    index += 1;
  }

  flushMarkdown();

  return {
    segments,
    droppedTags: [...droppedTags].sort(),
    droppedAttributes: [...droppedAttributes].sort(),
  };
}
