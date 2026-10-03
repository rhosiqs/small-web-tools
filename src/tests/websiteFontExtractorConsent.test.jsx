import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebsiteFontExtractor from '../components/WebsiteFontExtractor.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('WebsiteFontExtractor consent', () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const buttonByText = (text) => [...container.querySelectorAll('button')]
    .find((button) => button.textContent.includes(text));

  it('offers the allow button beside the blocked message and clears it once allowed', async () => {
    await act(async () => root.render(<WebsiteFontExtractor />));
    expect(buttonByText('Allow website analysis')).toBeUndefined();

    await act(async () => {
      container.querySelector('#fontextractor-input').value = 'example.com';
      container.querySelector('#fontextractor-input').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('#fontextractor-btn').click());

    const message = [...container.querySelectorAll('p')].find((p) => p.textContent.includes('blocked until you allow'));
    expect(message).toBeTruthy();
    const allow = buttonByText('Allow website analysis');
    expect(allow.parentElement).toBe(message.parentElement);
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => allow.click());
    expect(container.textContent).not.toContain('blocked until you allow');
    expect(buttonByText('Allow website analysis')).toBeUndefined();
  });
});
