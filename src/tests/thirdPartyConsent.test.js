import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRENT_CONSENT_VERSION,
  getStoredConsents,
  grantConsent,
  hasConsent,
  resetAllConsent,
  revokeConsent,
  NETWORK_SERVICES,
  THIRD_PARTY_SERVICES,
} from '../lib/thirdPartyServices.js';

describe('third-party consent registry', () => {
  beforeEach(() => localStorage.clear());

  it('documents provider, data, trigger, policy, fallback, and version for every service', () => {
    for (const service of Object.values(THIRD_PARTY_SERVICES)) {
      expect(service).toMatchObject({
        id: expect.any(String),
        provider: expect.any(String),
        purpose: expect.any(String),
        dataTransmitted: expect.any(String),
        trigger: expect.any(String),
        privacyUrl: expect.stringMatching(/^(https:|\/(?!\/))/),
        fallback: expect.any(String),
        consentVersion: CURRENT_CONSENT_VERSION,
      });
    }
  });

  it('distinguishes consent, disclosure, navigation, and infrastructure modes', () => {
    expect(new Set(NETWORK_SERVICES.map((service) => service.consentMode))).toEqual(new Set([
      'explicit-consent',
      'point-of-use-disclosure',
      'user-navigation',
      'hosting-infrastructure',
    ]));
    expect(THIRD_PARTY_SERVICES.ffmpeg).toBeUndefined();
  });

  it.each([
    ['a record with no services map', '{"version":"3.0.0"}'],
    ['a services array', '{"version":"3.0.0","services":["speedtest"]}'],
    ['a null services map', '{"version":"3.0.0","services":null}'],
    ['a bare JSON scalar', '"3.0.0"'],
    ['unparseable text', 'not json'],
  ])('treats %s as no consent instead of returning an unusable store', (_label, raw) => {
    localStorage.setItem('small_web_tools_consent', raw);
    expect(getStoredConsents()).toEqual({ version: CURRENT_CONSENT_VERSION, services: {} });
    expect(hasConsent('speedtest')).toBe(false);
  });

  it('stays recoverable after a malformed record: consent can still be granted', () => {
    localStorage.setItem('small_web_tools_consent', '{"version":"3.0.0"}');
    grantConsent('speedtest');
    expect(hasConsent('speedtest')).toBe(true);
  });

  it('grants, revokes, and resets decisions', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    expect(hasConsent('speedtest')).toBe(false);
    grantConsent('speedtest');
    expect(hasConsent('speedtest')).toBe(true);
    revokeConsent('speedtest');
    expect(hasConsent('speedtest')).toBe(false);
    grantConsent('currency');
    resetAllConsent();
    expect(hasConsent('currency')).toBe(false);
    expect(dispatch).toHaveBeenCalled();
  });

  it('invalidates stored consent when the version changes', () => {
    localStorage.setItem('small_web_tools_consent', JSON.stringify({
      version: '1.0.0',
      services: { speedtest: true },
    }));
    expect(getStoredConsents()).toEqual({
      version: CURRENT_CONSENT_VERSION,
      services: {},
    });
  });
});
