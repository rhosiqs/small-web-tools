import { useEffect, useState } from 'react';

export const SHELL_STORAGE_KEYS = Object.freeze({
  activeTool: 'activeTool',
  theme: 'theme',
  sidebarCollapsed: 'sidebarCollapsed',
});

export function readStoredActiveTool() {
  try {
    return sessionStorage.getItem(SHELL_STORAGE_KEYS.activeTool);
  } catch {
    return null;
  }
}

export function readShellPreferences() {
  let storedTheme = null;
  let isSidebarCollapsed = false;

  try {
    storedTheme = localStorage.getItem(SHELL_STORAGE_KEYS.theme);
    isSidebarCollapsed = localStorage.getItem(SHELL_STORAGE_KEYS.sidebarCollapsed) === 'true';
  } catch {
    // Web Storage can be blocked; use safe in-memory defaults.
  }

  const prefersDark = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;

  return {
    theme: storedTheme === 'dark' || storedTheme === 'light'
      ? storedTheme
      : prefersDark ? 'dark' : 'light',
    isSidebarCollapsed,
  };
}

export function useShellPreferences(activeTool) {
  const [initialPreferences] = useState(readShellPreferences);
  const [theme, setTheme] = useState(initialPreferences.theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialPreferences.isSidebarCollapsed);

  useShellPersistence({ activeTool, theme, isSidebarCollapsed });

  return {
    theme,
    setTheme,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  };
}

export function useShellPersistence({ activeTool, theme, isSidebarCollapsed }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(SHELL_STORAGE_KEYS.activeTool, activeTool);
    } catch {
      // Storage can be unavailable; route state remains authoritative in memory.
    }
  }, [activeTool]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(SHELL_STORAGE_KEYS.theme, theme);
    } catch {
      // Storage can be unavailable; keep the active in-memory theme.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(SHELL_STORAGE_KEYS.sidebarCollapsed, isSidebarCollapsed ? 'true' : 'false');
    } catch {
      // Storage can be unavailable; keep the current sidebar state.
    }
  }, [isSidebarCollapsed]);
}
