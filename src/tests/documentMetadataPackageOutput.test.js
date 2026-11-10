import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { stripDocumentMetadata } from '../components/DocMeta/lib/stripDocumentMetadata';

// The unit suite for the part rewrites works on in-memory JSZip objects. These
// tests look at the archive bytes stripDocumentMetadata actually hands to the
// download: the entry list, each entry's compression method, and the Blob type.

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const ODT_MIME = 'application/vnd.oasis.opendocument.text';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const BODY = `${DECLARATION}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${'<w:p><w:r><w:t>Repeated body text.</w:t></w:r></w:p>'.repeat(200)}</w:body></w:document>`;

// Behaves like the browser File the component passes in: JSZip reads the bytes
// and the archive validator calls arrayBuffer().
const asUpload = (buffer) => {
  const bytes = new Uint8Array(buffer);
  return Object.assign(bytes, { arrayBuffer: async () => buffer });
};

const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(blob);
});

// Walks the central directory, which is what Office and LibreOffice consult.
function centralDirectoryEntries(buffer) {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    entries.push({
      name: new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameLength)),
      method: view.getUint16(cursor + 10, true),
      localHeaderOffset: view.getUint32(cursor + 42, true),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function buildOdt() {
  const zip = new JSZip();
  zip.file('mimetype', ODT_MIME, { compression: 'STORE' });
  zip.file('content.xml', BODY, { compression: 'DEFLATE' });
  zip.file('meta.xml', `${DECLARATION}<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><dc:creator>Alice</dc:creator><meta:creation-date>2024-01-02T03:04:05</meta:creation-date></office:meta></office:document-meta>`, { compression: 'DEFLATE' });
  zip.file('META-INF/manifest.xml', `${DECLARATION}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`, { compression: 'DEFLATE' });
  return zip.generateAsync({ type: 'arraybuffer', createFolders: false });
}

async function buildDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('word/document.xml', BODY);
  zip.file('docProps/core.xml', `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Alice</dc:creator></cp:coreProperties>`);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', createFolders: false });
}

describe('DocMeta stripped package bytes', () => {
  it.each(['private', 'all'])('keeps an OpenDocument mimetype entry first and stored in %s mode', async (mode) => {
    const blob = await stripDocumentMetadata(asUpload(await buildOdt()), mode, 'odt');
    const buffer = await readBlob(blob);
    const entries = centralDirectoryEntries(buffer);

    expect(entries[0]).toMatchObject({ name: 'mimetype', method: 0, localHeaderOffset: 0 });
    expect(new TextDecoder().decode(new Uint8Array(buffer, 38, ODT_MIME.length))).toBe(ODT_MIME);
    expect(blob.type).toBe(ODT_MIME);
  });

  it.each(['private', 'all'])('keeps the entry list and compresses the payload in %s mode', async (mode) => {
    const original = await buildDocx();
    const blob = await stripDocumentMetadata(asUpload(original), mode, 'docx');
    const buffer = await readBlob(blob);
    const entries = centralDirectoryEntries(buffer);

    // Rewriting docProps/core.xml must not add a docProps/ folder entry, and
    // the body must not be inflated into a stored copy several times larger.
    expect(entries.map((entry) => entry.name)).toEqual(centralDirectoryEntries(original).map((entry) => entry.name));
    expect(entries.find((entry) => entry.name === 'word/document.xml')?.method).toBe(8);
    expect(buffer.byteLength).toBeLessThan(original.byteLength * 1.5);
    expect(blob.type).toBe(DOCX_MIME);

    const reread = await JSZip.loadAsync(buffer);
    expect(await reread.file('word/document.xml').async('string')).toBe(BODY);
    expect(await reread.file('docProps/core.xml').async('string')).not.toContain('Alice');
  });
});
