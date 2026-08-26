import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  applyOfficeMetadataStrip,
  applyOpenDocumentMetadataStrip,
} from '../components/DocMeta/lib/stripDocumentMetadata';

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

function buildPresentation() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`);
  zip.file('ppt/presentation.xml', `${DECLARATION}<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  zip.file('docProps/core.xml', `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Deck</dc:title><dc:creator>Alice</dc:creator><cp:lastModifiedBy>Bob</cp:lastModifiedBy><cp:revision>3</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2024-01-02T03:04:05Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2024-02-03T04:05:06Z</dcterms:modified><cp:lastPrinted>2024-02-03T04:05:06Z</cp:lastPrinted></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><TotalTime>123</TotalTime><Application>Microsoft Office PowerPoint</Application><Slides>2</Slides></Properties>`);
  zip.file('docProps/custom.xml', `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Company"><vt:lpwstr>ACME</vt:lpwstr></property></Properties>`);
  return zip;
}

function buildPresentationDocument() {
  const zip = new JSZip();
  zip.file('meta.xml', `${DECLARATION}<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><meta:initial-creator>Alice</meta:initial-creator><dc:creator>Bob</dc:creator><meta:creation-date>2024-01-02T03:04:05</meta:creation-date><dc:date>2024-02-03T04:05:06</dc:date><meta:editing-duration>PT1H30M</meta:editing-duration><meta:editing-cycles>4</meta:editing-cycles><dc:title>Deck</dc:title></office:meta></office:document-meta>`);
  return zip;
}

const readPart = (zip, part) => zip.file(part).async('string');

async function readPackage(zip) {
  const [contentTypes, rels] = await Promise.all([
    readPart(zip, '[Content_Types].xml'),
    readPart(zip, '_rels/.rels'),
  ]);
  const present = Object.keys(zip.files);
  const referenced = [
    ...[...contentTypes.matchAll(/PartName="([^"]+)"/g)].map((match) => match[1]),
    ...[...rels.matchAll(/Target="([^"]+)"/g)].map((match) => match[1]),
  ];
  return {
    contentTypes,
    rels,
    danglingReferences: referenced
      .map((target) => target.replace(/^\//, ''))
      .filter((target) => !present.includes(target)),
  };
}

const elementsOf = (xml, localName) => [
  ...xml.matchAll(new RegExp(`<([\\w-]+:)?${localName}(\\s[^>]*)?(/>|>([\\s\\S]*?)</([\\w-]+:)?${localName}>)`, 'g')),
];

describe('DocMeta OOXML metadata stripping', () => {
  it('keeps the package consistent when custom properties are dropped', async () => {
    const zip = buildPresentation();
    await applyOfficeMetadataStrip(zip, 'all');

    expect(zip.file('docProps/custom.xml')).toBeNull();
    const { contentTypes, rels, danglingReferences } = await readPackage(zip);
    // A part that is still declared or still related but no longer present is
    // what makes PowerPoint refuse the downloaded file.
    expect(danglingReferences).toEqual([]);
    expect(contentTypes).not.toContain('docProps/custom.xml');
    expect(rels).not.toContain('docProps/custom.xml');
    expect(contentTypes).toContain('/docProps/core.xml');
    expect(rels).toContain('docProps/app.xml');
  });

  it.each(['private', 'all'])('never leaves an empty typed property in %s mode', async (mode) => {
    const zip = buildPresentation();
    await applyOfficeMetadataStrip(zip, mode);

    const core = await readPart(zip, 'docProps/core.xml');
    const app = await readPart(zip, 'docProps/app.xml');
    for (const property of ['created', 'modified', 'lastPrinted']) {
      expect(elementsOf(core, property)).toHaveLength(0);
    }
    expect(elementsOf(app, 'TotalTime')).toHaveLength(0);
    expect(core).not.toContain('W3CDTF"/>');
  });

  it.each(['private', 'all'])('preserves the XML declaration of rewritten parts in %s mode', async (mode) => {
    const zip = buildPresentation();
    await applyOfficeMetadataStrip(zip, mode);

    for (const part of ['docProps/core.xml', 'docProps/app.xml', '[Content_Types].xml', '_rels/.rels']) {
      expect(await readPart(zip, part)).toMatch(/^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
    }
  });

  it('still clears free-text metadata and leaves the payload untouched', async () => {
    const zip = buildPresentation();
    const originalPresentation = await readPart(zip, 'ppt/presentation.xml');
    await applyOfficeMetadataStrip(zip, 'all');

    const core = await readPart(zip, 'docProps/core.xml');
    expect(core).not.toContain('Alice');
    expect(core).not.toContain('Bob');
    expect(core).not.toContain('Deck');
    expect(core).toContain('<cp:revision>3</cp:revision>');
    expect(await readPart(zip, 'ppt/presentation.xml')).toBe(originalPresentation);
  });

  it('only clears authorship in private mode', async () => {
    const zip = buildPresentation();
    await applyOfficeMetadataStrip(zip, 'private');

    const core = await readPart(zip, 'docProps/core.xml');
    expect(core).toContain('<dc:title>Deck</dc:title>');
    expect(core).not.toContain('Alice');
    expect(core).not.toContain('Bob');
    expect(zip.file('docProps/custom.xml')).not.toBeNull();
  });
});

describe('DocMeta unreadable parts', () => {
  it.each(['private', 'all'])('refuses to rewrite a malformed part in %s mode', async (mode) => {
    const zip = buildPresentation();
    // An unescaped & is not valid XML; DOMParser answers with a <parsererror>
    // document instead of throwing, and serializing that would destroy the part.
    zip.file('docProps/app.xml', `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>Smith & Wesson</Company><TotalTime>123</TotalTime></Properties>`);
    const original = await readPart(zip, 'docProps/app.xml');

    await expect(applyOfficeMetadataStrip(zip, mode)).rejects.toThrow(/docProps\/app\.xml/);
    expect(await readPart(zip, 'docProps/app.xml')).toBe(original);
    expect(await readPart(zip, 'docProps/app.xml')).not.toContain('parsererror');
  });
});

describe('DocMeta OpenDocument metadata stripping', () => {
  it.each(['private', 'all'])('removes typed properties rather than blanking them in %s mode', async (mode) => {
    const zip = buildPresentationDocument();
    await applyOpenDocumentMetadataStrip(zip, mode);

    const meta = await readPart(zip, 'meta.xml');
    for (const property of ['creation-date', 'date', 'editing-duration']) {
      expect(elementsOf(meta, property)).toHaveLength(0);
    }
    expect(meta).toMatch(/^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
    expect(meta).toContain('<meta:editing-cycles>4</meta:editing-cycles>');
    expect(meta).not.toContain('Alice');
  });
});
