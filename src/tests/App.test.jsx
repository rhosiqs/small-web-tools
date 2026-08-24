import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import i18n from '../i18n/index.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function flushLazyRoute(selector) {
  if (selector) {
    await act(async () => vi.dynamicImportSettled());
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    if (!selector || container.querySelector(selector)) return;
  }
}

beforeEach(async () => {
  localStorage.clear();
  window.history.replaceState(null, '', '/home');
  await i18n.changeLanguage('en-US');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await i18n.changeLanguage('en-US');
});

describe('App integration', () => {
  it('resolves a canonical address and renders its lazy tool route', async () => {
    window.history.replaceState(null, '', '/home/wc');
    await act(async () => root.render(<App />));
    await flushLazyRoute('#tool-wc');

    expect(window.location.pathname).toBe('/home/wc');
    expect(container.querySelector('#tool-wc')).toBeInTheDocument();
    expect(container).toHaveTextContent('Word Counter');
  });

  it('persists shell controls and navigates between audience workspaces', async () => {
    await act(async () => root.render(<App />));
    await flushLazyRoute();

    const themeToggle = container.querySelector('[aria-label="Toggle dark/light mode"]');
    await act(async () => themeToggle.click());
    await act(async () => container.querySelector('#sidebar-toggle').click());
    await act(async () => container.querySelector('#sidebar-collapse-btn').click());
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('sidebarCollapsed')).toBe('true');

    const simpleModeButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Simple mode');
    await act(async () => simpleModeButton.click());
    await flushLazyRoute('#simple-home');
    expect(window.location.pathname).toBe('/simple');
    expect(container.querySelector('#simple-home')).toBeInTheDocument();
    expect(container).toHaveTextContent('Find a tool and get started');
  });

  it('changes locale through the shell language menu', async () => {
    await act(async () => root.render(<App />));
    const desktopSwitcher = container.querySelector('[data-language-switcher="desktop"]');
    await act(async () => desktopSwitcher.querySelector('button').click());
    const localeOptions = [...desktopSwitcher.querySelectorAll('[role="menuitemradio"]')];
    await act(async () => localeOptions.find((button) => button.getAttribute('aria-checked') === 'false').click());

    expect(document.documentElement.lang).toBe('zh-TW');
    expect(localStorage.getItem('small-web-tools.locale')).toBe('zh-TW');
  });
});
