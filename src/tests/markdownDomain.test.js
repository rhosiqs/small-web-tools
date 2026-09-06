import { describe, expect, it } from 'vitest';
import {
  normalizeMarkdownFilename,
  parseMarkdown,
  sanitizeMarkdownLink,
  tokenizeInlineMarkdown,
} from '../components/MarkdownPreviewer/lib/markdownDomain.js';

describe('Markdown preview domain', () => {
  it('parses headings, paragraphs, quotes, rules, lists, and fenced code', () => {
    const blocks = parseMarkdown([
      '# Title',
      '',
      'A **bold** paragraph.',
      '',
      '> Quoted text',
      '',
      '- [x] Complete',
      '- Pending',
      '',
      '---',
      '',
      '```js',
      'const value = 1;',
      '```',
    ].join('\n'));

    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'rule',
      'codeBlock',
    ]);
    expect(blocks[3].items).toMatchObject([
      { task: true, checked: true },
      { task: false, checked: false },
    ]);
    expect(blocks[5]).toMatchObject({ language: 'js', value: 'const value = 1;' });
    expect(blocks[5]).toMatchObject({ startLine: 11, endLine: 13 });
  });

  it('parses tables with column alignment', () => {
    const [table] = parseMarkdown([
      '| Name | Score |',
      '| :--- | ---: |',
      '| Alice | 10 |',
    ].join('\n'));

    expect(table.type).toBe('table');
    expect(table.alignments).toEqual(['left', 'right']);
    expect(table.rows).toHaveLength(1);
  });

  it('tokenizes inline Markdown while rejecting unsafe links', () => {
    const tokens = tokenizeInlineMarkdown(
      '**bold** *italic* `code` [safe](https://example.com) [unsafe](javascript:alert(1))',
    );

    expect(tokens.map((token) => token.type)).toEqual([
      'strong',
      'text',
      'emphasis',
      'text',
      'code',
      'text',
      'link',
      'text',
      'link',
      'text',
    ]);
    expect(tokens.filter((token) => token.type === 'link').map((token) => token.href))
      .toEqual(['https://example.com', null]);
    expect(sanitizeMarkdownLink('data:text/html,unsafe')).toBeNull();
    expect(sanitizeMarkdownLink('docs/guide.md')).toBe('docs/guide.md');
    expect(sanitizeMarkdownLink('//tracking.example')).toBeNull();
  });

  it('normalizes downloaded Markdown filenames', () => {
    expect(normalizeMarkdownFilename('notes.markdown')).toBe('notes.md');
    expect(normalizeMarkdownFilename('../draft:*?.md')).toBe('..-draft.md');
    expect(normalizeMarkdownFilename('   ')).toBe('document.md');
  });
});

describe('Markdown preview raw HTML', () => {
  const README_HEADER = [
    '<div align="center">',
    '  <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build" />',
    '',
    '  <h1>Small Web Tools</h1>',
    '  <p><b>Browser only.</b><br>No uploads.</p>',
    '</div>',
    '',
    '## Install',
  ].join('\n');

  it('keeps a centred header block together across blank lines', () => {
    const blocks = parseMarkdown(README_HEADER);

    expect(blocks.map((block) => block.type)).toEqual(['html', 'heading']);
    const [container] = blocks[0].nodes;
    expect(container).toMatchObject({ type: 'element', name: 'div', attributes: { align: 'center' } });
    expect(container.children.map((node) => node.name || node.type))
      .toEqual(['image', 'h1', 'p']);
  });

  it('removes tags that can execute, embed, or collect, along with their contents', () => {
    const blocks = parseMarkdown([
      '<script>alert(1)</script>',
      '',
      '<iframe src="https://example.com/tracker"></iframe>',
      '',
      '<form action="https://example.com/collect"><input name="password" /></form>',
      '',
      'This sentence survives.',
    ].join('\n'));

    expect(blocks.map((block) => block.type)).toEqual(['paragraph']);
    expect(blocks[0].inline[0].value).toBe('This sentence survives.');
  });

  it('drops event handlers, inline styles, and unsafe link targets', () => {
    const [block] = parseMarkdown('<div style="position:fixed" onclick="steal()"><a href="javascript:alert(1)">Download</a></div>');
    const [container] = block.nodes;

    expect(container.attributes).toEqual({});
    expect(container.children).toEqual([{ type: 'inline', inline: [{ type: 'text', value: 'Download' }] }]);
  });

  it('keeps an unknown tag\'s text and discards the tag', () => {
    const [paragraph] = parseMarkdown('<blink>Still readable.</blink>');

    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.inline).toEqual([{ type: 'text', value: 'Still readable.' }]);
  });

  it('mixes inline HTML with Markdown without either syntax confusing the other', () => {
    const [paragraph] = parseMarkdown('Press <kbd>Enter</kbd>, or <b>**hold both**</b>. Is 3 < 5 true?');

    expect(paragraph.type).toBe('paragraph');
    const keyboard = paragraph.inline.find((token) => token.type === 'html' && token.node.name === 'kbd');
    expect(keyboard.node.children).toEqual([{ type: 'inline', inline: [{ type: 'text', value: 'Enter' }] }]);
    const bold = paragraph.inline.find((token) => token.type === 'html' && token.node.name === 'b');
    expect(bold.node.children[0].inline).toEqual([{ type: 'strong', value: 'hold both' }]);
    expect(paragraph.inline.at(-1).value).toContain('3 < 5');
  });

  it('leaves HTML inside a fenced code block as code', () => {
    const [block] = parseMarkdown(['```html', '<div align="center">Example</div>', '```'].join('\n'));

    expect(block).toMatchObject({ type: 'codeBlock', value: '<div align="center">Example</div>' });
  });

  it('stops an unclosed tag at the next heading instead of swallowing the document', () => {
    const blocks = parseMarkdown(['<div align="center">', 'Dangling.', '', '# Later heading', '', 'Body text.'].join('\n'));

    expect(blocks.map((block) => block.type)).toEqual(['html', 'heading', 'paragraph']);
  });

  it('shows images as placeholders until the reader allows a supported host', () => {
    const badge = '![Build](https://img.shields.io/badge/build-passing-brightgreen)';
    const [blocked] = parseMarkdown(badge)[0].inline;
    const [allowed] = parseMarkdown(badge, { allowRemoteImages: true })[0].inline;

    expect(blocked).toMatchObject({ render: false, reason: 'consent' });
    expect(allowed).toMatchObject({ render: true, reason: null });
  });

  it('refuses unlisted hosts and relative paths even with images allowed', () => {
    const options = { allowRemoteImages: true };
    const [elsewhere] = parseMarkdown('![Tracker](https://tracker.example/pixel.png)', options)[0].inline;
    const [relative] = parseMarkdown('<img src="docs/logo.png" alt="Logo">', options)[0].nodes;

    expect(elsewhere).toMatchObject({ render: false, reason: 'blockedHost' });
    expect(relative).toMatchObject({ type: 'image', render: false, reason: 'relative' });
  });
});
