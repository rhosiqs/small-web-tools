import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en-US/common.json';
import enDocs from './locales/en-US/docs.json';
import enNavigation from './locales/en-US/navigation.json';
import enTools from './locales/en-US/tools.json';
import enMermaid from './locales/en-US/mermaid.json';
import enErrors from './locales/en-US/errors.json';
import zhCommon from './locales/zh-TW/common.json';
import zhDocs from './locales/zh-TW/docs.json';
import zhNavigation from './locales/zh-TW/navigation.json';
import zhTools from './locales/zh-TW/tools.json';
import zhMermaid from './locales/zh-TW/mermaid.json';
import zhErrors from './locales/zh-TW/errors.json';

export const DEFAULT_LOCALE = 'en-US';
export const SUPPORTED_LOCALES = ['en-US', 'zh-TW'];
export const LOCALE_STORAGE_KEY = 'small-web-tools.locale';

export function normalizeLocale(locale) {
  if (typeof locale !== 'string') return null;
  const normalized = locale.trim().replace('_', '-').toLowerCase();
  if (normalized === 'zh-tw' || normalized === 'zh-hant' || normalized.startsWith('zh-hant-')) {
    return 'zh-TW';
  }
  if (normalized === 'en-us' || normalized === 'en' || normalized.startsWith('en-')) {
    return 'en-US';
  }
  return null;
}

/**
 * @param {{ storage?: Pick<Storage, 'getItem'>, browserLanguages?: string[] }} [options]
 */
export function resolveInitialLocale({ storage, browserLanguages } = {}) {
  try {
    const persisted = normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY));
    if (persisted) return persisted;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  const candidates = browserLanguages ?? (typeof navigator !== 'undefined'
    ? navigator.languages?.length ? navigator.languages : [navigator.language]
    : []);
  for (const candidate of candidates ?? []) {
    const supported = normalizeLocale(candidate);
    if (supported) return supported;
  }
  return DEFAULT_LOCALE;
}

const initialLocale = resolveInitialLocale({
  storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
});

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { common: enCommon, docs: enDocs, navigation: enNavigation, tools: { ...enTools, ...enMermaid }, errors: enErrors },
      'zh-TW': { common: zhCommon, docs: zhDocs, navigation: zhNavigation, tools: { ...zhTools, ...zhMermaid }, errors: zhErrors },
    },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: ['common', 'docs', 'navigation', 'tools', 'errors'],
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    initAsync: false,
  });

document.documentElement.lang = i18n.resolvedLanguage ?? initialLocale;

i18n.on('languageChanged', (locale) => {
  const supported = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  document.documentElement.lang = supported;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, supported);
  } catch {
    // The active in-memory locale remains valid when persistence is blocked.
  }
});

export function changeLocale(locale) {
  return i18n.changeLanguage(normalizeLocale(locale) ?? DEFAULT_LOCALE);
}

export default i18n;