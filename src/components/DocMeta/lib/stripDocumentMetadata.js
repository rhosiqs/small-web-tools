import JSZip from 'jszip';
import { validateZipArchive } from '../../../lib/resourceLimits';

export const OPEN_DOCUMENT_TYPES = ['odt', 'ods', 'odp', 'odg'];

const CUSTOM_PROPERTIES_PART = 'docProps/custom.xml';
const DEFAULT_XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

// Office validates typed properties before it opens a package, and an empty
// dcterms date or an empty integer is an invalid value rather than "no value".
// PowerPoint rejects such a package outright, so these properties are removed
// instead of blanked. Blanking stays correct for free-text properties.
const CORE_DATE_PROPERTIES = ['created', 'modified', 'lastPrinted'];
const APP_NUMERIC_PROPERTIES = ['TotalTime'];
const OPEN_DOCUMENT_TYPED_PROPERTIES = ['creation-date', 'date', 'editing-duration'];

const localNameOf = (element) => element.localName || element.tagName.split(':').pop();

const removeElement = (element) => {
  if (element.parentNode) element.parentNode.removeChild(element);
};

const normalizePartPath = (value) => String(value || '').replace(/^\//, '');

const xmlDeclarationOf = (text) => {
  const match = /^\s*<\?xml[^?]*\?>/i.exec(text);
  return match ? `${match[0]}\r\n` : DEFAULT_XML_DECLARATION;
};

// XMLSerializer never emits the XML declaration that OOXML and ODF parts are
// written with, so it is carried over from the part that was read.
const serializeXml = (xmlDoc, originalText) => (
  xmlDeclarationOf(originalText) + new XMLSerializer().serializeToString(xmlDoc)
);

async function rewritePart(zip, partPath, mutate) {
  const partFile = zip.file(partPath);
  if (!partFile) return false;
  const text = await partFile.async('string');
  const xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
  if (!mutate(xmlDoc)) return false;
  zip.file(partPath, serializeXml(xmlDoc, text));
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
    }
    return true;
  });

  if (mode === 'all') await dropPackagePart(zip, CUSTOM_PROPERTIES_PART);
  return zip;
}

export async function applyOpenDocumentMetadataStrip(zip, mode) {
  const clearedProperties = mode === 'private'
    ? ['creator', 'initial-creator', 'creation-date', 'date', 'editing-duration']
    : ['creator', 'initial-creator', 'creation-date', 'date', 'editing-duration', 'generator', 'title', 'subject', 'description', 'keyword'];

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

export function stripPdfMetadata(arrayBuffer, mode) {
  let text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

  if (mode === 'private') {
    text = text.replace(/\/Author\s*\([^)]*\)/g, '/Author ()')
               .replace(/\/Author\s*<[^>]*>/g, '/Author ()')
               .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate ()')
               .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate ()');
  } else {
    text = text.replace(/\/Title\s*\([^)]*\)/g, '/Title ()')
               .replace(/\/Author\s*\([^)]*\)/g, '/Author ()')
               .replace(/\/Subject\s*\([^)]*\)/g, '/Subject ()')
               .replace(/\/Keywords\s*\([^)]*\)/g, '/Keywords ()')
               .replace(/\/Creator\s*\([^)]*\)/g, '/Creator ()')
               .replace(/\/Producer\s*\([^)]*\)/g, '/Producer ()')
               .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate ()')
               .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate ()')
               .replace(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi, '');
  }
  return new Blob([new TextEncoder().encode(text)], { type: 'application/pdf' });
}

export async function loadSafeZip(file) {
  const archiveCheck = await validateZipArchive(file);
  if (!archiveCheck.valid) throw new Error(archiveCheck.error);
  return JSZip.loadAsync(file);
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
  return zip.generateAsync({ type: 'blob' });
}
