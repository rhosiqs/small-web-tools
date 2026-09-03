import fs from 'node:fs';
import path from 'node:path';
import { resolveRepositoryVersionDetails } from './resolve-version.mjs';
import { findMissingRoutes, findMissingTokens } from './doc-consistency-lib.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const appVersion = resolveRepositoryVersionDetails();
const docs = {
  README: read('README.md'),
  README_ZH_TW: read('README.zh-TW.md'),
  ARCHITECTURE: read('ARCHITECTURE.md'),
  ARCHITECTURE_ZH_TW: read('ARCHITECTURE.zh-TW.md'),
  CONTRIBUTING: read('CONTRIBUTING.md'),
  CONTRIBUTING_ZH_TW: read('CONTRIBUTING.zh-TW.md'),
  PRIVACY: read('PRIVACY.md'),
  PRIVACY_ZH_TW: read('PRIVACY.zh-TW.md'),
  SECURITY: read('SECURITY.md'),
  SECURITY_ZH_TW: read('SECURITY.zh-TW.md'),
  ABOUT: read('ABOUT.md'),
  ABOUT_ZH_TW: read('ABOUT.zh-TW.md'),
  TERMS: read('TERMS.md'),
  TERMS_ZH_TW: read('TERMS.zh-TW.md'),
  TODO: read('TODO.md'),
  AGENTS: read('.agents/AGENTS.md'),
};

const failures = [];
const requireText = (documentName, text, description = text) => {
  if (!docs[documentName].includes(text)) {
    failures.push(`${documentName.replaceAll('_ZH_TW', '.zh-TW')}.md is missing ${description}`);
  }
};

if (pkg.version !== '0.0.0-private') {
  failures.push('package.json must retain the non-release version placeholder 0.0.0-private');
}
requireText('ARCHITECTURE', 'Latest version-formatted Git tag', 'Git-tag version source');
requireText('ARCHITECTURE', '`0.0.0-private`', 'non-release npm version placeholder');
const npmVersion = pkg.packageManager.replace(/^npm@/, '');
for (const documentName of ['README', 'ARCHITECTURE', 'CONTRIBUTING']) {
  requireText(documentName, npmVersion, `pinned npm version ${npmVersion}`);
  requireText(`${documentName}_ZH_TW`, npmVersion, `pinned npm version ${npmVersion}`);
}
for (const major of ['22', '24']) {
  requireText('README', `Node.js ${major}`, `supported Node.js ${major}`);
  requireText('README_ZH_TW', `Node.js ${major}`, `supported Node.js ${major}`);
  requireText('ARCHITECTURE', major, `supported Node.js ${major}`);
  requireText('ARCHITECTURE_ZH_TW', major, `supported Node.js ${major}`);
}

for (const command of ['npm run dev', 'npm run build', 'npm run verify', 'npm run test:e2e']) {
  requireText('CONTRIBUTING', command, `command ${command}`);
  requireText('CONTRIBUTING_ZH_TW', command, `command ${command}`);
}

const apiFiles = fs.readdirSync(path.join(root, 'functions', 'api'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => `/api/${file.slice(0, -3)}`);
for (const endpoint of apiFiles) {
  requireText('ARCHITECTURE', endpoint, `API endpoint ${endpoint}`);
  requireText('ARCHITECTURE_ZH_TW', endpoint, `API endpoint ${endpoint}`);
}

const viteConfig = read('vite.config.js');
const mirroredEndpoints = [...viteConfig.matchAll(/startsWith\(['"]([^'"]*\/api\/[^'"]+)['"]\)/g)]
  .map((match) => match[1]);
const documentedMirror = /mirrors only (?:the )?IP lookup/i.test(docs.ARCHITECTURE)
  && /mirrors only (?:the )?IP lookup/i.test(docs.README)
  && docs.ARCHITECTURE_ZH_TW.includes('/api/iplookup')
  && docs.README_ZH_TW.includes('/api/iplookup');
if (mirroredEndpoints.join(',') !== '/api/iplookup' || !documentedMirror) {
  failures.push('local API mirrors must be exactly /api/iplookup and documented in both README and ARCHITECTURE language pairs');
}

requireText('CONTRIBUTING', 'Cloudflare Pages', 'Cloudflare Pages local-runtime guidance');
requireText('CONTRIBUTING_ZH_TW', 'Cloudflare Pages', 'Cloudflare Pages local-runtime guidance');
requireText('CONTRIBUTING', 'rate-limiter Worker', 'rate-limiter Worker guidance');
requireText('CONTRIBUTING_ZH_TW', 'rate-limiter', 'rate-limiter Worker guidance');

for (const documentName of ['README', 'ARCHITECTURE', 'PRIVACY']) {
  requireText(documentName, '/home/privacy', 'canonical privacy route /home/privacy');
  requireText(`${documentName}_ZH_TW`, '/home/privacy', 'canonical privacy route /home/privacy');
}

const networkServices = JSON.parse(read('config/network-services.json'));
const fontExtractor = networkServices.find((service) => service.id === 'fontextractor');
if (fontExtractor?.policyUrl !== '/home/privacy') {
  failures.push('Font Extractor policy URL must use the canonical /home/privacy route');
}

requireText('TODO', 'src/toolRegistry.js', 'canonical tool registration location');
requireText('TODO', 'npm run verify', 'baseline verification command');
requireText('AGENTS', 'canonical path', 'canonical path-routing guidance');
requireText('README', 'SECURITY.md', 'vulnerability disclosure policy link');
requireText('README_ZH_TW', 'SECURITY.zh-TW.md', 'vulnerability disclosure policy link');
requireText('README', 'ABOUT.md', 'project description link');
requireText('README_ZH_TW', 'ABOUT.zh-TW.md', 'project description link');
requireText('README', 'TERMS.md', 'terms of use link');
requireText('README_ZH_TW', 'TERMS.zh-TW.md', 'terms of use link');
requireText('TERMS', 'emailforvirtualmachine@gmail.com', 'operator contact');
requireText('TERMS', '/home/terms', 'canonical terms route /home/terms');
requireText('ABOUT', '/home/about', 'canonical about route /home/about');
requireText('SECURITY', 'emailforvirtualmachine@gmail.com', 'private reporting contact');
requireText('SECURITY', 'current `develop` revision', 'supported revision policy');
requireText('SECURITY', 'URL-fetching surface', 'URL-fetching scope');
requireText('SECURITY', 'file/media-processing tools', 'file-processing scope');

const registrySource = read('src/toolRegistry.js');
for (const [documentName, markdown] of [
  ['ARCHITECTURE.md', docs.ARCHITECTURE],
  ['ARCHITECTURE.zh-TW.md', docs.ARCHITECTURE_ZH_TW],
]) {
  for (const routeId of findMissingRoutes(registrySource, markdown)) {
    failures.push(`${documentName} route inventory is missing ${routeId}`);
  }
}

for (const [sourceName, companionName, source, companion] of [
  ['README.md', 'README.zh-TW.md', docs.README, docs.README_ZH_TW],
  ['CONTRIBUTING.md', 'CONTRIBUTING.zh-TW.md', docs.CONTRIBUTING, docs.CONTRIBUTING_ZH_TW],
  ['ARCHITECTURE.md', 'ARCHITECTURE.zh-TW.md', docs.ARCHITECTURE, docs.ARCHITECTURE_ZH_TW],
  ['PRIVACY.md', 'PRIVACY.zh-TW.md', docs.PRIVACY, docs.PRIVACY_ZH_TW],
  ['SECURITY.md', 'SECURITY.zh-TW.md', docs.SECURITY, docs.SECURITY_ZH_TW],
  ['ABOUT.md', 'ABOUT.zh-TW.md', docs.ABOUT, docs.ABOUT_ZH_TW],
  ['TERMS.md', 'TERMS.zh-TW.md', docs.TERMS, docs.TERMS_ZH_TW],
]) {
  for (const token of findMissingTokens(source, companion)) {
    failures.push(`${companionName} is missing technical token ${token} from ${sourceName}`);
  }
}

if (failures.length > 0) {
  console.error(`Documentation consistency check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Documentation consistency check passed (${appVersion.version} from ${appVersion.source}, Node ${pkg.engines.node}).`,
);
