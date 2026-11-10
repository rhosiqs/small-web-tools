import { describe, expect, it } from 'vitest';
import {
  calculateLockedDimension,
  inspectAndSanitizeSvg,
  validateExportSize,
} from '../components/SvgToPngConverter/lib/svgDomain.js';

describe('SVG to PNG domain', () => {
  it('reads dimensions from explicit sizes and viewBox fallbacks', () => {
    expect(inspectAndSanitizeSvg('<svg width="320" height="180"></svg>')).toMatchObject({
      width: 320,
      height: 180,
    });
    expect(inspectAndSanitizeSvg('<svg viewBox="0 0 48 24"></svg>')).toMatchObject({
      width: 48,
      height: 24,
    });
  });

  it('removes active content, event handlers, and remote resources', () => {
    const result = inspectAndSanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>HTML</div></foreignObject>
        <image href="https://example.com/private.png" />
        <rect style="fill:url(https://example.com/pattern.svg)" />
      </svg>
    `);

    expect(result.error).toBeUndefined();
    expect(result.removedItems).toBe(5);
    expect(result.markup).not.toContain('<script');
    expect(result.markup).not.toContain('foreignObject');
    expect(result.markup).not.toContain('onclick');
    expect(result.markup).not.toContain('https://');
  });

  it('converts absolute units to CSS pixels so the synthesized viewBox matches the content', () => {
    const result = inspectAndSanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="150pt" height="75pt"><rect width="200" height="100"/></svg>',
    );
    expect(result).toMatchObject({ width: 200, height: 100 });
    const root = new DOMParser().parseFromString(result.markup, 'image/svg+xml').documentElement;
    expect(root.getAttribute('viewBox')).toBe('0 0 200 100');
    expect(root.getAttribute('width')).toBe('200');
    expect(root.getAttribute('height')).toBe('100');

    expect(inspectAndSanitizeSvg('<svg width="1in" height="2.54cm" viewBox="0 0 10 10"></svg>'))
      .toMatchObject({ width: 96, height: 96 });
    expect(inspectAndSanitizeSvg('<svg width="25.4mm" height="6pc"></svg>'))
      .toMatchObject({ width: 96, height: 96 });
  });

  it('gives the rasterized SVG an intrinsic size when the source only has relative sizes', () => {
    const result = inspectAndSanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 48 24"></svg>');
    expect(result).toMatchObject({ width: 48, height: 24 });
    const root = new DOMParser().parseFromString(result.markup, 'image/svg+xml').documentElement;
    expect(root.getAttribute('width')).toBe('48');
    expect(root.getAttribute('height')).toBe('24');
  });

  it('keeps self-contained stylesheets so class-based fills survive conversion', () => {
    const result = inspectAndSanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><defs><style>.cls-1{fill:#00a000;} .g{fill:url(#grad)}</style></defs><rect class="cls-1" width="10" height="10"/></svg>',
    );
    expect(result.removedItems).toBe(0);
    expect(result.markup).toContain('.cls-1{fill:#00a000;}');
  });

  it('still removes stylesheets that can load external resources', () => {
    const imported = inspectAndSanitizeSvg('<svg width="10" height="10"><style>@import "https://example.com/a.css";</style></svg>');
    const remoteUrl = inspectAndSanitizeSvg('<svg width="10" height="10"><style>rect{fill:url(https://example.com/p.svg#x)}</style></svg>');
    const escaped = inspectAndSanitizeSvg('<svg width="10" height="10"><style>rect{fill:u\\72l(https://example.com/p.svg)}</style></svg>');
    for (const result of [imported, remoteUrl, escaped]) {
      expect(result.removedItems).toBe(1);
      expect(result.markup).not.toContain('<style');
    }
  });

  it('rejects malformed documents and unsafe export sizes', () => {
    expect(inspectAndSanitizeSvg('<svg><path></svg>').error).toMatch(/valid XML/);
    expect(inspectAndSanitizeSvg('<html></html>').error).toMatch(/<svg>/);
    expect(validateExportSize(8192, 8192)).toMatch(/40 megapixels/);
    expect(validateExportSize(9000, 100)).toMatch(/8,192/);
    expect(validateExportSize(512, 512)).toBe('');
  });

  it('calculates aspect-locked dimensions', () => {
    expect(calculateLockedDimension('width', 640, 2)).toBe(320);
    expect(calculateLockedDimension('height', 180, 2)).toBe(360);
    expect(calculateLockedDimension('width', 0, 2)).toBeNull();
  });
});
