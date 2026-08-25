import networkServices from '../../config/network-services.json';

const STORAGE_KEY = 'small_web_tools_consent';
export const CURRENT_CONSENT_VERSION = '3.0.0';

export const NETWORK_SERVICES = networkServices;
export const THIRD_PARTY_SERVICES = Object.fromEntries(
  networkServices
    .filter((service) => service.consentMode === 'explicit-consent')
    .map((service) => [service.id, {
      ...service,
      privacyUrl: service.policyUrl,
      consentVersion: CURRENT_CONSENT_VERSION,
    }]),
);

function emptyConsents() {
  return { version: CURRENT_CONSENT_VERSION, services: {} };
}

/**
 * Read the consent store, treating anything that does not match the current
 * shape as "no consent granted". Stored state is user-editable, so a record
 * missing `services` must not reach consumers and break rendering — that would
 * also leave consent unrecoverable through the UI.
 */
export function getStoredConsents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyConsents();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CURRENT_CONSENT_VERSION) {
      return emptyConsents();
    }
    const { services } = parsed;
    if (!services || typeof services !== 'object' || Array.isArray(services)) {
      return emptyConsents();
    }
    return { version: CURRENT_CONSENT_VERSION, services };
  } catch {
    return emptyConsents();
  }
}

export function hasConsent(serviceId) {
  return Boolean(getStoredConsents().services[serviceId]);
}

export function grantConsent(serviceId) {
  try {
    const store = getStoredConsents();
    store.services[serviceId] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event('consent_updated'));
  } catch {
    // Storage may be unavailable; consent remains ungranted.
  }
}

export function revokeConsent(serviceId) {
  try {
    const store = getStoredConsents();
    delete store.services[serviceId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event('consent_updated'));
  } catch {
    // Storage may be unavailable; consumers re-check the current state.
  }
}

export function resetAllConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('consent_updated'));
  } catch {
    // Storage may be unavailable; consumers re-check the current state.
  }
}
