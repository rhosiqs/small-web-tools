import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIMPLE_LAYOUT,
  SIMPLE_LAYOUT_EVENT,
  SIMPLE_LAYOUT_MAX_TOOLS,
  SIMPLE_LAYOUT_STORAGE_KEY,
  SIMPLE_LAYOUT_VERSION,
  readRawSimpleLayout,
  resetSimpleLayout,
  resolveSimpleLayout,
  sanitizeSimpleLayout,
  saveSimpleLayout,
  subscribeSimpleLayout,
  withToolAdded,
  withToolMoved,
  withToolRemoved,
} from '../lib/simpleLayout.js';

const available = [...DEFAULT_SIMPLE_LAYOUT, 'tool-wc', 'tool-base', 'tool-roman', 'tool-dna', 'tool-codon', 'tool-slash'];

function storedRecord(toolIds, version = SIMPLE_LAYOUT_VERSION) {
  return JSON.stringify({ version, toolIds });
}

beforeEach(() => {
  localStorage.clear();
  resetSimpleLayout();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('simple layout storage', () => {
  it('keeps only registered, unique, and in-budget shortcuts', () => {
    expect(sanitizeSimpleLayout(['tool-color', 'tool-color', 'tool-retired', 7, 'tool-wc'], available))
      .toEqual(['tool-color', 'tool-wc']);
    expect(sanitizeSimpleLayout('tool-color', available)).toEqual([]);
    expect(sanitizeSimpleLayout(available.concat(available), available))
      .toHaveLength(SIMPLE_LAYOUT_MAX_TOOLS);
  });

  it('falls back to the curated workspace for every unusable record', () => {
    const fallback = { toolIds: [...DEFAULT_SIMPLE_LAYOUT], isCustomized: false };
    expect(resolveSimpleLayout(null, available)).toEqual(fallback);
    expect(resolveSimpleLayout('{not json', available)).toEqual(fallback);
    expect(resolveSimpleLayout('"a string"', available)).toEqual(fallback);
    expect(resolveSimpleLayout(storedRecord(['tool-color'], 99), available)).toEqual(fallback);
    expect(resolveSimpleLayout(storedRecord([]), available)).toEqual(fallback);
    expect(resolveSimpleLayout(storedRecord(['tool-retired']), available)).toEqual(fallback);
    expect(resolveSimpleLayout(storedRecord(['tool-wc', 'tool-color']), available))
      .toEqual({ toolIds: ['tool-wc', 'tool-color'], isCustomized: true });
  });

  it('persists a sanitized layout and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSimpleLayout(listener);

    saveSimpleLayout(['tool-wc', 'tool-retired', 'tool-color'], available);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readRawSimpleLayout())).toEqual({
      version: SIMPLE_LAYOUT_VERSION,
      toolIds: ['tool-wc', 'tool-color'],
    });

    saveSimpleLayout([], available);
    expect(listener).toHaveBeenCalledTimes(1);

    resetSimpleLayout();
    expect(readRawSimpleLayout()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new Event(SIMPLE_LAYOUT_EVENT));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the layout usable when Web Storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    saveSimpleLayout(['tool-color'], available);
    expect(readRawSimpleLayout()).toBe(storedRecord(['tool-color']));

    vi.restoreAllMocks();
    expect(localStorage.getItem(SIMPLE_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('applies add, remove, and move within the layout budget', () => {
    const layout = ['tool-color', 'tool-wc'];
    expect(withToolAdded(layout, 'tool-base')).toEqual(['tool-color', 'tool-wc', 'tool-base']);
    expect(withToolAdded(layout, 'tool-wc')).toBe(layout);
    expect(withToolAdded(available.slice(0, SIMPLE_LAYOUT_MAX_TOOLS), 'tool-slash'))
      .toHaveLength(SIMPLE_LAYOUT_MAX_TOOLS);

    expect(withToolRemoved(layout, 'tool-color')).toEqual(['tool-wc']);
    expect(withToolRemoved(layout, 'tool-base')).toBe(layout);
    expect(withToolRemoved(['tool-color'], 'tool-color')).toEqual(['tool-color']);

    expect(withToolMoved(layout, 'tool-wc', -1)).toEqual(['tool-wc', 'tool-color']);
    expect(withToolMoved(layout, 'tool-wc', 1)).toBe(layout);
    expect(withToolMoved(layout, 'tool-color', -1)).toBe(layout);
    expect(withToolMoved(layout, 'tool-base', 1)).toBe(layout);
  });
});
