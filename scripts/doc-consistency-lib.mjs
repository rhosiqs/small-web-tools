// Document pages are registry routes without the `tool-` prefix; they must stay
// in the architecture route inventory like every other route.
const DOCUMENT_ROUTE_IDS = ['about', 'privacy', 'consent', 'terms', 'security', 'license'];
const ROUTE_ID_ALTERNATION = `tool-[^'"\`\\s|]+|${DOCUMENT_ROUTE_IDS.join('|')}`;
const PUBLIC_ROUTE_PATTERN = new RegExp(`\\broute\\(\\s*['"](${ROUTE_ID_ALTERNATION})['"]`, 'gu');
const ROUTE_TABLE_PATTERN = new RegExp(`^\\|\\s*\`?(${ROUTE_ID_ALTERNATION})\`?\\s*\\|`, 'gmu');
const API_PATH_PATTERN = /`(\/api\/[a-z0-9-]+)`/giu;
const APP_ROUTE_PATTERN = /`(\/(?:home|simple)(?:\/[a-z0-9-]+)*)`/giu;
const COMMAND_PATTERN = /`((?:npm|npx)\s+[^`\n]+)`/gu;
const NODE_VERSION_PATTERN = /Node\.js\s+(\d+)/gu;

export function extractRegistryRouteIds(source) {
  return [...String(source).matchAll(PUBLIC_ROUTE_PATTERN)].map((match) => match[1]);
}

export function extractDocumentedRouteIds(markdown) {
  return new Set([...String(markdown).matchAll(ROUTE_TABLE_PATTERN)].map((match) => match[1]));
}

export function collectTechnicalTokens(markdown) {
  const source = String(markdown);
  return new Set([
    ...[...source.matchAll(API_PATH_PATTERN)].map((match) => match[1]),
    ...[...source.matchAll(APP_ROUTE_PATTERN)].map((match) => match[1]),
    ...[...source.matchAll(COMMAND_PATTERN)].map((match) => match[1]),
    ...[...source.matchAll(NODE_VERSION_PATTERN)].map((match) => `Node.js ${match[1]}`),
  ]);
}

export function findMissingTokens(sourceMarkdown, companionMarkdown) {
  const companion = String(companionMarkdown);
  return [...collectTechnicalTokens(sourceMarkdown)]
    .filter((token) => !companion.includes(token))
    .sort();
}

export function findMissingRoutes(registrySource, architectureMarkdown) {
  const documentedRoutes = extractDocumentedRouteIds(architectureMarkdown);
  return extractRegistryRouteIds(registrySource)
    .filter((routeId) => !documentedRoutes.has(routeId));
}
