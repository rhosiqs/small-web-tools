import { describe, expect, it } from 'vitest';
import { PROJECT_REPOSITORY_URL, getDocumentSourceUrl } from '../lib/projectLinks.js';

describe('document source links', () => {
  it('resolves the companion file for the active locale', () => {
    expect(getDocumentSourceUrl('privacy', 'zh-TW')).toBe(`${PROJECT_REPOSITORY_URL}/blob/develop/PRIVACY.zh-TW.md`);
    expect(getDocumentSourceUrl('terms', 'en-US')).toBe(`${PROJECT_REPOSITORY_URL}/blob/develop/TERMS.md`);
  });

  it('falls back to the English original for an unknown locale', () => {
    expect(getDocumentSourceUrl('about')).toBe(`${PROJECT_REPOSITORY_URL}/blob/develop/ABOUT.md`);
    expect(getDocumentSourceUrl('license', 'zh-TW')).toBe(`${PROJECT_REPOSITORY_URL}/blob/develop/LICENSE`);
  });

  it('returns null for a route without a repository document', () => {
    expect(getDocumentSourceUrl('tool-home', 'en-US')).toBeNull();
  });
});
