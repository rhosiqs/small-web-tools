import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RandomOrder, { parseEntries } from '../components/RandomOrder.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const drawButton = () => container.querySelector('#shuffle-draw-btn');
const clearButton = () => container.querySelector('#shuffle-clear-btn');
const entriesField = () => container.querySelector('#shuffle-entries');
const drawnEntries = () => [...container.querySelectorAll('ol li')].map((item) => item.textContent);

function setTextareaValue(element, value) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The reveal is staggered, so a draw is only settled once its timers have run. */
async function drawAndReveal(expected) {
  await act(async () => {
    drawButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  for (let attempt = 0; attempt < 100 && drawnEntries().length !== expected; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    });
  }
}

describe('parseEntries', () => {
  it('splits on the selected separator and drops blanks', () => {
    expect(parseEntries(' Alice \n\n Bob \r\nChen', 'lines')).toEqual(['Alice', 'Bob', 'Chen']);
    expect(parseEntries('Alice, Bob，Chen', 'commas')).toEqual(['Alice', 'Bob', 'Chen']);
    expect(parseEntries('Alice Bob\tChen', 'spaces')).toEqual(['Alice', 'Bob', 'Chen']);
  });

  it('falls back to line splitting for an unknown separator', () => {
    expect(parseEntries('Alice\nBob', 'unknown')).toEqual(['Alice', 'Bob']);
    expect(parseEntries('   ', 'lines')).toEqual([]);
  });
});

describe('Random Order', () => {
  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<RandomOrder />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('draws every entry exactly once', async () => {
    setTextareaValue(entriesField(), 'Alice\nBob\nChen\nDara');
    await drawAndReveal(4);

    const drawn = drawnEntries();
    expect(drawn).toHaveLength(4);
    expect(drawn.map((row) => row.replace(/^\d+/, '')).sort())
      .toEqual(['Alice', 'Bob', 'Chen', 'Dara']);
  });

  it('refuses to draw an empty list and keeps the result area empty', async () => {
    setTextareaValue(entriesField(), '   \n  ');
    await drawAndReveal(0);

    expect(drawnEntries()).toEqual([]);
    expect(container.textContent).toContain('Add at least one entry before drawing.');
  });

  it('clears the entries and the previous draw', async () => {
    setTextareaValue(entriesField(), 'Alice\nBob');
    await drawAndReveal(2);
    expect(drawnEntries()).toHaveLength(2);

    await act(async () => {
      clearButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(drawnEntries()).toEqual([]);
    expect(entriesField().value).toBe('');
  });
});
