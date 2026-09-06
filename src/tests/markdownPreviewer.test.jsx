import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarkdownPreviewer from '../components/MarkdownPreviewer.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: vi.fn().mockResolvedValue('# Clipboard title') },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MarkdownPreviewer />));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => root.unmount());
  container.remove();
});

describe('Markdown Previewer', () => {
  it('renders allow-listed raw HTML from the document', async () => {
    const editor = container.querySelector('[aria-label="Markdown editor"]');

    await act(async () => setNativeValue(editor, [
      '<div align="center">',
      '  <h1>Small Web Tools</h1>',
      '  <p><b>Browser only.</b><br>No uploads.</p>',
      '</div>',
      '',
      '<script>document.title = "hijacked";</script>',
    ].join('\n')));

    const preview = container.querySelector('[aria-label="Markdown preview"]');
    expect(preview.querySelector('.markdown-html div')).toHaveStyle({ textAlign: 'center' });
    expect(preview.querySelector('.markdown-html h1')).toHaveTextContent('Small Web Tools');
    expect(preview.querySelector('.markdown-html br')).toBeInTheDocument();
    expect(preview.querySelector('script')).toBeNull();
    expect(preview).not.toHaveTextContent('hijacked');
  });

  it('loads badge images only after the reader turns them on', async () => {
    const editor = container.querySelector('[aria-label="Markdown editor"]');
    await act(async () => setNativeValue(editor, '![Build](https://img.shields.io/badge/build-passing-brightgreen)'));

    const preview = container.querySelector('[aria-label="Markdown preview"]');
    expect(preview.querySelector('img')).toBeNull();
    expect(preview).toHaveTextContent('Image not loaded: Build');

    const toggle = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Load badge images');
    await act(async () => toggle.click());

    expect(preview.querySelector('img')).toHaveAttribute('src', 'https://img.shields.io/badge/build-passing-brightgreen');
    expect(container).toHaveTextContent('Badge images will load from');

    const disable = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Stop loading badge images');
    await act(async () => disable.click());

    expect(preview.querySelector('img')).toBeNull();
  });

  it('pastes Markdown and renders a live preview', async () => {
    const pasteButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Paste');

    await act(async () => pasteButton.click());

    expect(container.querySelector('[aria-label="Markdown editor"]')).toHaveValue('# Clipboard title');
    expect(container.querySelector('[aria-label="Markdown preview"] h1')).toHaveTextContent('Clipboard title');
    expect(container).toHaveTextContent('Pasted Markdown from the clipboard.');
  });

  it('applies simple formatting to the selected editor text', async () => {
    navigator.clipboard.readText.mockResolvedValue('selected');
    const pasteButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Paste');
    await act(async () => pasteButton.click());

    const editor = container.querySelector('[aria-label="Markdown editor"]');
    editor.setSelectionRange(0, 8);

    const boldButton = container.querySelector('[aria-label="Format as Bold"]');
    await act(async () => boldButton.click());

    expect(editor).toHaveValue('**selected**');
    expect(container.querySelector('strong')).toHaveTextContent('selected');
  });

  it('keeps fenced code bodies in the scrollable preview flow', async () => {
    navigator.clipboard.readText.mockResolvedValue([
      '```bash',
      'picard MarkDuplicates \\',
      '  I=input.bam \\',
      '  O=output.bam',
      '```',
    ].join('\n'));
    const pasteButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Paste');

    await act(async () => pasteButton.click());

    const preview = container.querySelector('[aria-label="Markdown preview"]');
    expect(preview).toHaveClass('space-y-4');
    expect(preview).not.toHaveClass('flex');
    expect(preview.querySelector('pre code')).toHaveTextContent('picard MarkDuplicates');
    expect(preview.querySelector('pre code')).toHaveTextContent('O=output.bam');
  });

  it('loads a local Markdown file into the editor and preview', async () => {
    const file = new File(['# Uploaded title'], 'notes.markdown', { type: 'text/markdown' });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn().mockResolvedValue('# Uploaded title'),
    });
    const input = container.querySelector('[aria-label="Upload Markdown file"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(container.querySelector('[aria-label="Markdown editor"]')).toHaveValue('# Uploaded title');
    expect(container.querySelector('[aria-label="Markdown preview"] h1')).toHaveTextContent('Uploaded title');
    expect(container.querySelector('[aria-label="Download filename"]')).toHaveValue('notes.md');
  });

  it('downloads the current Markdown using a normalized filename', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:markdown');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    navigator.clipboard.readText.mockResolvedValue('# Saved');
    const pasteButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Paste');
    await act(async () => pasteButton.click());
    const filename = container.querySelector('[aria-label="Download filename"]');
    await act(async () => {
      setNativeValue(filename, 'draft.markdown');
    });

    const downloadButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Download .md');
    await act(async () => downloadButton.click());

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(container).toHaveTextContent('Downloaded draft.md.');
  });

  it('synchronizes editor and preview by source block in both directions', async () => {
    navigator.clipboard.readText.mockResolvedValue('First paragraph\n\n```bash\nprintf test\n```');
    const pasteButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Paste');
    await act(async () => pasteButton.click());

    const editor = container.querySelector('[aria-label="Markdown editor"]');
    const preview = container.querySelector('[aria-label="Markdown preview"]');
    Object.defineProperties(editor, {
      scrollHeight: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 200 },
    });
    Object.defineProperties(preview, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 300 },
    });
    const sourceBlocks = preview.querySelectorAll('[data-source-start-line]');
    Object.defineProperties(sourceBlocks[0], {
      offsetTop: { configurable: true, value: 0 },
      offsetHeight: { configurable: true, value: 200 },
    });
    Object.defineProperties(sourceBlocks[1], {
      offsetTop: { configurable: true, value: 500 },
      offsetHeight: { configurable: true, value: 300 },
    });

    await act(async () => {
      editor.scrollTop = 72;
      editor.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(preview.scrollTop).toBe(650);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      preview.scrollTop = 650;
      preview.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(editor.scrollTop).toBe(72);
  });
});
