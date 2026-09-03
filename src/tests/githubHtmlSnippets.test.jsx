import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import GithubHtmlSnippets from '../components/GithubHtmlSnippets.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const editor = () => container.querySelector('textarea');
const preview = () => container.querySelector('.github-html-preview');
const card = () => container.querySelector('[id="tool-github-html"]');
const expandButtons = () => [...container.querySelectorAll('.fullscreen-preview-control')];

/** Blocks live only in the palette now, so every tile assertion opens it first. */
const openPalette = async () => {
  await act(async () => {
    card().dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  return [...container.querySelectorAll('[role="dialog"] button')];
};

function setNativeValue(element, value) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<GithubHtmlSnippets />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('GitHub HTML Blocks', () => {
  it('shows the blocks without printing their names on screen', async () => {
    const tiles = await openPalette();
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      const label = tile.getAttribute('aria-label');
      expect(label, 'every block is still named for assistive technology').toBeTruthy();
      expect(tile.textContent, `"${label}" leaked its name into the visible tile`).not.toContain(label);
    }
  });

  it('stacks blocks in the order they are clicked', async () => {
    const tiles = await openPalette();
    await act(async () => tiles[0].click());
    const afterFirst = editor().value;
    expect(afterFirst).not.toBe('');

    const reopened = await openPalette();
    await act(async () => reopened[1].click());
    const afterSecond = editor().value;
    expect(afterSecond.startsWith(afterFirst.trimEnd())).toBe(true);
    expect(afterSecond.length).toBeGreaterThan(afterFirst.length);
  });

  it('renders the composed document in the preview', async () => {
    await act(async () => {
      setNativeValue(editor(), '<div align="center"><h1>Project</h1></div>');
    });
    expect(preview().querySelector('div[align="center"] h1').textContent).toBe('Project');
  });

  it('warns about the markup GitHub would remove, and never renders it', async () => {
    await act(async () => {
      setNativeValue(editor(), '<p style="color:red">x</p>\n<video src="a.mp4"></video>');
    });
    expect(container.textContent).toContain('<video>');
    expect(container.textContent).toContain('style');
    expect(preview().querySelector('video')).toBeNull();
    expect(preview().querySelector('p').getAttribute('style')).toBeNull();
  });

  it('renders inline HTML that arrives mid-sentence from the shared Markdown parser', async () => {
    await act(async () => {
      setNativeValue(editor(), 'press <kbd>Ctrl</kbd> now');
    });
    expect(preview().querySelector('kbd')?.textContent).toBe('Ctrl');
    expect(preview().textContent).toContain('press');
    expect(preview().textContent).toContain('now');
  });

  it('shows a placeholder instead of fetching a remote image', async () => {
    await act(async () => {
      setNativeValue(editor(), '<img src="https://img.shields.io/badge/a-b-green" alt="Build" />');
    });
    expect(preview().querySelector('img')).toBeNull();
    expect(preview().textContent).toContain('Build');
  });

  it('keeps no block tiles outside the palette', () => {
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens each pane fullscreen and closes it with Escape', async () => {
    const [editorExpand, previewExpand] = expandButtons();
    expect(expandButtons()).toHaveLength(2);

    await act(async () => editorExpand.click());
    expect(document.querySelectorAll('textarea')).toHaveLength(2);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelectorAll('textarea')).toHaveLength(1);

    await act(async () => previewExpand.click());
    expect(document.querySelectorAll('.github-html-preview')).toHaveLength(2);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelectorAll('.github-html-preview')).toHaveLength(1);
  });

  it('leaves the palette shortcut inert while a pane is fullscreen', async () => {
    await act(async () => expandButtons()[1].click());
    await act(async () => {
      card().dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('opens the palette with the keyboard shortcut and closes it with Escape', async () => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      container.querySelector('[id="tool-github-html"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
