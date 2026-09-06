import { SIMPLE_WORKSPACE } from '../toolModes.js';

/**
 * Simple mode ships a curated shortcut row, but readers keep different tools at
 * hand. The custom layout is a browser-only preference: it never leaves the
 * device, so it is stored as one local-storage record and mirrored in memory for
 * browsers that block Web Storage.
 */
export const SIMPLE_LAYOUT_STORAGE_KEY = 'simpleLayout';
export const SIMPLE_LAYOUT_EVENT = 'simple_layout_updated';
export const SIMPLE_LAYOUT_VERSION = 1;
export const SIMPLE_LAYOUT_MIN_TOOLS = 1;
export const SIMPLE_LAYOUT_MAX_TOOLS = 12;
export const DEFAULT_SIMPLE_LAYOUT = Object.freeze([...SIMPLE_WORKSPACE.toolIds]);

/** @type {string | null} */
let memoryRecord = null;

/**
 * Read the raw stored record. The value is a string so subscribers can compare
 * snapshots by identity instead of re-parsing on every render.
 *
 * @returns {string | null}
 */
export function readRawSimpleLayout() {
  try {
    return localStorage.getItem(SIMPLE_LAYOUT_STORAGE_KEY) ?? memoryRecord;
  } catch {
    // Web Storage can be blocked; the in-memory mirror keeps the session usable.
    return memoryRecord;
  }
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeSimpleLayout(listener) {
  window.addEventListener(SIMPLE_LAYOUT_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(SIMPLE_LAYOUT_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

function publish(record) {
  memoryRecord = record;
  try {
    if (record === null) localStorage.removeItem(SIMPLE_LAYOUT_STORAGE_KEY);
    else localStorage.setItem(SIMPLE_LAYOUT_STORAGE_KEY, record);
  } catch {
    // Web Storage can be blocked; the layout still applies for this session.
  }
  window.dispatchEvent(new Event(SIMPLE_LAYOUT_EVENT));
}

/**
 * Reduce a candidate list to shortcuts the registry still serves. Stored state
 * is user-editable and survives releases, so unknown, duplicated, and surplus
 * ids are dropped rather than rendered.
 *
 * @param {unknown} candidate
 * @param {Iterable<string>} availableIds
 * @returns {string[]}
 */
export function sanitizeSimpleLayout(candidate, availableIds) {
  if (!Array.isArray(candidate)) return [];
  const available = availableIds instanceof Set ? availableIds : new Set(availableIds);
  /** @type {string[]} */
  const layout = [];
  for (const id of candidate) {
    if (typeof id !== 'string' || !available.has(id) || layout.includes(id)) continue;
    layout.push(id);
    if (layout.length === SIMPLE_LAYOUT_MAX_TOOLS) break;
  }
  return layout;
}

/**
 * Resolve the shortcuts to render from a stored record, falling back to the
 * curated workspace whenever the record is absent or no longer usable.
 *
 * @param {string | null} record
 * @param {Iterable<string>} availableIds
 * @returns {{ toolIds: string[], isCustomized: boolean }}
 */
export function resolveSimpleLayout(record, availableIds) {
  const available = availableIds instanceof Set ? availableIds : new Set(availableIds);
  const fallback = {
    toolIds: sanitizeSimpleLayout([...DEFAULT_SIMPLE_LAYOUT], available),
    isCustomized: false,
  };
  if (!record) return fallback;
  try {
    const parsed = JSON.parse(record);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SIMPLE_LAYOUT_VERSION) {
      return fallback;
    }
    const toolIds = sanitizeSimpleLayout(parsed.toolIds, available);
    return toolIds.length >= SIMPLE_LAYOUT_MIN_TOOLS ? { toolIds, isCustomized: true } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string[]} toolIds
 * @param {Iterable<string>} availableIds
 */
export function saveSimpleLayout(toolIds, availableIds) {
  const layout = sanitizeSimpleLayout(toolIds, availableIds);
  if (layout.length < SIMPLE_LAYOUT_MIN_TOOLS) return;
  publish(JSON.stringify({ version: SIMPLE_LAYOUT_VERSION, toolIds: layout }));
}

export function resetSimpleLayout() {
  publish(null);
}

/**
 * @param {string[]} layout
 * @param {string} toolId
 * @returns {string[]}
 */
export function withToolAdded(layout, toolId) {
  if (layout.includes(toolId) || layout.length >= SIMPLE_LAYOUT_MAX_TOOLS) return layout;
  return [...layout, toolId];
}

/**
 * @param {string[]} layout
 * @param {string} toolId
 * @returns {string[]}
 */
export function withToolRemoved(layout, toolId) {
  if (!layout.includes(toolId) || layout.length <= SIMPLE_LAYOUT_MIN_TOOLS) return layout;
  return layout.filter((id) => id !== toolId);
}

/**
 * Move one shortcut by `offset` positions, leaving the layout untouched at the
 * ends so the controls can stay visible instead of wrapping unexpectedly.
 *
 * @param {string[]} layout
 * @param {string} toolId
 * @param {number} offset
 * @returns {string[]}
 */
export function withToolMoved(layout, toolId, offset) {
  const index = layout.indexOf(toolId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= layout.length) return layout;
  const moved = [...layout];
  moved.splice(index, 1);
  moved.splice(target, 0, toolId);
  return moved;
}
