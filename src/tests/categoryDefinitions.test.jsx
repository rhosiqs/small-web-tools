import { describe, expect, it } from 'vitest';
import { CATEGORY_DEFINITIONS } from '../categoryDefinitions.jsx';

describe('category definitions', () => {
  it('provides one canonical definition for each public category', () => {
    expect(CATEGORY_DEFINITIONS.map(({ id }) => id)).toEqual([
      'text',
      'developer',
      'network',
      'media',
      'bioinfo',
      'utilities',
    ]);
    expect(new Set(CATEGORY_DEFINITIONS.map(({ nameKey }) => nameKey)).size).toBe(6);
    expect(CATEGORY_DEFINITIONS.every(({ icon }) => Boolean(icon))).toBe(true);
  });
});
