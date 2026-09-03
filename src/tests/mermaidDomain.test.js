import { describe, expect, it, vi } from 'vitest';
import {
  MERMAID_SOURCE_LIMIT,
  downloadBlob,
  normalizeMermaidFilename,
  sanitizeMermaidSvg,
  validateMermaidSource,
} from '../components/MermaidConverter/lib/mermaidDomain.js';

describe('Mermaid converter domain', () => {
  it('normalizes deterministic filenames', () => {
    expect(normalizeMermaidFilename(' My diagram.svg ', 'png')).toBe('My-diagram.png');
    expect(normalizeMermaidFilename('', 'mmd')).toBe('diagram.mmd');
  });

  it('bounds empty, oversized, and pathological source', () => {
    expect(() => validateMermaidSource('')).toThrow('empty');
    expect(() => validateMermaidSource('x'.repeat(MERMAID_SOURCE_LIMIT + 1))).toThrow('tooLarge');
    expect(() => validateMermaidSource(Array.from({ length: 1001 }, (_, index) => `A${index}`).join('\n'))).toThrow('tooManyNodes');
  });

  it('sanitizes executable SVG content and external resources', () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" onload="alert(1)">
      <script>alert(1)</script>
      <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">unsafe</div></foreignObject>
      <image href="https://example.com/tracker.png" />
      <a href="javascript:alert(1)"><text x="5" y="15">safe label</text></a>
      <rect width="10" height="10" style="fill:url(https://example.com/a.svg#x)" />
    </svg>`;
    const result = sanitizeMermaidSvg(malicious, { background: '#ffffff' });
    expect(result.svg).not.toMatch(/script|foreignObject|<image|onload|javascript:|https:\/\/example\.com/i);
    expect(result.svg).toContain('safe label');
    expect(result.svg).toContain('data-export-background="true"');
    expect(result.width).toBe(120);
    expect(result.height).toBe(80);
  });

  it('removes generated stylesheets that can load external resources', () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
      <style data-safe="true">.node { fill: #fff; }</style>
      <style data-unsafe="true">@import "https://example.com/theme.css"; .edge { stroke: url(https://example.com/paint.svg); }</style>
      <style data-obfuscated="true">.label { background: u\\72l(https://example.com/label.png); }</style>
      <rect class="node" width="10" height="10" />
    </svg>`;
    const result = sanitizeMermaidSvg(malicious);
    expect(result.svg).toContain('data-safe="true"');
    expect(result.svg).not.toMatch(/data-unsafe|data-obfuscated|@import|example\.com|u\\72l/i);
  });

  it('keeps stylesheets and styles that reference same-document paint servers', () => {
    // Mermaid 11 ships `stroke:url(#<id>-gradient)` in its generated stylesheet;
    // dropping it leaves every CSS-styled shape with the default black fill.
    const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
      <style>#d [data-look="neo"].node polygon { stroke: url(#d-gradient); }</style>
      <rect class="node" width="10" height="10" style="fill:url(#d-gradient)" />
    </svg>`;
    const result = sanitizeMermaidSvg(diagram);
    expect(result.svg).toContain('url(#d-gradient)');
    expect(result.svg).toContain('style="fill:url(#d-gradient)"');
  });

  it('preserves a transparent background without adding a rectangle', () => {
    const result = sanitizeMermaidSvg('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"></svg>', { background: 'transparent' });
    expect(result.background).toBe('transparent');
    expect(result.svg).not.toContain('data-export-background');
  });

  it('revokes object URLs after downloads', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadBlob('flowchart LR', 'text/plain', 'diagram.mmd');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
