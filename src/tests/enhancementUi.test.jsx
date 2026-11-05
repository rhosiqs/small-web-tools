import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ColorConverter from '../components/ColorConverter.jsx';
import FolderAnalyzer from '../components/FolderAnalyzer.jsx';
import ImgMeta from '../components/ImgMeta.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('backlog enhancement UI', () => {
  it('makes the Color Sync state prominent and accessible', async () => {
    await act(async () => root.render(<ColorConverter />));

    const syncButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('COLOR SYNC'));
    expect(syncButton).toHaveAttribute('aria-pressed');
    expect(syncButton.className).toContain('border-2');

    const initialState = syncButton.getAttribute('aria-pressed');
    await act(async () => syncButton.click());
    expect(syncButton.getAttribute('aria-pressed')).not.toBe(initialState);
  });

  it('explains multi-format metadata stripping before upload', async () => {
    await act(async () => root.render(<ImgMeta />));

    expect(container.querySelector('[role="note"]'))
      .toHaveTextContent('Metadata stripping supports JPEG/JPG, PNG, WebP, and other browser-decodable images.');
  });

  it('resets and reopens the folder picker when adding another path', async () => {
    await act(async () => root.render(<FolderAnalyzer />));

    const input = container.querySelector('input[type="file"]');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'previous-folder',
    });

    const selectButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Select or Drag & Drop Folder'));
    await act(async () => selectButton.click());

    expect(input.value).toBe('');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
