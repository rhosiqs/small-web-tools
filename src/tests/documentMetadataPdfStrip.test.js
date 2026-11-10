import { describe, expect, it } from 'vitest';
import { stripPdfMetadata } from '../components/DocMeta/lib/stripDocumentMetadata';

// A PDF is a byte-addressed file: the xref table stores the byte offset of
// every object, and stream payloads (compressed page content, fonts, images)
// are arbitrary binary. A stripped copy therefore has to keep every byte that
// is not metadata exactly where it was. These fixtures carry a binary stream,
// an outline item whose /Title is document content rather than metadata, an
// Info dictionary with nested and escaped parentheses plus hex strings, and an
// uncompressed XMP packet.

const latin1Bytes = (text) => Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
const bytesToLatin1 = (bytes) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

const BINARY_PAYLOAD = Uint8Array.from({ length: 256 }, (_, index) => (index * 37 + 128) & 0xff);
const XMP = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Alice Secret</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';

function buildPdf() {
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = (chunk) => {
    const bytes = typeof chunk === 'string' ? latin1Bytes(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (number, body) => {
    offsets[number] = length;
    push(`${number} 0 obj\n`);
    for (const piece of body) push(piece);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  object(1, ['<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R /Metadata 7 0 R >>']);
  object(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  object(3, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] /Contents 4 0 R >>']);
  object(4, [`<< /Length ${BINARY_PAYLOAD.length} >>\nstream\n`, BINARY_PAYLOAD, '\nendstream']);
  object(5, ['<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>']);
  object(6, ['<< /Title (Chapter One) /Parent 5 0 R /Dest [3 0 R /Fit] >>']);
  object(7, [`<< /Type /Metadata /Subtype /XML /Length ${XMP.length} >>\nstream\n${XMP}\nendstream`]);
  object(8, ['<< /Title (Plan \\(draft\\) (v2)) /Author (Alice Secret)/Creator<FEFF0041006C006900630065>\n/Producer (Writer) /Keywords (k) /Subject (s) /CreationDate (D:20240102030405Z) /ModDate<443A32303234> /Custom (kept) >>']);

  const xrefOffset = length;
  push('xref\n0 9\n0000000000 65535 f \n');
  for (let number = 1; number <= 8; number += 1) {
    push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 9 /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const bytes = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part, cursor);
    cursor += part.length;
  }
  return { bytes, offsets };
}

const readBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(/** @type {ArrayBuffer} */ (reader.result)));
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(blob);
});

async function strip(mode) {
  const { bytes, offsets } = buildPdf();
  const output = await readBlob(stripPdfMetadata(bytes.slice().buffer, mode));
  return { input: bytes, output, text: bytesToLatin1(output), offsets };
}

const infoDictionaryOf = (text) => {
  const start = text.indexOf('8 0 obj');
  return text.slice(start, text.indexOf('endobj', start));
};

describe('DocMeta PDF metadata stripping', () => {
  it.each(['private', 'all'])('keeps every byte offset and binary stream intact in %s mode', async (mode) => {
    const { input, output, text, offsets } = await strip(mode);

    expect(output.length).toBe(input.length);
    const streamStart = text.indexOf('stream\n', offsets[4]) + 'stream\n'.length;
    expect(output.slice(streamStart, streamStart + BINARY_PAYLOAD.length)).toEqual(BINARY_PAYLOAD);
    for (let number = 1; number <= 8; number += 1) {
      expect(text.startsWith(`${number} 0 obj`, offsets[number])).toBe(true);
    }
  });

  it('removes author and dates but keeps the title in private mode', async () => {
    const info = infoDictionaryOf((await strip('private')).text);

    expect(info).not.toMatch(/\/(Author|CreationDate|ModDate)\b/);
    expect(info).not.toContain('Alice');
    expect(info).toContain('/Title (Plan \\(draft\\) (v2))');
    expect(info).toContain('/Creator<FEFF0041006C006900630065>');
  });

  it('removes every Info property it targets without leaving broken string syntax', async () => {
    const { text } = await strip('all');
    const info = infoDictionaryOf(text);

    expect(info).not.toMatch(/\/(Title|Author|Subject|Keywords|Creator|Producer|CreationDate|ModDate)\b/);
    expect(info).toMatch(/^8 0 obj\n<<\s+\/Custom \(kept\)\s+>>\n$/);
  });

  it('leaves outline titles alone because they are document content, not metadata', async () => {
    const { text } = await strip('all');
    expect(text).toContain('<< /Title (Chapter One) /Parent 5 0 R');
  });

  it('removes the author from the XMP packet in private mode as well', async () => {
    const { text, offsets } = await strip('private');
    const start = text.indexOf('stream\n', offsets[7]) + 'stream\n'.length;
    const packet = text.slice(start, text.indexOf('\nendstream', start));

    expect(packet).toHaveLength(XMP.length);
    expect(packet).not.toContain('Alice');
    expect(packet).toContain('<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">');
    expect(new DOMParser().parseFromString(packet.slice(packet.indexOf('<x:xmpmeta'), packet.indexOf('<?xpacket end')), 'application/xml')
      .getElementsByTagName('parsererror')).toHaveLength(0);
  });

  it('blanks the XMP packet in all mode without changing the stream length', async () => {
    const { text, offsets } = await strip('all');
    const start = text.indexOf('stream\n', offsets[7]) + 'stream\n'.length;
    const end = text.indexOf('\nendstream', start);

    expect(end - start).toBe(XMP.length);
    expect(text.slice(start, end)).not.toContain('Alice');
    expect(text.slice(start, end)).not.toContain('xmpmeta');
  });
});
