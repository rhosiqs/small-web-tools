import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateFontExtractionCapability,
  expectedEgressPosture,
  formatEgressPosture,
  FONT_EXTRACTION_EGRESS_POLICY,
} from '../fontExtractionCapability.js';

function posture(overrides = {}) {
  return formatEgressPosture({
    compatibilityDate: FONT_EXTRACTION_EGRESS_POLICY.compatibilityDate,
    compatibilityFlags: [...FONT_EXTRACTION_EGRESS_POLICY.compatibilityFlags],
    implementationRevision: FONT_EXTRACTION_EGRESS_POLICY.implementationRevision,
    ...overrides,
  });
}

describe('font extraction egress capability', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['missing posture', undefined, 'posture-missing-or-malformed'],
    ['malformed posture', 'compatibility-date', 'posture-missing-or-malformed'],
    ['incomplete posture', 'compatibility-date=2026-07-23', 'posture-missing-or-malformed'],
    ['unverified compatibility date', posture({ compatibilityDate: '2026-07-22' }), 'posture-unverified-runtime'],
    ['unverified fetch implementation', posture({ implementationRevision: 'old' }), 'posture-unverified-runtime'],
    ['missing egress flag', posture({ compatibilityFlags: ['nodejs_compat'] }), 'posture-missing-egress-flag'],
    ['no flags at all', posture({ compatibilityFlags: [] }), 'posture-missing-or-malformed'],
  ])('fails closed for %s', (_label, value, reason) => {
    expect(evaluateFontExtractionCapability({
      FONT_EXTRACTION_EGRESS_POSTURE: value,
    })).toEqual({ enabled: false, reason });
  });

  it('enables extraction when the deployment matches the verified runtime', () => {
    expect(evaluateFontExtractionCapability({
      FONT_EXTRACTION_EGRESS_POSTURE: expectedEgressPosture(),
    })).toEqual({ enabled: true, reason: 'verified' });
  });

  it('accepts extra flags and any flag ordering alongside the required one', () => {
    expect(evaluateFontExtractionCapability({
      FONT_EXTRACTION_EGRESS_POSTURE: posture({
        compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
      }),
    })).toEqual({ enabled: true, reason: 'verified' });
  });

  // A previous revision expired its evidence after 30 days, which disabled the
  // tool in production every month without any change to the runtime it was
  // verified against. Availability must not depend on the clock.
  it('stays enabled years after the recorded verification', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-01-01T00:00:00.000Z'));
    expect(evaluateFontExtractionCapability({
      FONT_EXTRACTION_EGRESS_POSTURE: expectedEgressPosture(),
    })).toEqual({ enabled: true, reason: 'verified' });
  });
});
