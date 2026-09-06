import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOME_LAYOUT_EVENT,
  HOME_LAYOUT_MAX_GROUPS,
  HOME_LAYOUT_MAX_NAME_LENGTH,
  HOME_LAYOUT_STORAGE_KEY,
  HOME_LAYOUT_VERSION,
  buildDefaultHomeLayout,
  readRawHomeLayout,
  resetHomeLayout,
  resolveHomeLayout,
  sanitizeGroupName,
  sanitizeHomeLayout,
  saveHomeLayout,
  subscribeHomeLayout,
  withGroupAdded,
  withGroupMoved,
  withGroupRemoved,
  withGroupRenamed,
  withToolHidden,
  withToolMovedInGroup,
  withToolPlaced,
} from '../lib/homeLayout.js';

const categoryIds = ['text', 'developer', 'utilities'];
const catalog = [
  { id: 'tool-wc', category: 'text' },
  { id: 'tool-casing', category: 'text' },
  { id: 'tool-base', category: 'developer' },
  { id: 'tool-date', category: 'utilities' },
  { id: 'tool-policy', category: 'policy' },
];
const context = { categoryIds, catalog };

function storedRecord(layout, version = HOME_LAYOUT_VERSION) {
  return JSON.stringify({ version, ...layout });
}

beforeEach(() => {
  localStorage.clear();
  resetHomeLayout();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('home layout defaults', () => {
  it('builds one group per category in category order', () => {
    expect(buildDefaultHomeLayout(categoryIds, catalog)).toEqual({
      groups: [
        { id: 'text', name: null, toolIds: ['tool-wc', 'tool-casing'] },
        { id: 'developer', name: null, toolIds: ['tool-base'] },
        { id: 'utilities', name: null, toolIds: ['tool-date'] },
      ],
      hiddenToolIds: [],
    });
  });

  it('falls back to the default arrangement for every unusable record', () => {
    const fallback = { ...buildDefaultHomeLayout(categoryIds, catalog), isCustomized: false };
    expect(resolveHomeLayout(null, context)).toEqual(fallback);
    expect(resolveHomeLayout('{not json', context)).toEqual(fallback);
    expect(resolveHomeLayout('"a string"', context)).toEqual(fallback);
    expect(resolveHomeLayout(storedRecord({ groups: [] }), context)).toEqual(fallback);
    expect(resolveHomeLayout(
      storedRecord({ groups: [{ id: 'text', toolIds: ['tool-wc'] }] }, 99),
      context,
    )).toEqual(fallback);
  });
});

describe('home layout sanitizing', () => {
  it('drops unknown, duplicated, and surplus entries', () => {
    const layout = sanitizeHomeLayout({
      groups: [
        { id: 'text', name: '  Writing  ', toolIds: ['tool-wc', 'tool-wc', 'tool-retired', 7] },
        { id: 'text', name: 'Duplicate id', toolIds: ['tool-casing'] },
        { id: '  ', toolIds: ['tool-base'] },
        'not a group',
        { id: 'group-1', name: 42, toolIds: ['tool-casing', 'tool-wc'] },
      ],
      hiddenToolIds: ['tool-base', 'tool-casing', 'tool-retired'],
    }, catalog);

    expect(layout).toEqual({
      groups: [
        { id: 'text', name: 'Writing', toolIds: ['tool-wc'] },
        { id: 'group-1', name: null, toolIds: ['tool-casing'] },
      ],
      hiddenToolIds: ['tool-base'],
    });
  });

  it('bounds the group count and the group name', () => {
    const groups = Array.from({ length: HOME_LAYOUT_MAX_GROUPS + 4 }, (_, index) => ({
      id: `group-${index}`,
      toolIds: [],
    }));
    expect(sanitizeHomeLayout({ groups }, catalog).groups).toHaveLength(HOME_LAYOUT_MAX_GROUPS);
    expect(sanitizeGroupName('  ')).toBeNull();
    expect(sanitizeGroupName(null)).toBeNull();
    expect(sanitizeGroupName('x'.repeat(HOME_LAYOUT_MAX_NAME_LENGTH + 10)))
      .toHaveLength(HOME_LAYOUT_MAX_NAME_LENGTH);
  });
});

describe('home layout resolution', () => {
  it('keeps a stored arrangement and reports it as customized', () => {
    const record = storedRecord({
      groups: [
        { id: 'group-1', name: 'Favourites', toolIds: ['tool-date', 'tool-wc'] },
        { id: 'developer', name: null, toolIds: ['tool-base'] },
      ],
      hiddenToolIds: ['tool-casing'],
    });

    expect(resolveHomeLayout(record, context)).toEqual({
      groups: [
        { id: 'group-1', name: 'Favourites', toolIds: ['tool-date', 'tool-wc'] },
        { id: 'developer', name: null, toolIds: ['tool-base'] },
      ],
      hiddenToolIds: ['tool-casing'],
      isCustomized: true,
    });
  });

  it('adopts a tool the stored record never saw into its own category group', () => {
    const record = storedRecord({
      groups: [{ id: 'text', name: null, toolIds: ['tool-wc'] }, { id: 'developer', name: null, toolIds: [] }],
      hiddenToolIds: [],
    });
    const released = [...catalog, { id: 'tool-new', category: 'developer' }];

    const resolved = resolveHomeLayout(record, { categoryIds, catalog: released });
    expect(resolved.groups[1].toolIds).toContain('tool-new');
    // Every unplaced tool joins its own category group, keeping what the reader
    // did arrange exactly where they put it.
    expect(resolved.groups[0].toolIds).toEqual(['tool-wc', 'tool-casing']);
  });

  it('adopts a tool into the last group when its category group is gone', () => {
    const record = storedRecord({
      groups: [{ id: 'group-1', name: 'Everything', toolIds: ['tool-wc'] }],
      hiddenToolIds: [],
    });

    const resolved = resolveHomeLayout(record, context);
    expect(resolved.groups[0].toolIds).toEqual(['tool-wc', 'tool-casing', 'tool-base', 'tool-date']);
    // A tool outside the homepage categories has never had a group to live in.
    expect(resolved.groups[0].toolIds).not.toContain('tool-policy');
  });

  it('leaves a hidden tool hidden instead of re-adopting it', () => {
    const record = storedRecord({
      groups: [{ id: 'text', name: null, toolIds: ['tool-wc'] }],
      hiddenToolIds: ['tool-casing'],
    });

    const resolved = resolveHomeLayout(record, context);
    expect(resolved.hiddenToolIds).toEqual(['tool-casing']);
    expect(resolved.groups[0].toolIds).not.toContain('tool-casing');
  });
});

describe('home layout persistence', () => {
  it('persists a sanitized arrangement and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHomeLayout(listener);

    saveHomeLayout({
      groups: [{ id: 'text', name: 'Writing', toolIds: ['tool-wc', 'tool-retired'] }],
      hiddenToolIds: ['tool-base'],
    }, catalog);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readRawHomeLayout() ?? '{}')).toEqual({
      version: HOME_LAYOUT_VERSION,
      groups: [{ id: 'text', name: 'Writing', toolIds: ['tool-wc'] }],
      hiddenToolIds: ['tool-base'],
    });

    resetHomeLayout();
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(readRawHomeLayout()).toBeNull();
    unsubscribe();
  });

  it('refuses to store an arrangement without a group', () => {
    saveHomeLayout({ groups: [], hiddenToolIds: [] }, catalog);
    expect(readRawHomeLayout()).toBeNull();
  });

  it('keeps the session usable when Web Storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    saveHomeLayout({ groups: [{ id: 'text', name: null, toolIds: ['tool-wc'] }], hiddenToolIds: [] }, catalog);
    expect(JSON.parse(readRawHomeLayout() ?? '{}').groups).toEqual([
      { id: 'text', name: null, toolIds: ['tool-wc'] },
    ]);
  });

  it('reacts to a layout event raised by another tab', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHomeLayout(listener);
    window.dispatchEvent(new Event(HOME_LAYOUT_EVENT));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('home layout edits', () => {
  const layout = {
    groups: [
      { id: 'text', name: null, toolIds: ['tool-wc', 'tool-casing'] },
      { id: 'developer', name: null, toolIds: ['tool-base'] },
    ],
    hiddenToolIds: ['tool-date'],
  };

  it('adds a group with the first free generated id', () => {
    expect(withGroupAdded(layout).groups.at(-1)).toEqual({ id: 'group-1', name: null, toolIds: [] });
    const taken = { ...layout, groups: [...layout.groups, { id: 'group-1', name: null, toolIds: [] }] };
    expect(withGroupAdded(taken).groups.at(-1).id).toBe('group-2');
    const full = {
      groups: Array.from({ length: HOME_LAYOUT_MAX_GROUPS }, (_, index) => ({
        id: `group-${index}`,
        name: null,
        toolIds: [],
      })),
      hiddenToolIds: [],
    };
    expect(withGroupAdded(full)).toBe(full);
  });

  it('hides the tools of a removed group instead of dropping them', () => {
    expect(withGroupRemoved(layout, 'text')).toEqual({
      groups: [{ id: 'developer', name: null, toolIds: ['tool-base'] }],
      hiddenToolIds: ['tool-date', 'tool-wc', 'tool-casing'],
    });
    expect(withGroupRemoved(layout, 'missing')).toBe(layout);
    const single = { groups: [layout.groups[0]], hiddenToolIds: [] };
    expect(withGroupRemoved(single, 'text')).toBe(single);
  });

  it('renames a group and clears an empty name', () => {
    expect(withGroupRenamed(layout, 'text', '  Writing ').groups[0].name).toBe('Writing');
    const named = withGroupRenamed(layout, 'text', 'Writing');
    expect(withGroupRenamed(named, 'text', '   ').groups[0].name).toBeNull();
    expect(withGroupRenamed(layout, 'text', '')).toBe(layout);
    expect(withGroupRenamed(layout, 'missing', 'Writing')).toBe(layout);
  });

  it('moves a group without wrapping at the ends', () => {
    expect(withGroupMoved(layout, 'developer', -1).groups.map((group) => group.id))
      .toEqual(['developer', 'text']);
    expect(withGroupMoved(layout, 'text', -1)).toBe(layout);
    expect(withGroupMoved(layout, 'developer', 1)).toBe(layout);
  });

  it('moves a tool between groups and back out of the hidden list', () => {
    expect(withToolPlaced(layout, 'tool-wc', 'developer')).toEqual({
      groups: [
        { id: 'text', name: null, toolIds: ['tool-casing'] },
        { id: 'developer', name: null, toolIds: ['tool-base', 'tool-wc'] },
      ],
      hiddenToolIds: ['tool-date'],
    });
    expect(withToolPlaced(layout, 'tool-date', 'text')).toEqual({
      groups: [
        { id: 'text', name: null, toolIds: ['tool-wc', 'tool-casing', 'tool-date'] },
        { id: 'developer', name: null, toolIds: ['tool-base'] },
      ],
      hiddenToolIds: [],
    });
    expect(withToolPlaced(layout, 'tool-wc', 'text')).toBe(layout);
    expect(withToolPlaced(layout, 'tool-wc', 'missing')).toBe(layout);
  });

  it('hides a placed tool once', () => {
    expect(withToolHidden(layout, 'tool-casing')).toEqual({
      groups: [
        { id: 'text', name: null, toolIds: ['tool-wc'] },
        { id: 'developer', name: null, toolIds: ['tool-base'] },
      ],
      hiddenToolIds: ['tool-date', 'tool-casing'],
    });
    expect(withToolHidden(layout, 'tool-date')).toBe(layout);
  });

  it('reorders a tool inside its own group', () => {
    expect(withToolMovedInGroup(layout, 'text', 'tool-casing', -1).groups[0].toolIds)
      .toEqual(['tool-casing', 'tool-wc']);
    expect(withToolMovedInGroup(layout, 'text', 'tool-casing', 1)).toBe(layout);
    expect(withToolMovedInGroup(layout, 'text', 'tool-base', -1)).toBe(layout);
    expect(withToolMovedInGroup(layout, 'missing', 'tool-wc', 1)).toBe(layout);
  });
});
