import JSZip from 'jszip';
import { bytesToBinaryString } from '../../../lib/binaryEncoding.js';
import { readZipEntryText, validateZipArchive } from '../../../lib/resourceLimits';

export const OPEN_DOCUMENT_TYPES = ['odt', 'ods', 'odp', 'odg'];

const CUSTOM_PROPERTIES_PART = 'docProps/custom.xml';

// Office/ODF metadata parts are small XML documents. Capping the inflated size
// per entry stops an archive that declares a tiny entry from expanding without
// bound once JSZip decompresses it.
export const MAX_METADATA_PART_BYTES = 8 * 1024 * 1024;

export const readMetadataPart = (entry) => readZipEntryText(entry, MAX_METADATA_PART_BYTES);
const DEFAULT_XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

// Office validates typed properties before it opens a package, and an empty
// dcterms date or an empty integer is an invalid value rather than "no value".
// PowerPoint rejects such a package outright, so these properties are removed
// instead of blanked. Blanking stays correct for free-text properties.
const CORE_DATE_PROPERTIES = ['created', 'modified', 'lastPrinted'];
const APP_NUMERIC_PROPERTIES = ['TotalTime'];
// Free-text organisation details the result view reports as removed in 'all'.
const APP_TEXT_PROPERTIES = ['Company', 'Manager', 'HyperlinkBase'];
const OPEN_DOCUMENT_TYPED_PROPERTIES = ['creation-date', 'date', 'editing-duration', 'print-date'];

const localNameOf = (element) => element.localName || element.tagName.split(':').pop();

const removeElement = (element) => {
  if (element.parentNode) element.parentNode.removeChild(element);
};

const normalizePartPath = (value) => String(value || '').replace(/^\//, '');

const xmlDeclarationOf = (text) => {
  const match = /^\s*<\?xml[^?]*\?>/i.exec(text);
  return match ? `${match[0]}\r\n` : DEFAULT_XML_DECLARATION;
};

// Serializers disagree about the XML declaration: Chrome emits a canonical one
// for a Document, jsdom emits none. The serializer's own declaration is dropped
// and the original carried over, so the part has exactly one either way — a
// second declaration is malformed XML that Office and LibreOffice refuse.
const serializeXml = (xmlDoc, originalText) => (
  xmlDeclarationOf(originalText)
  + new XMLSerializer().serializeToString(xmlDoc).replace(/^\s*<\?xml[^?]*\?>\s*/i, '')
);

// DOMParser reports malformed XML by returning a <parsererror> document rather
// than throwing. Serializing that back would replace a real part with the error
// text, so an unreadable part aborts the strip: telling the user it succeeded
// while their metadata is still in the file is the worse outcome of the two.
const parseXmlPart = (text, partPath) => {
  const xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Unreadable document part: ${partPath}`);
  }
  return xmlDoc;
};

async function rewritePart(zip, partPath, mutate) {
  const partFile = zip.file(partPath);
  if (!partFile) return false;
  const text = await readMetadataPart(partFile);
  const xmlDoc = parseXmlPart(text, partPath);
  if (!mutate(xmlDoc)) return false;
  // JSZip would otherwise add a "docProps/" folder entry the package never had.
  zip.file(partPath, serializeXml(xmlDoc, text), { createFolders: false });
  return true;
}

// Deleting a part on its own leaves the package inconsistent: the content-type
// override and the package relationship still point at a part that is gone,
// which is what makes PowerPoint report a damaged file.
async function dropPackagePart(zip, partPath) {
  if (!zip.file(partPath)) return;
  zip.remove(partPath);

  await rewritePart(zip, '[Content_Types].xml', (xmlDoc) => {
    let changed = false;
    for (const element of [...xmlDoc.getElementsByTagName('*')]) {
      if (localNameOf(element) !== 'Override') continue;
      if (normalizePartPath(element.getAttribute('PartName')) !== partPath) continue;
      removeElement(element);
      changed = true;
    }
    return changed;
  });

  await rewritePart(zip, '_rels/.rels', (xmlDoc) => {
    let changed = false;
    for (const element of [...xmlDoc.getElementsByTagName('*')]) {
      if (localNameOf(element) !== 'Relationship') continue;
      if (normalizePartPath(element.getAttribute('Target')) !== partPath) continue;
      removeElement(element);
      changed = true;
    }
    return changed;
  });
}

export async function applyOfficeMetadataStrip(zip, mode) {
  await rewritePart(zip, 'docProps/core.xml', (xmlDoc) => {
    for (const element of [...xmlDoc.getElementsByTagName('*')]) {
      const localName = localNameOf(element);
      if (localName === 'coreProperties') continue;
      if (mode === 'private') {
        if (CORE_DATE_PROPERTIES.includes(localName)) removeElement(element);
        else if (['creator', 'lastModifiedBy'].includes(localName)) element.textContent = '';
      } else if (mode === 'all') {
        if (localName === 'revision') continue;
        if (CORE_DATE_PROPERTIES.includes(localName)) removeElement(element);
        else element.textContent = '';
      }
    }
    return true;
  });

  await rewritePart(zip, 'docProps/app.xml', (xmlDoc) => {
    for (const element of [...xmlDoc.getElementsByTagName('*')]) {
      if (APP_NUMERIC_PROPERTIES.includes(localNameOf(element))) removeElement(element);
      else if (mode === 'all' && APP_TEXT_PROPERTIES.includes(localNameOf(element))) element.textContent = '';
    }
    return true;
  });

  if (mode === 'all') await dropPackagePart(zip, CUSTOM_PROPERTIES_PART);
  return zip;
}

export async function applyOpenDocumentMetadataStrip(zip, mode) {
  const clearedProperties = mode === 'private'
    ? ['creator', 'initial-creator', 'creation-date', 'date', 'editing-duration', 'printed-by', 'print-date']
    : ['creator', 'initial-creator', 'creation-date', 'date', 'editing-duration', 'printed-by', 'print-date', 'generator', 'title', 'subject', 'description', 'keyword'];

  await rewritePart(zip, 'meta.xml', (xmlDoc) => {
    for (const element of [...xmlDoc.getElementsByTagName('*')]) {
      const localName = localNameOf(element);
      if (mode === 'all' && localName === 'user-defined') {
        removeElement(element);
        continue;
      }
      if (!clearedProperties.includes(localName)) continue;
      if (OPEN_DOCUMENT_TYPED_PROPERTIES.includes(localName)) removeElement(element);
      else element.textContent = '';
    }
    return true;
  });
  return zip;
}

const PDF_PRIVATE_INFO_KEYS = ['Author', 'CreationDate', 'ModDate'];
const PDF_ALL_INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
const PDF_SPACE = 0x20;
const PDF_XMP_PRIVATE_PROPERTIES = /<([\w-]+):(creator|Author|CreateDate|ModifyDate|MetadataDate)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1:\2>)|\s[\w-]+:(?:creator|Author|CreateDate|ModifyDate|MetadataDate)\s*=\s*(?:"[^"]*"|'[^']*')/gu;
const PDF_DELIMITER_OR_SPACE = /[\s()<>[\]{}/%]/u;

// Index of the byte after a PDF literal string that opens at `start`. Literal
// strings nest balanced parentheses and escape unbalanced ones with `\`.
const endOfPdfLiteralString = (text, start) => {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\\') index += 1;
    else if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
};

// Index of the byte after the value that starts at `start`: a literal string,
// a hex string, an indirect reference, or a single token.
const endOfPdfValue = (text, start) => {
  if (text[start] === '(') return endOfPdfLiteralString(text, start);
  if (text[start] === '<' && text[start + 1] !== '<') {
    const close = text.indexOf('>', start);
    return close < 0 ? -1 : close + 1;
  }
  const reference = /^\d+\s+\d+\s+R/u.exec(text.slice(start, start + 32));
  if (reference) return start + reference[0].length;
  let index = start + 1;
  while (index < text.length && !PDF_DELIMITER_OR_SPACE.test(text[index])) index += 1;
  return index;
};

const blankPdfRange = (bytes, start, end) => {
  bytes.fill(PDF_SPACE, start, end);
};

// The Info dictionaries are the objects that a trailer (or cross-reference
// stream) names with /Info. Other dictionaries reuse the same key names for
// document content: an outline item's /Title is the bookmark's label.
const pdfInfoDictionaryRanges = (text) => {
  const ranges = [];
  const references = new Set();
  for (const match of text.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/gu)) {
    references.add(`${match[1]} ${match[2]}`);
  }
  for (const reference of references) {
    const [number, generation] = reference.split(' ');
    const header = new RegExp(`(?<![\\d])${number}\\s+${generation}\\s+obj\\b`, 'gu');
    for (const match of text.matchAll(header)) {
      const bodyStart = /** @type {number} */ (match.index) + match[0].length;
      const dictionaryStart = text.indexOf('<<', bodyStart);
      const objectEnd = text.indexOf('endobj', bodyStart);
      if (dictionaryStart < 0 || (objectEnd >= 0 && dictionaryStart > objectEnd)) continue;
      const dictionaryEnd = text.indexOf('>>', dictionaryStart + 2);
      if (dictionaryEnd < 0) continue;
      ranges.push([dictionaryStart + 2, dictionaryEnd]);
    }
  }
  return ranges;
};

// A PDF is byte-addressed: the cross-reference table records the offset of
// every object, and stream payloads are arbitrary binary. Metadata is therefore
// overwritten in place with spaces — whitespace between dictionary entries, and
// inside an XMP packet, is valid — so the file keeps its length, every offset,
// and every non-metadata byte. Removing a key together with its value also
// avoids leaving an empty string where a date is expected.
export function stripPdfMetadata(arrayBuffer, mode) {
  const bytes = new Uint8Array(arrayBuffer).slice();
  const text = bytesToBinaryString(bytes);
  const keys = mode === 'private' ? PDF_PRIVATE_INFO_KEYS : PDF_ALL_INFO_KEYS;
  const keyPattern = new RegExp(`/(${keys.join('|')})(?=[\\s(<\\[/0-9])\\s*`, 'gu');

  for (const [start, end] of pdfInfoDictionaryRanges(text)) {
    const dictionary = text.slice(start, end);
    for (const match of dictionary.matchAll(keyPattern)) {
      const keyStart = start + /** @type {number} */ (match.index);
      const valueEnd = endOfPdfValue(text, keyStart + match[0].length);
      if (valueEnd < 0 || valueEnd > end) continue;
      blankPdfRange(bytes, keyStart, valueEnd);
    }
  }

  for (const match of text.matchAll(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/giu)) {
    const start = /** @type {number} */ (match.index);
    if (mode !== 'private') {
      blankPdfRange(bytes, start, start + match[0].length);
      continue;
    }
    // Readers prefer XMP over the Info dictionary, so private mode removes the
    // same author and date properties from the packet. A whole element or
    // attribute becomes whitespace, which leaves the XML well formed.
    for (const property of match[0].matchAll(PDF_XMP_PRIVATE_PROPERTIES)) {
      const propertyStart = start + /** @type {number} */ (property.index);
      blankPdfRange(bytes, propertyStart, propertyStart + property[0].length);
    }
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function loadSafeZip(file) {
  const archiveCheck = await validateZipArchive(file);
  if (!archiveCheck.valid) throw new Error(archiveCheck.error);
  return JSZip.loadAsync(file);
}

const PACKAGE_MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  odg: 'application/vnd.oasis.opendocument.graphics',
};

// JSZip's default is to STORE every entry, which inflates the whole package
// (typically two to three times its original size). DEFLATE reuses the
// original compressed bytes of untouched entries. OpenDocument requires its
// `mimetype` entry to stay first and uncompressed, so that one entry is pinned
// to STORE; reassigning an existing name keeps its position in the archive.
async function generatePackage(zip, type) {
  const mimetypeEntry = zip.file('mimetype');
  if (mimetypeEntry) {
    zip.file('mimetype', await mimetypeEntry.async('uint8array'), { compression: 'STORE', createFolders: false });
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: PACKAGE_MIME_TYPES[type] || 'application/octet-stream',
  });
}

export async function stripDocumentMetadata(fileObj, mode, type) {
  if (type === 'pdf') {
    return stripPdfMetadata(await fileObj.arrayBuffer(), mode);
  }

  const zip = await loadSafeZip(fileObj);
  if (OPEN_DOCUMENT_TYPES.includes(type)) {
    await applyOpenDocumentMetadataStrip(zip, mode);
  } else {
    await applyOfficeMetadataStrip(zip, mode);
  }
  return generatePackage(zip, type);
}
