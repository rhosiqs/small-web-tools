import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HTML,
  parseHtmlFragment,
  sanitizeHtmlNodes,
  sanitizeHtmlUrl,
} from '../components/GithubHtmlSnippets/lib/githubHtml.js';
import { composeDocument } from '../components/GithubHtmlSnippets/lib/composeDocument.js';
import {
  BLOCKS,
  fillTemplate,
  placeBlock,
  searchBlocks,
} from '../components/GithubHtmlSnippets/lib/blockCatalog.js';

const labelsFor = (blocks) => Object.fromEntries(blocks.map((block) => [block.id, block.id]));

describe('GitHub HTML parsing', () => {
  it('builds a tree and tolerates unclosed tags', () => {
    const nodes = parseHtmlFragment('<div align="center"><p>Hi<br />there</div>');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].tag).toBe('div');
    expect(nodes[0].attributes.align).toBe('center');
    const paragraph = nodes[0].children[0];
    expect(paragraph.tag).toBe('p');
    expect(paragraph.children.map((child) => child.tag ?? child.value)).toEqual(['Hi', 'br', 'there']);
  });

  it('lower-cases tag and attribute names', () => {
    const [node] = parseHtmlFragment('<DIV ALIGN="CENTER">x</DIV>');
    expect(node.tag).toBe('div');
    expect(node.attributes.align).toBe('CENTER');
  });
});

describe('GitHub HTML sanitizing', () => {
  it('drops executable tags together with their contents', () => {
    const result = sanitizeHtmlNodes(parseHtmlFragment('<p>keep</p><script>steal()</script>'));
    expect(result.droppedTags).toContain('script');
    expect(JSON.stringify(result.nodes)).not.toContain('steal');
  });

  it('unwraps an unknown tag but keeps the text inside it', () => {
    const result = sanitizeHtmlNodes(parseHtmlFragment('<font color="red">still here</font>'));
    expect(result.droppedTags).toEqual(['font']);
    expect(result.nodes).toEqual([{ type: 'text', value: 'still here' }]);
  });

  it('removes style attributes and reports them', () => {
    const result = sanitizeHtmlNodes(parseHtmlFragment('<p style="color:red" align="center">x</p>'));
    expect(result.nodes[0].attributes).toEqual({ align: 'center' });
    expect(result.droppedAttributes).toContain('style');
  });

  it('refuses javascript: URLs while keeping ordinary links', () => {
    expect(sanitizeHtmlUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeHtmlUrl('  https://example.com/a  ')).toBe('https://example.com/a');
    expect(sanitizeHtmlUrl('#top')).toBe('#top');
    expect(sanitizeHtmlUrl('//evil.example')).toBeNull();

    const result = sanitizeHtmlNodes(parseHtmlFragment('<a href="javascript:alert(1)">x</a>'));
    expect(result.nodes[0].attributes.href).toBeUndefined();
    expect(result.droppedAttributes).toContain('href');
  });

  it('keeps an attribute only on the tags that allow it', () => {
    const result = sanitizeHtmlNodes(parseHtmlFragment('<kbd align="center">Ctrl</kbd>'));
    expect(result.nodes[0].attributes).toEqual({});
    expect(ALLOWED_HTML.kbd).toEqual([]);
  });
});

describe('composing a README', () => {
  it('separates HTML blocks from Markdown and reports removals once', () => {
    const { segments, droppedTags } = composeDocument([
      '# Title',
      '',
      '<div align="center">',
      '  <video src="a.mp4"></video>',
      '</div>',
      '',
      'Trailing paragraph.',
    ].join('\n'));

    expect(segments.map((segment) => segment.kind)).toEqual(['markdown', 'html', 'markdown']);
    expect(droppedTags).toEqual(['video']);
  });

  it('keeps a details block whole across its blank lines', () => {
    const { segments } = composeDocument([
      '<details>',
      '<summary>More</summary>',
      '',
      'Hidden body.',
      '',
      '</details>',
    ].join('\n'));

    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('html');
    expect(segments[0].nodes[0].tag).toBe('details');
  });

  it('leaves HTML inside a fenced code block as Markdown', () => {
    const { segments, droppedTags } = composeDocument('```html\n<script>x()</script>\n```');
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('markdown');
    expect(segments[0].blocks[0].type).toBe('codeBlock');
    expect(droppedTags).toEqual([]);
  });
});

describe('block placement', () => {
  it('stacks a multi-line block below the caret line and leaves the caret after it', () => {
    const first = placeBlock('', 0, 0, '<hr />\n<p>x</p>');
    expect(first.stacked).toBe(true);
    expect(first.text).toBe('<hr />\n<p>x</p>\n');
    expect(first.selectionStart).toBe(first.selectionEnd);

    const second = placeBlock(first.text, first.selectionStart, first.selectionEnd, '<b>2</b>\n<i>2</i>');
    expect(second.text.startsWith('<hr />\n<p>x</p>')).toBe(true);
    expect(second.text).toContain('<b>2</b>');
    expect(second.text.indexOf('<b>2</b>')).toBeGreaterThan(second.text.indexOf('<p>x</p>'));
  });

  it('never splits the line the caret sits in', () => {
    const result = placeBlock('first line\nsecond line', 3, 3, '<hr />\n<hr />');
    expect(result.text.split('\n')[0]).toBe('first line');
  });

  it('places an inline block at the caret and selects it for typing over', () => {
    const result = placeBlock('press  now', 6, 6, '<kbd>Ctrl</kbd>');
    expect(result.stacked).toBe(false);
    expect(result.text).toBe('press <kbd>Ctrl</kbd> now');
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('<kbd>Ctrl</kbd>');
  });

  it('replaces the selected text rather than appending beside it', () => {
    const result = placeBlock('keep THIS out', 5, 9, '<kbd>THIS</kbd>');
    expect(result.text).toBe('keep <kbd>THIS</kbd> out');
  });
});

describe('block catalogue', () => {
  it('fills named slots and leaves unknown ones alone', () => {
    expect(fillTemplate('<p>{{selection}}</p>', { selection: 'hi' })).toBe('<p>hi</p>');
    expect(fillTemplate('{{missing}}', {})).toBe('{{missing}}');
  });

  it('gives every block a unique id and a template that uses only declared slots', () => {
    const ids = BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const block of BLOCKS) {
      const used = [...block.template.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
      const declared = new Set(['selection', ...(block.slots || [])]);
      for (const slot of used) expect(declared.has(slot), `${block.id} uses {{${slot}}}`).toBe(true);
      for (const slot of block.slots || []) {
        expect(block.template, `${block.id} declares unused slot ${slot}`).toContain(`{{${slot}}}`);
      }
    }
  });

  it('searches by translated label, tag, and group name', () => {
    const labels = labelsFor(BLOCKS);
    expect(searchBlocks('details', labels).map((block) => block.id)).toContain('details');
    expect(searchBlocks('alerts', labels).every((block) => block.group === 'alerts')).toBe(true);
    expect(searchBlocks('<kbd>', labels).map((block) => block.id)).toEqual(['kbd']);
    expect(searchBlocks('', labels)).toHaveLength(BLOCKS.length);
  });

  it('renders every block into HTML the sanitizer keeps, except the ones that teach a removal', () => {
    const teachRemoval = new Set(['coloured-text', 'inline-style', 'video', 'highlight']);
    for (const block of BLOCKS) {
      const values = { selection: 'x' };
      for (const slot of block.slots || []) values[slot] = 'y';
      const { droppedTags, droppedAttributes } = composeDocument(fillTemplate(block.template, values));
      const removals = [...droppedTags, ...droppedAttributes];
      if (teachRemoval.has(block.id)) expect(removals.length, block.id).toBeGreaterThan(0);
      else expect(removals, block.id).toEqual([]);
    }
  });
});
