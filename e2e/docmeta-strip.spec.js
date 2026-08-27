import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

const CONTENT_TYPES = `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`;

const RELS = `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`;

const SLIDE = `${DECLARATION}<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>`;

const CORE = `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Quarterly Deck</dc:title><dc:creator>Alice Chen</dc:creator><cp:lastModifiedBy>Bob Wu</cp:lastModifiedBy><cp:revision>7</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2024-01-02T03:04:05Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2024-02-03T04:05:06Z</dcterms:modified><cp:lastPrinted>2024-02-03T04:05:06Z</cp:lastPrinted></cp:coreProperties>`;

const CUSTOM = `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Company"><vt:lpwstr>ACME Corp</vt:lpwstr></property></Properties>`;

const appPart = (extra) => `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><TotalTime>184</TotalTime>${extra}<Application>Microsoft Office PowerPoint</Application><Slides>1</Slides></Properties>`;

async function buildPresentation(appExtra = '<Words>42</Words>') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('ppt/presentation.xml', `${DECLARATION}<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  zip.file('ppt/slides/slide1.xml', SLIDE);
  zip.file('docProps/core.xml', CORE);
  zip.file('docProps/app.xml', appPart(appExtra));
  zip.file('docProps/custom.xml', CUSTOM);
  return {
    name: 'deck.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  };
}

async function readDownloadedPackage(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSZip.loadAsync(Buffer.concat(chunks));
}

// The unit suite asserts these invariants under jsdom, which serializes XML
// differently from a browser. This journey checks the bytes the user actually
// receives, produced by the real JSZip/DOMParser/XMLSerializer pipeline.
test('a stripped presentation stays a valid package', async ({ page }) => {
  await page.goto('/home/docmeta');
  await page.locator('#docmeta-file-input').setInputFiles(await buildPresentation());
  await expect(page.getByText('Quarterly Deck', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: /All/ }).first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download/ }).first().click();
  const zip = await readDownloadedPackage(await downloadPromise);

  const present = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const contentTypes = await zip.file('[Content_Types].xml').async('string');
  const rels = await zip.file('_rels/.rels').async('string');
  const core = await zip.file('docProps/core.xml').async('string');
  const app = await zip.file('docProps/app.xml').async('string');

  const referenced = [
    ...[...contentTypes.matchAll(/PartName="([^"]+)"/g)].map((match) => match[1]),
    ...[...rels.matchAll(/Target="([^"]+)"/g)].map((match) => match[1]),
  ].map((target) => target.replace(/^\//, ''));
  expect(referenced.filter((target) => !present.includes(target))).toEqual([]);

  expect(present).not.toContain('docProps/custom.xml');
  for (const empty of [/<dcterms:created[^>]*\/>/, /<dcterms:modified[^>]*\/>/, /<cp:lastPrinted[^>]*\/>/]) {
    expect(core).not.toMatch(empty);
  }
  expect(app).not.toMatch(/<TotalTime[^>]*\/>/);
  expect(core).not.toContain('Alice Chen');
  expect(core).not.toContain('Bob Wu');
  expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(SLIDE);
});

test('an unreadable metadata part stops the strip instead of corrupting the file', async ({ page }) => {
  await page.goto('/home/docmeta');
  // An unescaped & makes the part unparseable. DOMParser answers with a
  // <parsererror> document instead of throwing, and writing that back would
  // hand the user a damaged file that opened fine before.
  await page.locator('#docmeta-file-input').setInputFiles(
    await buildPresentation('<Company>Smith & Wesson</Company>'),
  );
  await expect(page.getByText('Quarterly Deck', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: /All/ }).first().click();
  await expect(page.getByText('Metadata stripping failed.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(0);
});
