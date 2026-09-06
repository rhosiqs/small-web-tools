import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  SIMPLE_LAYOUT_MAX_TOOLS,
  SIMPLE_LAYOUT_MIN_TOOLS,
  readRawSimpleLayout,
  resetSimpleLayout,
  resolveSimpleLayout,
  saveSimpleLayout,
  subscribeSimpleLayout,
  withToolAdded,
  withToolMoved,
  withToolRemoved,
} from '../lib/simpleLayout.js';

function readServerSnapshot() {
  return null;
}

/**
 * Own the Simple workspace shortcut layout. Every consumer subscribes to the
 * same stored record, so the launcher and the shell sidebar stay in step
 * without passing the editor state through the tree.
 *
 * @param {string[]} availableIds Ids the registry currently serves.
 */
export function useSimpleLayout(availableIds) {
  const record = useSyncExternalStore(subscribeSimpleLayout, readRawSimpleLayout, readServerSnapshot);
  const { toolIds, isCustomized } = useMemo(
    () => resolveSimpleLayout(record, availableIds),
    [record, availableIds],
  );

  const commit = useCallback((next) => {
    if (next !== toolIds) saveSimpleLayout(next, availableIds);
  }, [availableIds, toolIds]);

  return {
    toolIds,
    isCustomized,
    canAddTool: toolIds.length < SIMPLE_LAYOUT_MAX_TOOLS,
    canRemoveTool: toolIds.length > SIMPLE_LAYOUT_MIN_TOOLS,
    maxTools: SIMPLE_LAYOUT_MAX_TOOLS,
    addTool: useCallback((toolId) => commit(withToolAdded(toolIds, toolId)), [commit, toolIds]),
    removeTool: useCallback((toolId) => commit(withToolRemoved(toolIds, toolId)), [commit, toolIds]),
    moveTool: useCallback(
      (toolId, offset) => commit(withToolMoved(toolIds, toolId, offset)),
      [commit, toolIds],
    ),
    resetLayout: useCallback(() => resetSimpleLayout(), []),
  };
}
