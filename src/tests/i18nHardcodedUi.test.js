import { describe, expect, it } from 'vitest';
import { checkHardcodedUi, findHardcodedUiInSource } from '../../scripts/check-hardcoded-ui.mjs';

describe('hardcoded UI audit', () => {
  it('keeps user-facing JSX in translation resources', () => {
    expect(checkHardcodedUi()).toEqual([]);
  });

  it('rejects literal JSX text', () => {
    expect(findHardcodedUiInSource('export default () => <button>Save changes</button>;'))
      .toEqual([expect.stringContaining('"Save changes"')]);
  });

  it('rejects data-driven labels in configuration and row tuples', () => {
    const source = `
      const tabs = [{ id: 'details', label: 'Technical Parameters' }];
      const rows = [['Container Brand', value]];
    `;

    expect(findHardcodedUiInSource(source)).toEqual([
      expect.stringContaining('"Technical Parameters"'),
      expect.stringContaining('"Container Brand"'),
    ]);
  });

  it('allows reviewed technical terms', () => {
    expect(findHardcodedUiInSource("const rows = [['FPS', value], ['MP4', mimeType]];"))
      .toEqual([]);
  });

  it('allows indirect translated labels', () => {
    expect(findHardcodedUiInSource("const tabs = [{ id: 'details', label: t('tabs.details') }];"))
      .toEqual([]);
  });
});
