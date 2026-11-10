import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';

const barcodeCalls = vi.hoisted(() => []);

// Stands in for JsBarcode: draws a minimal barcode into an <svg> target the way the
// real renderer does (size, viewBox, namespace, one bar) and records every call.
vi.mock('jsbarcode', () => ({
  default: vi.fn((target, value) => {
    barcodeCalls.push({ target, value });
    if (target instanceof SVGElement) {
      while (target.firstChild) target.removeChild(target.firstChild);
      target.setAttribute('width', '120px');
      target.setAttribute('height', '60px');
      target.setAttribute('viewBox', '0 0 120 60');
      target.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('width', '4');
      bar.setAttribute('height', '60');
      target.appendChild(bar);
    }
  }),
}));

import QrBarcodeGenerator from '../components/QrBarcodeGenerator.jsx';
import SvgToPngConverter from '../components/SvgToPngConverter.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let blobs;

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

function findButton(label) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent.trim() === label);
}

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function parseSvg(text) {
  return new DOMParser().parseFromString(text, 'image/svg+xml');
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  barcodeCalls.length = 0;
  blobs = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob);
    return `blob:test-${blobs.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('SVG to PNG export failures', () => {
  it('reports a failure instead of throwing when the browser cannot create a canvas context', async () => {
    const OriginalImage = globalThis.Image;
    const errors = [];
    class LoadingImage {
      set src(value) {
        this.currentSrc = value;
        queueMicrotask(() => {
          try {
            this.onload?.();
          } catch (error) {
            errors.push(error);
          }
        });
      }
    }
    globalThis.Image = LoadingImage;
    try {
      await act(async () => root.render(<SvgToPngConverter />));
      await act(async () => setNativeValue(
        container.querySelector('#svg-markup'),
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40"/></svg>',
      ));
      await act(async () => {
        findButton('Download PNG').click();
        await Promise.resolve();
      });
    } finally {
      globalThis.Image = OriginalImage;
    }

    expect(errors).toEqual([]);
    expect(container.querySelector('[role="status"]')).toHaveTextContent('This browser could not create the PNG.');
  });
});

describe('barcode export', () => {
  it('draws the barcode as soon as a first valid value is entered', async () => {
    await act(async () => root.render(<QrBarcodeGenerator initialTab="barcode" />));
    await act(async () => setNativeValue(container.querySelector('#barcode-val'), 'ABC-123'));

    const targets = barcodeCalls.filter((call) => call.value === 'ABC-123').map((call) => call.target.nodeName.toLowerCase());
    expect(targets).toEqual(expect.arrayContaining(['canvas', 'svg']));
  });

  it('draws the barcode again when an invalid value becomes valid', async () => {
    await act(async () => root.render(<QrBarcodeGenerator initialTab="barcode" />));
    await act(async () => setNativeValue(container.querySelector('#barcode-format'), 'EAN8'));
    await act(async () => setNativeValue(container.querySelector('#barcode-val'), '12'));
    barcodeCalls.length = 0;
    await act(async () => setNativeValue(container.querySelector('#barcode-val'), '9638507'));

    const targets = barcodeCalls.filter((call) => call.value === '9638507').map((call) => call.target.nodeName.toLowerCase());
    expect(targets).toEqual(expect.arrayContaining(['canvas', 'svg']));
  });

  it('exports a visible standalone SVG without the hidden preview styling', async () => {
    await act(async () => root.render(<QrBarcodeGenerator initialTab="barcode" />));
    await act(async () => setNativeValue(container.querySelector('#barcode-val'), 'ABC-123'));
    await act(async () => findButton('Download SVG').click());

    const text = await readBlob(blobs.at(-1));
    const documentNode = parseSvg(text);
    expect(documentNode.querySelector('parsererror')).toBeNull();
    expect(documentNode.documentElement.getAttribute('style') ?? '').not.toMatch(/display\s*:\s*none/);
    expect(documentNode.documentElement.getAttribute('width')).toBe('120px');
  });
});

describe('QR code SVG export', () => {
  async function exportQrSvgWithLabel(label) {
    await act(async () => root.render(<QrBarcodeGenerator />));
    await act(async () => setNativeValue(container.querySelector('#qr-text'), 'https://example.com/?a=1&b=2'));
    const textSection = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Text overlay'));
    await act(async () => textSection.click());
    await act(async () => setNativeValue(container.querySelector('#qr-text-label-input'), label));
    await act(async () => setNativeValue(container.querySelector('#qr-text-label-mode'), 'both'));
    await act(async () => findButton('Download SVG').click());
    return readBlob(blobs.at(-1));
  }

  it('escapes label text so the downloaded SVG is well-formed XML', async () => {
    const documentNode = parseSvg(await exportQrSvgWithLabel('Fish & Chips <3'));
    expect(documentNode.querySelector('parsererror')).toBeNull();
    const labels = [...documentNode.getElementsByTagName('text')].map((node) => node.textContent);
    expect(labels).toEqual(['Fish & Chips <3', 'Fish & Chips <3']);
  });

  it('gives the downloaded SVG an intrinsic pixel size', async () => {
    const root = parseSvg(await exportQrSvgWithLabel('SCAN')).documentElement;
    expect(root.getAttribute('width')).toMatch(/^\d+(?:\.\d+)?$/);
    expect(root.getAttribute('height')).toMatch(/^\d+(?:\.\d+)?$/);
    expect(root.getAttribute('viewBox')).toBe(`0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`);
  });
});
