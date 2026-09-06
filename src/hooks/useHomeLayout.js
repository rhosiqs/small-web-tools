import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  HOME_LAYOUT_MAX_GROUPS,
  HOME_LAYOUT_MIN_GROUPS,
  readRawHomeLayout,
  resetHomeLayout,
  resolveHomeLayout,
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

function readServerSnapshot() {
  return null;
}

/**
 * Own the homepage group arrangement. Every edit is written straight to the
 * stored record, so the dashboard saves itself the way the Simple workspace
 * does instead of asking the reader to confirm a layout.
 *
 * @param {import('../lib/homeLayout.js').CatalogTool[]} catalog Tools the registry currently serves.
 * @param {string[]} categoryIds Category ids in their presentation order.
 */
export function useHomeLayout(catalog, categoryIds) {
  const record = useSyncExternalStore(subscribeHomeLayout, readRawHomeLayout, readServerSnapshot);
  const { groups, hiddenToolIds, isCustomized } = useMemo(
    () => resolveHomeLayout(record, { categoryIds, catalog }),
    [catalog, categoryIds, record],
  );

  const layout = useMemo(() => ({ groups, hiddenToolIds }), [groups, hiddenToolIds]);
  const commit = useCallback((next) => {
    if (next !== layout) saveHomeLayout(next, catalog);
  }, [catalog, layout]);

  return {
    groups,
    hiddenToolIds,
    isCustomized,
    canAddGroup: groups.length < HOME_LAYOUT_MAX_GROUPS,
    canRemoveGroup: groups.length > HOME_LAYOUT_MIN_GROUPS,
    maxGroups: HOME_LAYOUT_MAX_GROUPS,
    addGroup: useCallback(() => commit(withGroupAdded(layout)), [commit, layout]),
    removeGroup: useCallback((groupId) => commit(withGroupRemoved(layout, groupId)), [commit, layout]),
    renameGroup: useCallback(
      (groupId, name) => commit(withGroupRenamed(layout, groupId, name)),
      [commit, layout],
    ),
    moveGroup: useCallback(
      (groupId, offset) => commit(withGroupMoved(layout, groupId, offset)),
      [commit, layout],
    ),
    placeTool: useCallback(
      (toolId, groupId) => commit(withToolPlaced(layout, toolId, groupId)),
      [commit, layout],
    ),
    hideTool: useCallback((toolId) => commit(withToolHidden(layout, toolId)), [commit, layout]),
    moveTool: useCallback(
      (groupId, toolId, offset) => commit(withToolMovedInGroup(layout, groupId, toolId, offset)),
      [commit, layout],
    ),
    resetLayout: useCallback(() => resetHomeLayout(), []),
  };
}
