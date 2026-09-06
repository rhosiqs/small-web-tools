import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeGrid from '../components/HomeGrid.jsx';
import { HOME_LAYOUT_STORAGE_KEY } from '../lib/homeLayout.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tools = [
  {
    id: 'tool-wc',
    name: 'Word Counter',
    desc: 'Count words.',
    category: 'text',
    icon: <svg aria-hidden="true" />,
    subGroup: null,
  },
  {
    id: 'tool-date',
    name: 'Date & Time Counter',
    desc: 'Compare dates and times.',
    category: 'utilities',
    icon: <svg aria-hidden="true" />,
    subGroup: 'Calculators',
  },
];

// A wider catalog for the arrangement tests; the audience tests above depend on
// the two-tool fixture staying as it is.
const layoutTools = [
  ...tools,
  {
    id: 'tool-casing',
    name: 'Casing Switcher',
    desc: 'Change letter casing.',
    category: 'text',
    icon: <svg aria-hidden="true" />,
    subGroup: null,
  },
  {
    id: 'tool-base',
    name: 'Base Converter',
    desc: 'Convert number bases.',
    category: 'developer',
    icon: <svg aria-hidden="true" />,
    subGroup: null,
  },
];

let container;
let root;

function groupHeadings() {
  return [...container.querySelectorAll('#tool-home [data-group] > h3')]
    .map((heading) => heading.textContent.trim());
}

function editorGroupNames() {
  return [...container.querySelectorAll('#home-layout-editor [data-group] input[type="text"]')]
    .map((field) => field.value || field.placeholder);
}

function findControl(label) {
  return container.querySelector(`[aria-label="${label}"]`);
}

function findButtonByText(label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === label);
}

async function clickButtonText(label) {
  await act(async () => findButtonByText(label).click());
}

async function clickControl(label) {
  await act(async () => findControl(label).click());
}

async function setValue(element, value) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

function storedLayout() {
  return JSON.parse(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY) ?? 'null');
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

describe('HomeGrid audience presentation', () => {
  it('keeps the complete categorized homepage without workspace controls', async () => {
    await act(async () => root.render(
      <HomeGrid tools={tools} onSelectTool={vi.fn()} modeId="all" />,
    ));

    expect(container).toHaveTextContent('Welcome to Small Web Tools!');
    expect(container).toHaveTextContent('Text');
    expect(container).toHaveTextContent('Calculators');
    expect(container).not.toHaveTextContent('Choose your workspace');
    expect(container).not.toHaveTextContent('Shareable mode address');
    expect(container.querySelector('#tool-mode')).toBeNull();
    expect(container.querySelector('[aria-label="Choose audience"]')).toBeInTheDocument();
  });

  it('renders an audience as a flat recommended-tool workspace', async () => {
    await act(async () => root.render(
      <HomeGrid tools={tools} onSelectTool={vi.fn()} modeId="daily" />,
    ));

    expect(container).toHaveTextContent('Everyday essentials');
    expect(container).toHaveTextContent('Recommended for Daily users');
    expect(container).toHaveTextContent('2 tools');
    expect([...container.querySelectorAll('h3')].map((heading) => heading.textContent))
      .toEqual(['Word Counter', 'Date & Time Counter']);
  });
});

describe('HomeGrid arrangement', () => {
  async function renderHome(props = {}) {
    await act(async () => root.render(
      <HomeGrid tools={layoutTools} onSelectTool={vi.fn()} modeId="all" {...props} />,
    ));
  }

  it('groups the homepage by category until the reader opens the editor', async () => {
    await renderHome();

    expect(groupHeadings()).toEqual(['Text', 'Developer', 'Utilities']);
    expect(container.querySelector('#home-layout-editor')).toBeNull();
    expect(storedLayout()).toBeNull();

    await clickButtonText('Customize layout');
    expect(container.querySelector('#home-layout-editor')).toBeInTheDocument();
    expect(container).toHaveTextContent('Hidden tools');
  });

  it('renames, reorders, refills, and resets the groups, saving each edit', async () => {
    const onSelectTool = vi.fn();
    await renderHome({ onSelectTool });
    await clickButtonText('Customize layout');

    // Every default group is offered for editing, including the empty ones.
    expect(editorGroupNames())
      .toEqual(['Text', 'Developer', 'Network', 'Media', 'Bioinfo', 'Utilities']);

    await setValue(findControl('Name of Text'), 'Writing');
    expect(storedLayout().groups[0]).toEqual({
      id: 'text',
      name: 'Writing',
      toolIds: ['tool-wc', 'tool-casing'],
    });

    await clickControl('Move Casing Switcher earlier');
    expect(storedLayout().groups[0].toolIds).toEqual(['tool-casing', 'tool-wc']);

    await clickControl('Move Developer up');
    expect(editorGroupNames())
      .toEqual(['Developer', 'Writing', 'Network', 'Media', 'Bioinfo', 'Utilities']);

    await setValue(findControl('Group for Word Counter'), 'developer');
    expect(storedLayout().groups[0].toolIds).toEqual(['tool-base', 'tool-wc']);

    await clickControl('Hide Base Converter from the homepage');
    expect(storedLayout().hiddenToolIds).toEqual(['tool-base']);
    // A hidden tool stays reachable from the hidden list rather than vanishing.
    expect(container).toHaveTextContent('Base Converter');

    // Editing must never open a tool by accident.
    expect(onSelectTool).not.toHaveBeenCalled();

    await clickButtonText('Done');
    expect(groupHeadings()).toEqual(['Developer', 'Writing', 'Utilities']);
    expect(container).not.toHaveTextContent('Base Converter');

    await clickButtonText('Customize layout');
    await clickButtonText('Reset to default');
    expect(storedLayout()).toBeNull();
    expect(editorGroupNames())
      .toEqual(['Text', 'Developer', 'Network', 'Media', 'Bioinfo', 'Utilities']);
  });

  it('adds a group of the reader\u2019s own and moves a tool into it', async () => {
    await renderHome();
    await clickButtonText('Customize layout');
    await clickButtonText('Add group');

    const nameFields = [...container.querySelectorAll('#home-layout-editor input[type="text"]')];
    expect(editorGroupNames().at(-1)).toBe('Untitled group');

    await setValue(nameFields.at(-1), 'Favourites');
    await setValue(findControl('Group for Word Counter'), 'group-1');

    expect(storedLayout().groups.at(-1)).toEqual({
      id: 'group-1',
      name: 'Favourites',
      toolIds: ['tool-wc'],
    });

    await clickButtonText('Done');
    expect(groupHeadings()).toEqual(['Text', 'Developer', 'Utilities', 'Favourites']);
  });

  it('restores a stored arrangement and shows a tool it never saw', async () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 1,
      groups: [
        { id: 'group-1', name: 'Favourites', toolIds: ['tool-date', 'tool-retired'] },
        { id: 'text', name: null, toolIds: [] },
      ],
      hiddenToolIds: ['tool-casing'],
    }));

    await renderHome();

    expect(groupHeadings()).toEqual(['Favourites', 'Text']);
    // `tool-base` postdates the record, so it joins the last group rather than
    // disappearing from the homepage.
    expect(container).toHaveTextContent('Base Converter');
    expect(container).not.toHaveTextContent('Casing Switcher');
  });

  it('leaves an audience workspace uncustomizable', async () => {
    await renderHome({ modeId: 'daily' });

    expect(findButtonByText('Customize layout')).toBeUndefined();
    expect(container).toHaveTextContent('Recommended for Daily users');
  });
});
