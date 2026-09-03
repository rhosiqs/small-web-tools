import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SimpleHome from '../components/SimpleHome.jsx';
import { SIMPLE_LAYOUT_STORAGE_KEY } from '../lib/simpleLayout.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const essentialTools = [
  ['tool-casing', 'Casing Switcher'],
  ['tool-url', 'URL Encoder & Decoder'],
  ['tool-date', 'Date & Time Counter'],
  ['tool-currency', 'Currency Converter'],
  ['tool-color', 'Color Converter'],
  ['tool-qrcode', 'QR Code Generator'],
  ['tool-password', 'Password Generator'],
  ['tool-wheel', 'Random Wheel'],
].map(([id, name]) => ({
  id,
  name,
  desc: `${name} description`,
  category: 'utilities',
  icon: <svg aria-hidden="true" />,
}));

const tools = [
  ...essentialTools,
  {
    id: 'tool-code-preview',
    name: 'VS Code Preview',
    desc: 'Highlight source code.',
    category: 'developer',
    icon: <svg aria-hidden="true" />,
  },
  {
    id: 'tool-wc',
    name: 'Word Counter',
    desc: 'Count words and characters.',
    category: 'text',
    icon: <svg aria-hidden="true" />,
  },
];

let container;
let root;

function shortcutNames() {
  return [...container.querySelectorAll('#simple-essentials-grid > *')]
    .map((card) => card.querySelector('span:not([class*="h-9"])').textContent);
}

function findButton(label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent.includes(label) || button.getAttribute('aria-label') === label);
}

async function clickButton(label) {
  await act(async () => findButton(label).click());
}

async function typeInto(selector, value) {
  const field = container.querySelector(selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

describe('SimpleHome', () => {
  it('shows exactly eight default shortcuts in a compact launcher', async () => {
    await act(async () => root.render(
      <SimpleHome tools={tools} onSelectTool={vi.fn()} />,
    ));

    expect(container).toHaveTextContent('Find a tool and get started');
    expect(container).toHaveTextContent('8 tools');
    expect(container.querySelectorAll('#simple-essentials-grid > *')).toHaveLength(8);
    expect(shortcutNames()).toContain('Random Wheel');
    expect(shortcutNames()).not.toContain('Word Counter');
    expect(container).toHaveTextContent('Simple mode');
    expect(container).not.toHaveTextContent('Simple home');
    expect(container).not.toHaveTextContent('VS Code Preview');
    expect(container).not.toHaveTextContent('Choose your workspace');
  });

  it('searches every tool and opens advanced results in the simple workspace', async () => {
    const onSelectTool = vi.fn();
    await act(async () => root.render(
      <SimpleHome tools={tools} onSelectTool={onSelectTool} />,
    ));

    await typeInto('#simple-tool-search', 'code preview');

    expect(container).toHaveTextContent('VS Code Preview');
    await clickButton('VS Code Preview');
    expect(onSelectTool).toHaveBeenCalledWith('tool-code-preview');
  });

  it('adds, removes, reorders, and resets the layout in this browser only', async () => {
    const onSelectTool = vi.fn();
    await act(async () => root.render(
      <SimpleHome tools={tools} onSelectTool={onSelectTool} />,
    ));

    await clickButton('Edit layout');
    expect(container).toHaveTextContent('Add a shortcut');

    await clickButton('Remove Currency Converter');
    expect(shortcutNames()).not.toContain('Currency Converter');
    expect(container).toHaveTextContent('7 tools');

    await typeInto('#simple-add-search', 'word');
    await clickButton('Add Word Counter');
    expect(shortcutNames().at(-1)).toBe('Word Counter');

    await clickButton('Move Word Counter earlier');
    expect(shortcutNames().at(-2)).toBe('Word Counter');

    const stored = JSON.parse(localStorage.getItem(SIMPLE_LAYOUT_STORAGE_KEY));
    expect(stored.toolIds).toEqual([
      'tool-casing', 'tool-url', 'tool-date', 'tool-color',
      'tool-qrcode', 'tool-password', 'tool-wc', 'tool-wheel',
    ]);

    // Editing must never open a tool by accident.
    expect(onSelectTool).not.toHaveBeenCalled();

    await clickButton('Reset to default');
    expect(localStorage.getItem(SIMPLE_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(shortcutNames()).toContain('Currency Converter');
    expect(shortcutNames()).not.toContain('Word Counter');
  });

  it('restores a stored layout and ignores tools the registry no longer serves', async () => {
    localStorage.setItem(SIMPLE_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 1,
      toolIds: ['tool-wheel', 'tool-retired', 'tool-color', 'tool-color'],
    }));

    await act(async () => root.render(
      <SimpleHome tools={tools} onSelectTool={vi.fn()} />,
    ));

    expect(shortcutNames()).toEqual(['Random Wheel', 'Color Converter']);
    expect(container).toHaveTextContent('2 tools');
  });
});
