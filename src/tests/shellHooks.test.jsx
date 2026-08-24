import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppRouting } from '../hooks/useAppRouting.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { readShellPreferences, useShellPersistence } from '../hooks/useShellPersistence.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function RoutingHarness() {
  const routing = useAppRouting(() => 'tool-wc');
  return (
    <div data-tool={routing.activeTool} data-mode={routing.toolMode}>
      <button type="button" onClick={() => routing.navigateToTool('tool-color')}>Color</button>
      <button type="button" onClick={() => routing.changeMode('developer')}>Developer</button>
    </div>
  );
}

function SideEffectHarness() {
  useShellPersistence({ activeTool: 'tool-color', theme: 'dark', isSidebarCollapsed: true });
  useDocumentTitle({
    activeTool: 'tool-home',
    modeProfile: { id: 'all', label: 'All' },
    language: 'en-US',
    t: (key) => key === 'navigation:titles.default' ? 'Small Web Tools' : key,
  });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('application shell hooks', () => {
  it('keeps route and mode state synchronized across navigation and browser history', async () => {
    window.history.replaceState(null, '', '/home/student/wc');
    await act(async () => root.render(<RoutingHarness />));
    const state = container.firstElementChild;
    expect(state).toHaveAttribute('data-tool', 'tool-wc');
    expect(state).toHaveAttribute('data-mode', 'student');

    await act(async () => container.querySelector('button').click());
    expect(window.location.pathname).toBe('/home/student/color');
    expect(state).toHaveAttribute('data-tool', 'tool-color');

    window.history.pushState(null, '', '/simple/code-preview');
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(state).toHaveAttribute('data-tool', 'tool-code-preview');
    expect(state).toHaveAttribute('data-mode', 'simple');

    await act(async () => container.querySelectorAll('button')[1].click());
    expect(window.location.pathname).toBe('/home/developer');
    expect(state).toHaveAttribute('data-tool', 'tool-home');
  });

  it('isolates storage, theme, and title side effects from routing', async () => {
    await act(async () => root.render(<SideEffectHarness />));
    expect(sessionStorage.getItem('activeTool')).toBe('tool-color');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('sidebarCollapsed')).toBe('true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.title).toBe('Small Web Tools');
  });

  it('reads stored shell preferences before the operating-system theme', () => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('sidebarCollapsed', 'true');
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);

    expect(readShellPreferences()).toEqual({ theme: 'light', isSidebarCollapsed: true });
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('falls back safely when Web Storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    expect(readShellPreferences()).toEqual({ theme: 'dark', isSidebarCollapsed: false });
    getItem.mockRestore();
  });
});
