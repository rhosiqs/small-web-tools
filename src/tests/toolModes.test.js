import { describe, expect, it } from 'vitest';
import { NAVIGATION_ROUTES } from '../toolRegistry.js';
import {
  AUDIENCE_MODES,
  INTENTIONAL_CURATED_EXCLUSIONS,
  SIMPLE_WORKSPACE,
  TOOL_MODES,
  buildModeUrl,
  filterToolsForMode,
  getModeIdFromLocation,
  getRouteIdFromLocation,
  getToolMode,
  isToolPath,
} from '../toolModes.js';

describe('tool modes', () => {
  it('keeps the requested audiences separate from the simplified workspace', () => {
    expect(TOOL_MODES.map(({ id }) => id)).toEqual([
      'all',
      'daily',
      'developer',
      'bioinformatics',
      'designer',
      'student',
    ]);
    expect(SIMPLE_WORKSPACE.simplified).toBe(true);
    expect(SIMPLE_WORKSPACE.toolIds).toHaveLength(8);
    expect(getToolMode('simple')).toBe(SIMPLE_WORKSPACE);
    expect(getToolMode('unknown').id).toBe('all');
    expect(AUDIENCE_MODES.map(({ id }) => id)).toEqual([
      'all',
      'daily',
      'developer',
      'bioinformatics',
      'designer',
      'student',
    ]);
  });

  it('references only registered tools and provides a useful set for every mode', () => {
    const registeredIds = new Set(NAVIGATION_ROUTES.map(({ id }) => id));
    for (const mode of TOOL_MODES.filter(({ id }) => id !== 'all')) {
      expect(mode.toolIds.length, mode.id).toBeGreaterThanOrEqual(7);
      expect(mode.toolIds.every((id) => registeredIds.has(id)), mode.id).toBe(true);
      expect(filterToolsForMode(NAVIGATION_ROUTES, mode.id).map(({ id }) => id))
        .toEqual(NAVIGATION_ROUTES.filter(({ id }) => mode.toolIds.includes(id)).map(({ id }) => id));
    }
    expect(SIMPLE_WORKSPACE.toolIds.length)
      .toBeLessThan(getToolMode('daily').toolIds.length);
  });

  it('curates every navigable tool or records a durable exclusion rationale', () => {
    const curatedIds = new Set([
      ...TOOL_MODES.flatMap((mode) => mode.toolIds ?? []),
      ...SIMPLE_WORKSPACE.toolIds,
    ]);
    const navigableIds = NAVIGATION_ROUTES.map(({ id }) => id);
    const missingIds = navigableIds.filter((id) => !curatedIds.has(id));

    expect(missingIds.sort()).toEqual(Object.keys(INTENTIONAL_CURATED_EXCLUSIONS).sort());
    for (const [id, rationale] of Object.entries(INTENTIONAL_CURATED_EXCLUSIONS)) {
      expect(navigableIds, id).toContain(id);
      expect(rationale.length, id).toBeGreaterThan(20);
    }
    expect(getToolMode('developer').toolIds).toContain('tool-mermaid');
  });

  it('builds complete bookmarkable addresses and reads the selected mode', () => {
    expect(buildModeUrl('https://tools.example/app?ref=test#tool-wc', 'developer'))
      .toBe('https://tools.example/home/developer');
    expect(buildModeUrl('https://tools.example/app?mode=developer#tool-wc', 'developer', 'tool-code-preview'))
      .toBe('https://tools.example/home/developer/code-preview');
    expect(buildModeUrl('https://tools.example/app#tool-wc', 'all', 'tool-color'))
      .toBe('https://tools.example/home/color');
    expect(buildModeUrl('https://tools.example/app?mode=simple#tool-home', 'all'))
      .toBe('https://tools.example/home');
    expect(buildModeUrl('https://tools.example/home/simple/tool-color', 'simple'))
      .toBe('https://tools.example/simple');
    expect(buildModeUrl('https://tools.example/home/simple/tool-color', 'simple', 'tool-color'))
      .toBe('https://tools.example/simple/color');
    expect(getModeIdFromLocation('/home/bioinformatics')).toBe('bioinformatics');
    expect(getModeIdFromLocation('/home/student/wc')).toBe('student');
    expect(getModeIdFromLocation('/home/unknown')).toBe('all');
    expect(getModeIdFromLocation('/', '?mode=designer')).toBe('designer');
    expect(getModeIdFromLocation('/simple/color')).toBe('simple');
    expect(getModeIdFromLocation('/home/simple/color')).toBe('simple');
    expect(getRouteIdFromLocation('/home/developer/code-preview')).toBe('tool-code-preview');
    expect(getRouteIdFromLocation('/home/color')).toBe('tool-color');
    expect(getRouteIdFromLocation('/home/tool-color')).toBe('tool-color');
    expect(getRouteIdFromLocation('/home/developer')).toBe('tool-home');
    expect(getRouteIdFromLocation('/simple/color')).toBe('tool-color');
    expect(getRouteIdFromLocation('/home/simple/color')).toBe('tool-color');
    expect(getRouteIdFromLocation('/', '#tool-wc')).toBe('tool-wc');
    expect(isToolPath('/home/developer/code-preview')).toBe(true);
    expect(isToolPath('/simple/code-preview')).toBe(true);
    expect(isToolPath('/')).toBe(false);
  });
});
