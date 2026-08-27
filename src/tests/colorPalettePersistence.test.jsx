import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ColorConverter from '../components/ColorConverter';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const clearCookies = () => {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
};

beforeEach(() => {
  localStorage.clear();
  clearCookies();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  clearCookies();
});

const render = async () => {
  await act(async () => root.render(<ColorConverter />));
};

const swatchTitles = () => Array.from(container.querySelectorAll('button[title^="#"]'))
  .map((button) => button.getAttribute('title'));

const clickByTitlePrefix = async (prefix) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.getAttribute('title')?.startsWith(prefix));
  expect(button, `no button titled "${prefix}…"`).toBeTruthy();
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const clickByText = async (text) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent?.trim().toLowerCase() === text.toLowerCase());
  expect(button, `no button labelled "${text}"`).toBeTruthy();
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

describe('colour palette persistence', () => {
  it('renders a stored palette without writing it to a cookie', async () => {
    localStorage.setItem('customPresets', JSON.stringify(['#123456', '#ABCDEF']));
    await render();

    expect(swatchTitles()).toEqual(expect.arrayContaining(['#123456', '#ABCDEF']));
    expect(document.cookie).not.toContain('customPresets');
  });

  it.each([
    ['a JSON object', '{"palette":["#123456"]}'],
    ['a bare string', '"#123456"'],
    ['non-hex members', '["red","blue"]'],
    ['unparseable text', 'not json'],
  ])('falls back to the default palette when storage holds %s', async (_label, raw) => {
    // A non-array value used to reach `presets.map` and crash the render.
    localStorage.setItem('customPresets', raw);
    await render();

    expect(swatchTitles()).toContain('#EF4444');
  });

  it('tolerates a corrupt recent-colours record', async () => {
    localStorage.setItem('recentColors', '{"not":"an array"}');
    await expect(render()).resolves.toBeUndefined();
  });

  it('migrates a legacy palette cookie into storage and clears the cookie', async () => {
    document.cookie = `customPresets=${encodeURIComponent(JSON.stringify(['#0F0F0F']))}; path=/`;
    await render();

    expect(swatchTitles()).toContain('#0F0F0F');
    expect(JSON.parse(localStorage.getItem('customPresets'))).toEqual(['#0F0F0F']);
    expect(document.cookie).not.toContain('customPresets');
  });

  it('persists an added preset to storage and still writes no cookie', async () => {
    localStorage.setItem('customPresets', JSON.stringify(['#123456']));
    await render();

    await clickByText('Customize');
    await clickByTitlePrefix('Add current color');

    const stored = JSON.parse(localStorage.getItem('customPresets'));
    expect(stored).toHaveLength(2);
    expect(stored[0]).toBe('#123456');
    expect(document.cookie).not.toContain('customPresets');
  });

  it('ignores a legacy cookie that does not hold a hex palette', async () => {
    document.cookie = `customPresets=${encodeURIComponent(JSON.stringify({ evil: true }))}; path=/`;
    await render();

    expect(swatchTitles()).toContain('#EF4444');
    expect(document.cookie).not.toContain('customPresets');
  });
});
