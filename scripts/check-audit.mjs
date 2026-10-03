import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const blockingSeverities = new Set(['moderate', 'high', 'critical']);
const exceptions = JSON.parse(await readFile('config/audit-exceptions.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const problems = [];

for (const exception of exceptions) {
  if (!/^GHSA-[\da-z]{4}-[\da-z]{4}-[\da-z]{4}$/u.test(exception.id ?? '')) {
    problems.push(`Exception has an invalid advisory id: ${JSON.stringify(exception.id)}.`);
  }
  for (const field of ['package', 'reason', 'removalCondition']) {
    if (!exception[field]) problems.push(`${exception.id}: "${field}" is required.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(exception.expires ?? '') || Number.isNaN(Date.parse(exception.expires))) {
    problems.push(`${exception.id}: "expires" must be a YYYY-MM-DD date.`);
  } else if (exception.expires < today) {
    problems.push(`${exception.id}: exception expired on ${exception.expires}; fix the advisory or review and renew it.`);
  }
}

const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  throw new Error(`npm audit did not return JSON (exit ${result.status}): ${result.stderr || result.stdout}`);
}
if (report.error) throw new Error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'string' || !blockingSeverities.has(via.severity)) continue;
    advisories.set(via.url.split('/').pop(), { package: via.name, severity: via.severity, title: via.title });
  }
}

const accepted = new Set(exceptions.map((exception) => exception.id));
for (const [id, advisory] of advisories) {
  if (!accepted.has(id)) problems.push(`${advisory.severity} ${advisory.package}: ${advisory.title} (${id})`);
}
for (const id of accepted) {
  if (!advisories.has(id)) console.warn(`Audit exception ${id} no longer matches an advisory; remove it from config/audit-exceptions.json.`);
}

if (problems.length) {
  console.error(`npm audit gate failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`npm audit gate passed (${advisories.size} advisories, ${[...advisories.keys()].filter((id) => accepted.has(id)).length} accepted by config/audit-exceptions.json).`);
