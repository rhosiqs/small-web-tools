/**
 * Canonical outbound project links.
 *
 * Document pages show a concise, user-facing version of each policy; the
 * repository keeps the complete document. These helpers point one at the other
 * so the site never hard-codes a repository path in more than one place.
 */
export const PROJECT_REPOSITORY_URL = 'https://github.com/rhosiqs/small-web-tools';

const SOURCE_FILES = {
  about: { 'en-US': 'ABOUT.md', 'zh-TW': 'ABOUT.zh-TW.md' },
  privacy: { 'en-US': 'PRIVACY.md', 'zh-TW': 'PRIVACY.zh-TW.md' },
  terms: { 'en-US': 'TERMS.md', 'zh-TW': 'TERMS.zh-TW.md' },
  security: { 'en-US': 'SECURITY.md', 'zh-TW': 'SECURITY.zh-TW.md' },
  license: { 'en-US': 'LICENSE', 'zh-TW': 'LICENSE' },
};

/**
 * @param {string} documentId Registry route id of a document page.
 * @param {string} [locale] Active locale; falls back to the English original.
 * @returns {string | null} Repository URL of the complete document.
 */
export function getDocumentSourceUrl(documentId, locale) {
  const files = SOURCE_FILES[documentId];
  if (!files) return null;
  const file = (locale && files[locale]) || files['en-US'];
  return `${PROJECT_REPOSITORY_URL}/blob/develop/${file}`;
}
