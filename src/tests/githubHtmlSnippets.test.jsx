import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import GithubHtmlSnippets from '../components/GithubHtmlSnippets.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const editor = () => container.querySelector('textarea');
const preview = () => container.querySelector('.github-html-preview');
const stripTiles = () => [...container.querySelectorAll('[role="toolbar"] button')];

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
  it('shows the blocks without printing their names on screen', () => {
    const tiles = stripTiles();
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      const label = tile.getAttribute('aria-label');
      expect(label, 'every block is still named for assistive technology').toBeTruthy();
      expect(tile.textContent, `"${label}" leaked its name into the visible tile`).not.toContain(label);
    }
  });

  it('stacks blocks in the order they are clicked', async () => {
    await act(async () => stripTiles()[0].click());
    const afterFirst = editor().value;
    expect(afterFirst).not.toBe('');

    await act(async () => stripTiles()[1].click());
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

  it('shows a placeholder instead of fetching a remote image', async () => {
    await act(async () => {
      setNativeValue(editor(), '<img src="https://img.shields.io/badge/a-b-green" alt="Build" />');
    });
    expect(preview().querySelector('img')).toBeNull();
    expect(preview().textContent).toContain('Build');
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
