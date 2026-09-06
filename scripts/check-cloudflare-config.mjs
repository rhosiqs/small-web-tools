import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { validateRateLimitConfiguration } from '../config/rateLimitPolicies.js';
import {
  FONT_EXTRACTION_EGRESS_POLICY,
  expectedEgressPosture,
  formatEgressPosture,
} from '../functions/_shared/fontExtractionCapability.js';

const root = process.cwd();
const pagesConfig = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const workerConfig = JSON.parse(await readFile(
  path.join(root, 'workers/rate-limiter/wrangler.jsonc'),
  'utf8',
));
const ssrfConfig = JSON.parse(await readFile(
  path.join(root, 'test/integration/ssrf-worker/wrangler.jsonc'),
  'utf8',
));
const ssrfTargetConfig = JSON.parse(await readFile(
  path.join(root, 'test/integration/ssrf-target-worker/wrangler.jsonc'),
  'utf8',
));

const service = pagesConfig.services?.find((item) => item.binding === 'RATE_LIMITER_SERVICE');
if (service?.service !== workerConfig.name) {
  throw new Error('RATE_LIMITER_SERVICE must target the version-controlled limiter Worker.');
}
if (pagesConfig.vars?.RATE_LIMIT_DEVELOPMENT_MODE !== 'false') {
  throw new Error('Production Pages configuration must fail closed.');
}
if (!pagesConfig.compatibility_flags?.includes('global_fetch_strictly_public')) {
  throw new Error('Production Pages Functions must force public-Internet fetch routing.');
}

// Font Extractor is enabled at runtime only when the deployment reports the
// egress posture that `npm run test:ssrf-runtime` verified. Two checks keep that
// report honest: it must describe the compatibility settings actually deployed
// beside it, and it must match the verified policy. Bumping the compatibility
// date therefore fails here until the runtime verification is re-run and
// `FONT_EXTRACTION_EGRESS_POLICY` is updated to record the new result.
const deployedPosture = formatEgressPosture({
  compatibilityDate: pagesConfig.compatibility_date,
  compatibilityFlags: pagesConfig.compatibility_flags.filter(
    (flag) => FONT_EXTRACTION_EGRESS_POLICY.compatibilityFlags.includes(flag),
  ),
  implementationRevision: FONT_EXTRACTION_EGRESS_POLICY.implementationRevision,
});
if (pagesConfig.vars?.FONT_EXTRACTION_EGRESS_POSTURE !== deployedPosture) {
  throw new Error(
    'FONT_EXTRACTION_EGRESS_POSTURE must describe the deployed compatibility settings. '
    + `Expected "${deployedPosture}".`,
  );
}
if (deployedPosture !== expectedEgressPosture()) {
  throw new Error(
    'The deployed egress posture no longer matches the verified runtime record. '
    + 'Re-run `npm run test:ssrf-runtime` and update FONT_EXTRACTION_EGRESS_POLICY.',
  );
}

validateRateLimitConfiguration(workerConfig.ratelimits);
if (!ssrfConfig.compatibility_flags?.includes('global_fetch_strictly_public')) {
  throw new Error('The SSRF runtime harness must force public-Internet fetch routing.');
}
if (!ssrfConfig.workers_dev || !ssrfTargetConfig.workers_dev) {
  throw new Error('Temporary SSRF verification Workers must expose short-lived test URLs.');
}

const wranglerBin = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const tempOutput = path.join(root, '.tmp-cloudflare-check');
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: 'false',
  WRANGLER_LOG_PATH: path.join(tempOutput, 'logs'),
};

function run(args) {
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }
}

try {
  run(['deploy', '--dry-run', '--config', 'workers/rate-limiter/wrangler.jsonc']);
  run(['deploy', '--dry-run', '--config', 'test/integration/ssrf-target-worker/wrangler.jsonc']);
  run(['deploy', '--dry-run', '--config', 'test/integration/ssrf-worker/wrangler.jsonc']);
  run(['pages', 'functions', 'build', '--outdir', tempOutput]);
} finally {
  await rm(tempOutput, { recursive: true, force: true });
}

console.log('Cloudflare Pages service binding and Rate Limiting Worker configuration are valid.');
