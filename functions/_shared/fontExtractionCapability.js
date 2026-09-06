/**
 * Font Extractor is the only Function that fetches an arbitrary user-supplied
 * origin, so it stays disabled unless the deployment it runs in matches the
 * egress posture that `npm run test:ssrf-runtime` actually verified.
 *
 * The record below is what a human verified on a real Cloudflare runtime. It
 * changes only when that verification is re-run. The deployment reports what it
 * is really running through the `FONT_EXTRACTION_EGRESS_POSTURE` variable in
 * `wrangler.jsonc`, which `scripts/check-cloudflare-config.mjs` keeps in sync
 * with the neighbouring `compatibility_date` and `compatibility_flags`.
 *
 * The gate therefore closes exactly when the runtime the code was verified
 * against stops being the runtime it is deployed on — a real regression — and
 * never merely because time has passed. An earlier revision expired its
 * evidence after 30 days, which took the tool offline every month for no
 * security reason and required a manual secret rotation to restore.
 */
export const FONT_EXTRACTION_EGRESS_POLICY = Object.freeze({
  schemaVersion: 2,
  runtime: 'cloudflare-workers',
  compatibilityDate: '2026-07-23',
  compatibilityFlags: Object.freeze(['global_fetch_strictly_public']),
  implementationRevision: 'safe-external-fetch-v2',
  // Informational: when the recorded runtime verification last passed. It is
  // deliberately not an expiry, and nothing fails because it grows old.
  verifiedOn: '2026-08-07',
  requiredScenarios: Object.freeze([
    'public-control',
    'public-to-private-dns-change',
    'mixed-public-private-addresses',
    'ipv4-mapped-ipv6',
    'redirect-hop-validation',
    'same-zone-routing',
    'cancellation-timeout',
  ]),
});

/**
 * Serialize a posture record into the single-line form carried by the
 * `FONT_EXTRACTION_EGRESS_POSTURE` deployment variable. Both the Function and
 * the configuration check build the expected string with this helper so the two
 * can never drift apart through a formatting difference.
 */
export function formatEgressPosture({ compatibilityDate, compatibilityFlags, implementationRevision }) {
  const flags = [...compatibilityFlags].sort().join(',');
  return `compatibility-date=${compatibilityDate};flags=${flags};fetch-implementation=${implementationRevision}`;
}

export function expectedEgressPosture() {
  return formatEgressPosture(FONT_EXTRACTION_EGRESS_POLICY);
}

function parsePosture(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const fields = new Map();
  for (const part of value.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const compatibilityDate = fields.get('compatibility-date');
  const flags = fields.get('flags');
  const implementationRevision = fields.get('fetch-implementation');
  if (!compatibilityDate || !flags || !implementationRevision) return null;
  return {
    compatibilityDate,
    compatibilityFlags: flags.split(',').filter(Boolean),
    implementationRevision,
  };
}

export function evaluateFontExtractionCapability(env = {}) {
  const posture = parsePosture(env.FONT_EXTRACTION_EGRESS_POSTURE);
  if (!posture) return { enabled: false, reason: 'posture-missing-or-malformed' };

  const policy = FONT_EXTRACTION_EGRESS_POLICY;
  if (
    posture.compatibilityDate !== policy.compatibilityDate
    || posture.implementationRevision !== policy.implementationRevision
  ) {
    return { enabled: false, reason: 'posture-unverified-runtime' };
  }

  const declaredFlags = new Set(posture.compatibilityFlags);
  if (policy.compatibilityFlags.some((flag) => !declaredFlags.has(flag))) {
    return { enabled: false, reason: 'posture-missing-egress-flag' };
  }

  return { enabled: true, reason: 'verified' };
}
