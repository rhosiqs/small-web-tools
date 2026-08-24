const DEFAULT_TOOL_MODE = {
  id: 'all',
  toolIds: null,
  simplified: false,
};

const modeDefinitions = [
  DEFAULT_TOOL_MODE,
  {
    id: 'daily',
    toolIds: [
      'tool-wc',
      'tool-casing',
      'tool-url',
      'tool-date',
      'tool-currency',
      'tool-qrcode',
      'tool-qrbarcodescan',
      'tool-password',
      'tool-pwstrength',
      'tool-wheel',
    ],
    simplified: false,
  },
  {
    id: 'developer',
    toolIds: [
      'tool-slash',
      'tool-ascii',
      'tool-unicode',
      'tool-url',
      'tool-markdown',
      'tool-mermaid',
      'tool-code-preview',
      'tool-fontextractor',
      'tool-base',
      'tool-folder-analyzer',
      'tool-iplookup',
    ],
    simplified: false,
  },
  {
    id: 'bioinformatics',
    toolIds: [
      'tool-dna',
      'tool-codon',
      'tool-phred',
      'tool-wc',
      'tool-markdown',
      'tool-code-preview',
      'tool-base',
    ],
    simplified: false,
  },
  {
    id: 'designer',
    toolIds: [
      'tool-color',
      'tool-svg-png',
      'tool-imgmeta',
      'tool-fontextractor',
      'tool-qrcode',
      'tool-barcode',
      'tool-markdown',
      'tool-code-preview',
    ],
    simplified: false,
  },
  {
    id: 'student',
    toolIds: [
      'tool-wc',
      'tool-casing',
      'tool-markdown',
      'tool-code-preview',
      'tool-base',
      'tool-date',
      'tool-roman',
      'tool-dna',
      'tool-codon',
    ],
    simplified: false,
  },
];

export const TOOL_MODES = modeDefinitions.map((mode) => ({
  ...mode,
  toolIds: mode.toolIds ? [...mode.toolIds] : null,
}));

export const AUDIENCE_MODES = [...TOOL_MODES];

export const SIMPLE_WORKSPACE = {
  id: 'simple',
  toolIds: [
    'tool-wc',
    'tool-casing',
    'tool-url',
    'tool-date',
    'tool-currency',
    'tool-color',
    'tool-qrcode',
    'tool-password',
  ],
  simplified: true,
};

export const INTENTIONAL_CURATED_EXCLUSIONS = Object.freeze({
  'tool-speedtest': 'Network diagnostics are situational rather than audience-specific.',
  'tool-docmeta': 'Document metadata inspection is retained in the complete toolkit for specialist use.',
  'tool-audiometa': 'Audio metadata inspection is retained in the complete toolkit for specialist use.',
  'tool-videometa': 'Video metadata inspection is retained in the complete toolkit for specialist use.',
  'tool-mediasplit': 'Media stream extraction is retained in the complete toolkit for specialist use.',
});

const modesById = new Map(TOOL_MODES.map((mode) => [mode.id, mode]));

export function getToolMode(modeId) {
  if (modeId === SIMPLE_WORKSPACE.id) {
    return SIMPLE_WORKSPACE;
  }
  return modesById.get(modeId) ?? DEFAULT_TOOL_MODE;
}

export function localizeToolMode(mode, t) {
  return {
    ...mode,
    label: t(`navigation:modes.${mode.id}.label`),
    heading: t(`navigation:modes.${mode.id}.heading`),
    description: t(`navigation:modes.${mode.id}.description`),
  };
}

function getPathSegments(pathname) {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

export function isToolPath(pathname) {
  const rootSegment = getPathSegments(pathname)[0];
  return rootSegment === 'home' || rootSegment === 'simple';
}

export function getModeIdFromLocation(pathname, search = '') {
  const pathSegments = getPathSegments(pathname);
  if (pathSegments[0] === 'simple') {
    return 'simple';
  }
  if (pathSegments[0] === 'home') {
    const pathModeId = pathSegments[1];
    if (pathModeId === 'simple') {
      return 'simple';
    }
    return pathModeId && pathModeId !== 'all' && modesById.has(pathModeId)
      ? pathModeId
      : 'all';
  }

  // Read old query-based links once so the app can redirect them to the
  // canonical path without breaking existing bookmarks.
  const legacyModeId = new URLSearchParams(search).get('mode');
  return getToolMode(legacyModeId).id;
}

export function getRouteIdFromLocation(pathname, hash = '') {
  const legacyRouteId = decodeURIComponent(hash.replace(/^#/, '').trim());
  if (legacyRouteId) {
    return legacyRouteId;
  }

  const pathSegments = getPathSegments(pathname);
  if (pathSegments[0] === 'simple') {
    const routeSlug = pathSegments[1];
    if (!routeSlug || routeSlug === 'home') {
      return 'tool-home';
    }
    if (routeSlug === 'privacy' || routeSlug.startsWith('tool-')) {
      return routeSlug;
    }
    return `tool-${routeSlug}`;
  }
  if (pathSegments[0] !== 'home') {
    return null;
  }

  const firstPathId = pathSegments[1];
  const hasModeSegment = firstPathId === 'simple'
    || (firstPathId && firstPathId !== 'all' && modesById.has(firstPathId));
  const routeSlug = hasModeSegment ? pathSegments[2] : firstPathId;
  if (!routeSlug || routeSlug === 'home') {
    return 'tool-home';
  }
  if (routeSlug === 'privacy' || routeSlug.startsWith('tool-')) {
    return routeSlug;
  }
  return `tool-${routeSlug}`;
}

export function filterToolsForMode(tools, modeId) {
  const profile = getToolMode(modeId);
  if (!profile.toolIds) return tools;
  const allowedIds = new Set(profile.toolIds);
  return tools.filter((tool) => allowedIds.has(tool.id));
}

export function buildModeUrl(currentHref, modeId, routeId = 'tool-home') {
  const profile = getToolMode(modeId);
  const url = new URL(currentHref);
  const pathSegments = profile.id === 'simple' ? ['simple'] : ['home'];
  if (profile.id !== 'all' && profile.id !== 'simple') {
    pathSegments.push(profile.id);
  }
  if (routeId !== 'tool-home') {
    pathSegments.push(routeId.replace(/^tool-/, ''));
  }
  url.pathname = `/${pathSegments.map(encodeURIComponent).join('/')}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
