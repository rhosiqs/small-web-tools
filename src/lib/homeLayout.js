/**
 * The full homepage ships one group per category, but readers organize their
 * work differently. The custom arrangement is a browser-only preference: it
 * never leaves the device, so it is stored as one local-storage record and
 * mirrored in memory for browsers that block Web Storage.
 *
 * A record holds the groups the reader arranged plus the tools they pushed off
 * the homepage. Tools the record has never seen — anything released after it
 * was written — are adopted into their category group on read, so a stored
 * layout never hides a new tool and never needs manual upkeep.
 */
export const HOME_LAYOUT_STORAGE_KEY = 'homeLayout';
export const HOME_LAYOUT_EVENT = 'home_layout_updated';
export const HOME_LAYOUT_VERSION = 1;
export const HOME_LAYOUT_MIN_GROUPS = 1;
export const HOME_LAYOUT_MAX_GROUPS = 12;
export const HOME_LAYOUT_MAX_NAME_LENGTH = 40;
export const CUSTOM_GROUP_ID_PREFIX = 'group-';

/**
 * @typedef {{ id: string, name: string | null, toolIds: string[] }} HomeGroup
 * @typedef {{ groups: HomeGroup[], hiddenToolIds: string[] }} HomeLayout
 * @typedef {{ id: string, category?: string }} CatalogTool
 * @typedef {{ categoryIds: Iterable<string>, catalog: Iterable<CatalogTool> }} HomeLayoutContext
 */

/** @type {string | null} */
let memoryRecord = null;

/**
 * Read the raw stored record. The value is a string so subscribers can compare
 * snapshots by identity instead of re-parsing on every render.
 *
 * @returns {string | null}
 */
export function readRawHomeLayout() {
  try {
    return localStorage.getItem(HOME_LAYOUT_STORAGE_KEY) ?? memoryRecord;
  } catch {
    // Web Storage can be blocked; the in-memory mirror keeps the session usable.
    return memoryRecord;
  }
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeHomeLayout(listener) {
  window.addEventListener(HOME_LAYOUT_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(HOME_LAYOUT_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * @param {string | null} record
 */
function publish(record) {
  memoryRecord = record;
  try {
    if (record === null) localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
    else localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, record);
  } catch {
    // Web Storage can be blocked; the layout still applies for this session.
  }
  window.dispatchEvent(new Event(HOME_LAYOUT_EVENT));
}

/**
 * Group names are reader-authored free text, so they are trimmed and bounded.
 * An empty name is stored as `null` and rendered with the built-in label, which
 * keeps an untouched category group following the interface language.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function sanitizeGroupName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().slice(0, HOME_LAYOUT_MAX_NAME_LENGTH).trim();
  return name === '' ? null : name;
}

/**
 * The default arrangement: one group per category, in category order, holding
 * that category's tools in registry order.
 *
 * @param {Iterable<string>} categoryIds
 * @param {Iterable<CatalogTool>} catalog
 * @returns {HomeLayout}
 */
export function buildDefaultHomeLayout(categoryIds, catalog) {
  /** @type {HomeGroup[]} */
  const groups = [...categoryIds].map((id) => ({ id, name: null, toolIds: [] }));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (const tool of catalog) {
    groupsById.get(tool.category)?.toolIds.push(tool.id);
  }
  return { groups, hiddenToolIds: [] };
}

/**
 * Reduce a candidate record to groups and tools the registry still serves.
 * Stored state is user-editable and survives releases, so unknown, duplicated,
 * and surplus entries are dropped rather than rendered. A tool is placed at
 * most once across the whole layout.
 *
 * @param {unknown} candidate
 * @param {Iterable<CatalogTool>} catalog
 * @returns {HomeLayout}
 */
export function sanitizeHomeLayout(candidate, catalog) {
  const available = new Set([...catalog].map((tool) => tool.id));
  const placed = new Set();
  const collect = (value) => {
    if (!Array.isArray(value)) return [];
    /** @type {string[]} */
    const toolIds = [];
    for (const id of value) {
      if (typeof id !== 'string' || !available.has(id) || placed.has(id)) continue;
      placed.add(id);
      toolIds.push(id);
    }
    return toolIds;
  };

  const source = /** @type {{ groups?: unknown, hiddenToolIds?: unknown }} */ (
    candidate && typeof candidate === 'object' ? candidate : {}
  );
  const rawGroups = Array.isArray(source.groups) ? source.groups : [];
  /** @type {HomeGroup[]} */
  const groups = [];
  const usedIds = new Set();
  for (const rawGroup of rawGroups) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    const id = typeof rawGroup.id === 'string' ? rawGroup.id.trim() : '';
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    groups.push({ id, name: sanitizeGroupName(rawGroup.name), toolIds: collect(rawGroup.toolIds) });
    if (groups.length === HOME_LAYOUT_MAX_GROUPS) break;
  }

  return { groups, hiddenToolIds: collect(source.hiddenToolIds) };
}

/**
 * Place tools the stored record never mentioned. A tool released after the
 * record was written belongs in its own category group; if the reader deleted
 * that group it lands in the last one, so the homepage always offers it.
 *
 * @param {HomeLayout} layout
 * @param {HomeLayoutContext} context
 * @returns {HomeLayout}
 */
function adoptUnplacedTools(layout, { categoryIds, catalog }) {
  const groups = layout.groups.map((group) => ({ ...group, toolIds: [...group.toolIds] }));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const known = new Set(layout.hiddenToolIds);
  for (const group of groups) for (const toolId of group.toolIds) known.add(toolId);
  const homeCategories = new Set(categoryIds);

  for (const tool of catalog) {
    if (known.has(tool.id)) continue;
    // A tool outside the homepage categories has never had a group to live in.
    if (!tool.category || !homeCategories.has(tool.category)) continue;
    const target = groupsById.get(tool.category) ?? groups[groups.length - 1];
    target.toolIds.push(tool.id);
  }

  return { groups, hiddenToolIds: [...layout.hiddenToolIds] };
}

/**
 * Resolve the arrangement to render from a stored record, falling back to the
 * category default whenever the record is absent or no longer usable.
 *
 * @param {string | null} record
 * @param {HomeLayoutContext} context
 * @returns {HomeLayout & { isCustomized: boolean }}
 */
export function resolveHomeLayout(record, context) {
  const fallback = {
    ...buildDefaultHomeLayout(context.categoryIds, context.catalog),
    isCustomized: false,
  };
  if (!record) return fallback;
  try {
    const parsed = JSON.parse(record);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== HOME_LAYOUT_VERSION) {
      return fallback;
    }
    const layout = sanitizeHomeLayout(parsed, context.catalog);
    if (layout.groups.length < HOME_LAYOUT_MIN_GROUPS) return fallback;
    return { ...adoptUnplacedTools(layout, context), isCustomized: true };
  } catch {
    return fallback;
  }
}

/**
 * @param {HomeLayout} layout
 * @param {Iterable<CatalogTool>} catalog
 */
export function saveHomeLayout(layout, catalog) {
  const sanitized = sanitizeHomeLayout(layout, catalog);
  if (sanitized.groups.length < HOME_LAYOUT_MIN_GROUPS) return;
  publish(JSON.stringify({ version: HOME_LAYOUT_VERSION, ...sanitized }));
}

export function resetHomeLayout() {
  publish(null);
}

/**
 * @param {HomeGroup[]} groups
 * @returns {string}
 */
function nextGroupId(groups) {
  const used = new Set(groups.map((group) => group.id));
  let sequence = 1;
  while (used.has(`${CUSTOM_GROUP_ID_PREFIX}${sequence}`)) sequence += 1;
  return `${CUSTOM_GROUP_ID_PREFIX}${sequence}`;
}

/**
 * @param {HomeLayout} layout
 * @returns {HomeLayout}
 */
export function withGroupAdded(layout) {
  if (layout.groups.length >= HOME_LAYOUT_MAX_GROUPS) return layout;
  const group = { id: nextGroupId(layout.groups), name: null, toolIds: [] };
  return { ...layout, groups: [...layout.groups, group] };
}

/**
 * Deleting a group keeps its tools: they move to the hidden list, where the
 * reader can put them back instead of losing them to a mistaken click.
 *
 * @param {HomeLayout} layout
 * @param {string} groupId
 * @returns {HomeLayout}
 */
export function withGroupRemoved(layout, groupId) {
  if (layout.groups.length <= HOME_LAYOUT_MIN_GROUPS) return layout;
  const group = layout.groups.find((entry) => entry.id === groupId);
  if (!group) return layout;
  return {
    groups: layout.groups.filter((entry) => entry.id !== groupId),
    hiddenToolIds: [...layout.hiddenToolIds, ...group.toolIds],
  };
}

/**
 * @param {HomeLayout} layout
 * @param {string} groupId
 * @param {string} name
 * @returns {HomeLayout}
 */
export function withGroupRenamed(layout, groupId, name) {
  const cleaned = sanitizeGroupName(name);
  const index = layout.groups.findIndex((entry) => entry.id === groupId);
  if (index < 0 || layout.groups[index].name === cleaned) return layout;
  const groups = [...layout.groups];
  groups[index] = { ...groups[index], name: cleaned };
  return { ...layout, groups };
}

/**
 * Move one group by `offset` positions, leaving the layout untouched at the
 * ends so the controls can stay visible instead of wrapping unexpectedly.
 *
 * @param {HomeLayout} layout
 * @param {string} groupId
 * @param {number} offset
 * @returns {HomeLayout}
 */
export function withGroupMoved(layout, groupId, offset) {
  const index = layout.groups.findIndex((entry) => entry.id === groupId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= layout.groups.length) return layout;
  const groups = [...layout.groups];
  const [group] = groups.splice(index, 1);
  groups.splice(target, 0, group);
  return { ...layout, groups };
}

/**
 * Put a tool at the end of one group, taking it out of its previous group or
 * out of the hidden list. This is both "move between groups" and "restore".
 *
 * @param {HomeLayout} layout
 * @param {string} toolId
 * @param {string} groupId
 * @returns {HomeLayout}
 */
export function withToolPlaced(layout, toolId, groupId) {
  const target = layout.groups.find((entry) => entry.id === groupId);
  if (!target || target.toolIds.includes(toolId)) return layout;
  const groups = layout.groups.map((group) => {
    if (group.id === groupId) return { ...group, toolIds: [...group.toolIds, toolId] };
    if (!group.toolIds.includes(toolId)) return group;
    return { ...group, toolIds: group.toolIds.filter((id) => id !== toolId) };
  });
  return { groups, hiddenToolIds: layout.hiddenToolIds.filter((id) => id !== toolId) };
}

/**
 * @param {HomeLayout} layout
 * @param {string} toolId
 * @returns {HomeLayout}
 */
export function withToolHidden(layout, toolId) {
  if (!layout.groups.some((group) => group.toolIds.includes(toolId))) return layout;
  return {
    groups: layout.groups.map((group) => (group.toolIds.includes(toolId)
      ? { ...group, toolIds: group.toolIds.filter((id) => id !== toolId) }
      : group)),
    hiddenToolIds: [...layout.hiddenToolIds, toolId],
  };
}

/**
 * Move one tool by `offset` positions inside its own group.
 *
 * @param {HomeLayout} layout
 * @param {string} groupId
 * @param {string} toolId
 * @param {number} offset
 * @returns {HomeLayout}
 */
export function withToolMovedInGroup(layout, groupId, toolId, offset) {
  const group = layout.groups.find((entry) => entry.id === groupId);
  if (!group) return layout;
  const index = group.toolIds.indexOf(toolId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= group.toolIds.length) return layout;
  const toolIds = [...group.toolIds];
  toolIds.splice(index, 1);
  toolIds.splice(target, 0, toolId);
  return {
    ...layout,
    groups: layout.groups.map((entry) => (entry.id === groupId ? { ...entry, toolIds } : entry)),
  };
}
