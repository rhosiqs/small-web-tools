import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { MIT_LICENSE_TEXT } from '../lib/licenseText.js';

describe('license page text', () => {
  it('reproduces the repository LICENSE verbatim', () => {
    const repositoryLicense = readFileSync(path.join(process.cwd(), 'LICENSE'), 'utf8');
    expect(MIT_LICENSE_TEXT).toBe(repositoryLicense);
  });
});
