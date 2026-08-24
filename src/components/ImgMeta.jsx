import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ExifReader from 'exifreader';
import JSZip from 'jszip';
import Card from './ui/Card';
import Button from './ui/Button';
import ToolHeader from './ui/ToolHeader';
import { FILE_RESOURCE_POLICIES, validateResourceAddition } from '../lib/resourceLimits';
import ExternalMapPreview from './ExternalMapPreview';
import useObjectUrlRegistry from '../hooks/useObjectUrlRegistry';
import { createEphemeralId } from '../lib/ephemeralId.js';

// Jpeg Metadata Stripping Logic
function stripJpegMetadata(arrayBuffer, mode) {
  // mode can be: 'private' (strips APP1, APP13) or 'all' (strips APP1, APP2, APP13)
  const view = new DataView(arrayBuffer);
  const length = arrayBuffer.byteLength;
  
  if (length < 2 || view.getUint16(0) !== 0xFFD8) {
    throw new Error("Lossless stripping is only supported for JPEG/JPG images.");
  }
  
  const chunks = [];
  chunks.push(new Uint8Array(arrayBuffer, 0, 2)); // Add SOI (0xFFD8)
  
  let offset = 2;
  while (offset < length) {
    if (offset + 2 > length) {
      chunks.push(new Uint8Array(arrayBuffer, offset));
      break;
    }
    
    const marker = view.getUint16(offset);
    if ((marker & 0xFF00) !== 0xFF00) {
      // Find next 0xFF marker
      let nextFF = offset + 1;
      while (nextFF < length && view.getUint8(nextFF) !== 0xFF) {
        nextFF++;
      }
      chunks.push(new Uint8Array(arrayBuffer, offset, nextFF - offset));
      offset = nextFF;
      continue;
    }
    
    if (marker === 0xFFD9) { // EOI (End of Image)
      chunks.push(new Uint8Array(arrayBuffer, offset, 2));
      break;
    }
    
    if (marker === 0xFFDA) { // SOS (Start of Scan) - copy rest of file
      chunks.push(new Uint8Array(arrayBuffer, offset));
      break;
    }
    
    if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RST markers
      chunks.push(new Uint8Array(arrayBuffer, offset, 2));
      offset += 2;
      continue;
    }
    
    if (offset + 4 > length) {
      chunks.push(new Uint8Array(arrayBuffer, offset));
      break;
    }
    
    const segLength = view.getUint16(offset + 2);
    const totalSegSize = 2 + segLength;
    if (offset + totalSegSize > length) {
      chunks.push(new Uint8Array(arrayBuffer, offset));
      break;
    }
    
    // Determine whether to strip this segment
    let strip = false;
    if (marker === 0xFFE1) { // APP1 (EXIF, GPS, XMP)
      strip = true;
    } else if (marker === 0xFFED) { // APP13 (IPTC)
      strip = true;
    } else if (marker === 0xFFE2) { // APP2 (ICC Profile)
      if (mode === 'all') {
        strip = true;
      }
    }
    
    if (!strip) {
      chunks.push(new Uint8Array(arrayBuffer, offset, totalSegSize));
    }
    
    offset += totalSegSize;
  }
  
  // Combine all chunks into a single Uint8Array
  let totalBytes = 0;
  for (const chunk of chunks) {
    totalBytes += chunk.byteLength;
  }
  
  const result = new Uint8Array(totalBytes);
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }
  
  return result.buffer;
}

const REENCODE_MIME_TYPES = new Set(['image/png', 'image/webp']);

export function reencodeImageWithoutMetadata(previewSrc, sourceMimeType) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        reject(new Error('This image is too large to re-encode safely in the browser.'));
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('This browser cannot create a metadata-free image.'));
        return;
      }

      context.drawImage(image, 0, 0);
      const requestedMimeType = REENCODE_MIME_TYPES.has(sourceMimeType) ? sourceMimeType : 'image/png';
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('This image format could not be re-encoded by the browser.'));
          return;
        }
        const mimeType = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
        resolve({
          buffer: await blob.arrayBuffer(),
          mimeType,
          extension: mimeType === 'image/webp' ? 'webp' : 'png',
        });
      }, requestedMimeType, requestedMimeType === 'image/webp' ? 0.95 : undefined);
    };
    image.onerror = () => reject(new Error('This browser cannot decode the selected image format.'));
    image.src = previewSrc;
  });
}

function isCR3(arrayBuffer) {
  if (arrayBuffer.byteLength < 12) return false;
  const view = new DataView(arrayBuffer);
  try {
    const type = view.getUint32(4);
    const brand = view.getUint32(8);
    return type === 0x66747970 && brand === 0x63727820; // 'ftyp' and 'crx '
  } catch {
    return false;
  }
}

function extractCR3Boxes(buffer) {
  const view = new DataView(buffer);
  const cmtBoxes = {};
  let jpegThumbnail = null;

  function readString(offset, length) {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
  }

  function scan(offset, end) {
    while (offset + 8 <= end) {
      const size = view.getUint32(offset);
      const type = readString(offset + 4, 4);
      let boxSize = size;
      let headerSize = 8;
      if (size === 1) {
        const high = view.getUint32(offset + 8);
        const low = view.getUint32(offset + 12);
        boxSize = high * 4294967296 + low;
        headerSize = 16;
      } else if (size === 0) {
        boxSize = end - offset;
      }

      if (boxSize < headerSize || offset + boxSize > end) {
        break;
      }

      const trimmedType = type.trim();

      if (trimmedType === 'moov' || trimmedType === 'uuid') {
        let subStart = offset + headerSize;
        const subEnd = offset + boxSize;
        if (trimmedType === 'uuid') {
          subStart += 16; // Skip UUID
        }
        scan(subStart, subEnd);
      } else if (['CMT1', 'CMT2', 'CMT3', 'CMT4'].includes(trimmedType)) {
        const dataStart = offset + headerSize;
        cmtBoxes[trimmedType] = buffer.slice(dataStart, offset + boxSize);
      } else if (trimmedType === 'THMB') {
        const dataStart = offset + headerSize;
        const dataEnd = offset + boxSize;
        const thmbBytes = new Uint8Array(buffer, dataStart, dataEnd - dataStart);
        
        let jpegOffset = -1;
        for (let i = 0; i < thmbBytes.length - 1; i++) {
          if (thmbBytes[i] === 0xFF && thmbBytes[i+1] === 0xD8) {
            jpegOffset = i;
            break;
          }
        }
        if (jpegOffset !== -1) {
          jpegThumbnail = buffer.slice(dataStart + jpegOffset, dataEnd);
        }
      }

      offset += boxSize;
    }
  }

  scan(0, buffer.byteLength);
  return { cmtBoxes, jpegThumbnail };
}

function parseCR3Metadata(arrayBuffer) {
  const { cmtBoxes, jpegThumbnail } = extractCR3Boxes(arrayBuffer);
  const combinedTags = {};
  const combinedExpanded = {
    exif: {},
    gps: {},
    iptc: {},
    xmp: {},
    icc: {},
    file: {},
    makerNotes: {},
    composite: {}
  };
  
  for (const [name, cmtData] of Object.entries(cmtBoxes)) {
    try {
      const tags = ExifReader.load(cmtData);
      Object.assign(combinedTags, tags);
      
      const expTags = ExifReader.load(cmtData, { expanded: true });
      for (const groupName of Object.keys(expTags)) {
        if (expTags[groupName]) {
          combinedExpanded[groupName] = {
            ...combinedExpanded[groupName],
            ...expTags[groupName]
          };
        }
      }
    } catch (err) {
      console.warn(`Failed to parse ${name} tag:`, err);
    }
  }
  
  if (jpegThumbnail) {
    const bytes = new Uint8Array(jpegThumbnail);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    combinedTags['Thumbnail'] = {
      image: jpegThumbnail,
      base64: base64,
      type: 'image/jpeg'
    };
  }
  
  combinedTags['FileType'] = {
    value: 'cr3',
    description: 'Canon CR3 RAW'
  };
  
  return { tags: combinedTags, expandedTags: combinedExpanded };
}

// EXIF Smart Value Formatters
function exifGet(tags, ...keys) {
  for (const k of keys) {
    if (tags[k] !== undefined) return tags[k];
  }
  return null;
}

function fmtVal(tag) {
  if (!tag) return null;
  const d = tag.description;
  const v = tag.value;
  if (d !== undefined && d !== null && String(d).trim() !== '') return String(d).trim();
  if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  return null;
}

function fmtShutterSpeed(tags) {
  const tag = exifGet(tags, 'ExposureTime', 'ShutterSpeedValue');
  if (!tag) return null;
  if (tag.value !== undefined) {
    const num = Array.isArray(tag.value) ? tag.value[0] / tag.value[1] : Number(tag.value);
    if (isNaN(num)) return fmtVal(tag);
    if (num >= 1) return num % 1 === 0 ? `${num}"` : `${num.toFixed(1)}"`;
    return `1/${Math.round(1/num)}`;
  }
  return fmtVal(tag);
}

function fmtAperture(tags) {
  const tag = exifGet(tags, 'FNumber', 'ApertureValue');
  if (!tag) return null;
  if (tag.value !== undefined) {
    let num;
    if (Array.isArray(tag.value)) num = tag.value[0] / tag.value[1];
    else if (typeof tag.value === 'number') num = tag.value;
    else if (tag.description) {
      const d = parseFloat(tag.description);
      return isNaN(d) ? fmtVal(tag) : `f/${d}`;
    }
    if (num !== undefined && !isNaN(num)) {
      if (String(Object.keys(tags).find(k => tags[k] === tag)).includes('Aperture'))
        num = Math.pow(2, num / 2);
      return `f/${parseFloat(num.toFixed(1))}`;
    }
  }
  return fmtVal(tag);
}

function fmtISO(tags) {
  const tag = exifGet(tags, 'ISOSpeedRatings', 'PhotographicSensitivity', 'ISO');
  if (!tag) return null;
  const v = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  return v !== undefined ? `ISO ${v}` : fmtVal(tag);
}

function fmtFocalLength(tags) {
  const tag = exifGet(tags, 'FocalLength');
  if (!tag) return null;
  if (Array.isArray(tag.value)) {
    const mm = tag.value[0] / tag.value[1];
    return isNaN(mm) ? fmtVal(tag) : `${parseFloat(mm.toFixed(1))} mm`;
  }
  return fmtVal(tag);
}

function fmtFocalLength35(tags) {
  const tag = exifGet(tags, 'FocalLengthIn35mmFilm', 'FocalLengthIn35mmFormat');
  if (!tag) return null;
  const v = Array.isArray(tag.value) ? tag.value[0] : Number(tag.value);
  return isNaN(v) ? fmtVal(tag) : `${v} mm`;
}

function fmtCropFactor(tags) {
  const fl = exifGet(tags, 'FocalLength');
  const fl35 = exifGet(tags, 'FocalLengthIn35mmFilm', 'FocalLengthIn35mmFormat');
  if (!fl || !fl35) return null;
  const flMm = Array.isArray(fl.value) ? fl.value[0] / fl.value[1] : Number(fl.value);
  const fl35Mm = Array.isArray(fl35.value) ? fl35.value[0] : Number(fl35.value);
  if (!flMm || !fl35Mm) return null;
  const crop = fl35Mm / flMm;
  return `${parseFloat(crop.toFixed(2))}×`;
}

function getImageWidth(tags) {
  const tag = exifGet(tags, 'Image Width', 'ImageWidth', 'PixelXDimension', 'ExifImageWidth');
  if (!tag) return null;
  const val = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

function getImageHeight(tags) {
  const tag = exifGet(tags, 'Image Height', 'ImageLength', 'PixelYDimension', 'ExifImageHeight');
  if (!tag) return null;
  const val = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

function fmtAspectRatio(tags) {
  const w = getImageWidth(tags);
  const h = getImageHeight(tags);
  if (!w || !h) return null;
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const g = gcd(w, h);
  return `${w/g}:${h/g} (${w}×${h})`;
}

function fmtResolution(tags) {
  const w = getImageWidth(tags);
  const h = getImageHeight(tags);
  if (!w || !h) return null;
  const mp = ((w * h) / 1_000_000).toFixed(1);
  const dpi = fmtDPI(tags);
  return dpi ? `${mp} MP (${dpi})` : `${mp} MP`;
}

function fmtMeteringMode(tags) {
  const tag = exifGet(tags, 'MeteringMode');
  if (!tag) return null;
  const map = { 0:'Unknown', 1:'Average', 2:'Center-weighted', 3:'Spot', 4:'Multi-spot', 5:'Multi-zone', 6:'Partial', 255:'Other' };
  const v = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  return map[v] || fmtVal(tag);
}

function fmtFlash(tags) {
  const tag = exifGet(tags, 'Flash');
  if (!tag) return null;
  if (tag.description) return tag.description;
  const v = Array.isArray(tag.value) ? tag.value[0] : Number(tag.value);
  const fired = (v & 0x01) ? 'Flash fired' : 'No flash';
  return fired;
}

function fmtWhiteBalance(tags) {
  const tag = exifGet(tags, 'WhiteBalance');
  if (!tag) return null;
  const map = { 0:'Auto', 1:'Manual' };
  const v = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  return map[v] || fmtVal(tag);
}

function fmtColorSpace(tags) {
  const iccDesc = fmtVal(exifGet(tags, 'ICC Description'));
  if (iccDesc) return iccDesc;

  const iccSpace = fmtVal(exifGet(tags, 'Color Space'));
  if (iccSpace?.trim()) return iccSpace.trim();

  const tag = exifGet(tags, 'ColorSpace', 'exif:ColorSpace');
  if (!tag) return null;
  const map = { 1:'sRGB', 65535:'Uncalibrated', 2:'Adobe RGB' };
  const v = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  return map[v] || fmtVal(tag);
}

function fmtColorDepth(tags) {
  const bpsTag = exifGet(tags, 'Bits Per Sample', 'BitsPerSample');
  if (!bpsTag) return null;
  const bps = Number(Array.isArray(bpsTag.value) ? bpsTag.value[0] : bpsTag.value);
  if (isNaN(bps)) return fmtVal(bpsTag);

  const compTag = exifGet(tags, 'Color Components', 'SamplesPerPixel', 'ColorComponents');
  let comp = 1;
  if (compTag) {
    const c = Number(Array.isArray(compTag.value) ? compTag.value[0] : compTag.value);
    if (!isNaN(c)) comp = c;
  } else if (bps === 8) {
    comp = 3;
  }

  const totalBits = bps * comp;
  return `${totalBits}-bit`;
}

function fmtDPI(tags) {
  const xResTag = exifGet(tags, 'XResolution', 'X Resolution');
  if (!xResTag) return null;
  
  let val = xResTag.value;
  if (Array.isArray(val)) {
    val = val[0] / val[1];
  } else {
    val = Number(val);
  }
  
  if (isNaN(val)) return fmtVal(xResTag);
  
  const unitTag = exifGet(tags, 'ResolutionUnit', 'Resolution Unit');
  const unit = unitTag ? (Array.isArray(unitTag.value) ? unitTag.value[0] : unitTag.value) : 2;
  
  if (unit === 3) {
    const dpi = Math.round(val * 2.54);
    return `${dpi} dpi`;
  }
  
  return `${Math.round(val)} dpi`;
}

function fmtGPS(tags) {
  const lat = exifGet(tags, 'GPSLatitude');
  const lon = exifGet(tags, 'GPSLongitude');
  if (!lat || !lon) return null;
  
  const getDirSign = (ref, defaultSign) => {
    if (!ref) return defaultSign;
    const s = String(ref).trim().toUpperCase();
    if (s.startsWith('S') || s.startsWith('W')) return '-';
    if (s.startsWith('N') || s.startsWith('E')) return '';
    return defaultSign;
  };

  const latSign = getDirSign(fmtVal(exifGet(tags, 'GPSLatitudeRef')), '');
  const lonSign = getDirSign(fmtVal(exifGet(tags, 'GPSLongitudeRef')), '');

  const formatCoord = (raw, sign) => {
    const n = Math.abs(parseFloat(raw));
    if (isNaN(n)) return raw;
    return `${sign}${n.toFixed(6)}`;
  };

  const latFormatted = formatCoord(fmtVal(lat), latSign);
  const lonFormatted = formatCoord(fmtVal(lon), lonSign);

  return `${latFormatted}, ${lonFormatted}`;
}

function fmtDateTime(tags) {
  const tag = exifGet(tags, 'DateTimeOriginal', 'DateTimeDigitized', 'DateTime');
  if (!tag) return null;
  const v = fmtVal(tag);
  if (!v) return null;
  return v.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
}

function fmtEditTime(tags) {
  const tag = exifGet(tags, 'DateTime', 'FileModifyDate');
  if (!tag) return null;
  return fmtVal(tag)?.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') || null;
}

function fmtExposureMode(tags) {
  const tag = exifGet(tags, 'ExposureProgram');
  if (!tag) return null;
  const map = { 0:'Not defined', 1:'Manual', 2:'Program AE', 3:'Aperture priority', 4:'Shutter priority', 5:'Creative', 6:'Action', 7:'Portrait', 8:'Landscape', 9:'Bulb' };
  const v = Array.isArray(tag.value) ? tag.value[0] : tag.value;
  return map[v] || fmtVal(tag);
}

const EXIF_GROUPS = [
  {
    id: 'exposure',
    label: 'Exposure',
    icon: '📷',
    tabs: ['exposure', 'all'],
    params: [
      { label: 'Shutter Speed', fn: fmtShutterSpeed },
      { label: 'Aperture',      fn: fmtAperture },
      { label: 'ISO',           fn: fmtISO },
      { label: 'Exp. Bias',     fn: (t) => fmtVal(exifGet(t, 'ExposureBiasValue', 'ExposureCompensation')) },
      { label: 'Exposure Mode', fn: fmtExposureMode },
      { label: 'Metering Mode', fn: fmtMeteringMode },
      { label: 'Flash',         fn: fmtFlash },
    ],
  },
  {
    id: 'colors',
    label: 'Colors',
    icon: '🎨',
    tabs: ['colors', 'all'],
    params: [
      { label: 'White Balance', fn: fmtWhiteBalance },
      { label: 'Color Space',   fn: fmtColorSpace },
      { label: 'Color Depth',   fn: fmtColorDepth },
    ],
  },
  {
    id: 'optics',
    label: 'Optics',
    icon: '🔭',
    tabs: ['optics', 'all'],
    params: [
      { label: 'Focal Length',   fn: fmtFocalLength },
      { label: 'Focal (35mm eq.)', fn: fmtFocalLength35 },
      { label: 'Image Ratio',    fn: fmtAspectRatio },
      { label: 'Crop Factor',    fn: fmtCropFactor },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: '🗂️',
    tabs: ['others', 'all'],
    params: [
      { label: 'Resolution',    fn: fmtResolution },
      { label: 'Shooting Time', fn: fmtDateTime },
      { label: 'Last Edit Time',fn: fmtEditTime },
      { label: 'Manufacturer',  fn: (t) => fmtVal(exifGet(t, 'Make')) },
      { label: 'Camera Model',  fn: (t) => fmtVal(exifGet(t, 'Model')) },
      { label: 'Lens Model',    fn: (t) => fmtVal(exifGet(t, 'LensModel', 'LensType')) },
      { label: 'File Type',     fn: (t) => fmtVal(exifGet(t, 'FileType')) },
      { label: 'GPS',           fn: fmtGPS },
    ],
  },
];

const ADVANCED_GROUPS = [
  { id: 'exif', label: 'EXIF Metadata', icon: '📷' },
  { id: 'gps', label: 'GPS Metadata', icon: '📍' },
  { id: 'iptc', label: 'IPTC Metadata', icon: '📰' },
  { id: 'xmp', label: 'XMP Metadata', icon: '📝' },
  { id: 'icc', label: 'ICC Color Profile', icon: '🎨' },
  { id: 'file', label: 'File & Format Info', icon: '💾' },
  { id: 'makerNotes', label: 'Maker Notes (Camera Specific)', icon: '⚙️' },
  { id: 'composite', label: 'Composite / Calculated', icon: '🧮' },
  { id: 'other', label: 'Other Metadata', icon: '🗂️' },
];

function getTagGroup(tagName, expandedTags) {
  if (!expandedTags) return 'other';
  if (expandedTags.gps && tagName in expandedTags.gps) return 'gps';
  if (expandedTags.exif && tagName in expandedTags.exif) return 'exif';
  if (expandedTags.iptc && tagName in expandedTags.iptc) return 'iptc';
  if (expandedTags.xmp && tagName in expandedTags.xmp) return 'xmp';
  if (expandedTags.icc && tagName in expandedTags.icc) return 'icc';
  if (expandedTags.makerNotes && tagName in expandedTags.makerNotes) return 'makerNotes';
  if (expandedTags.composite && tagName in expandedTags.composite) return 'composite';
  
  if (
    (expandedTags.file && tagName in expandedTags.file) ||
    (expandedTags.jfif && tagName in expandedTags.jfif) ||
    (expandedTags.png && tagName in expandedTags.png) ||
    (expandedTags.riff && tagName in expandedTags.riff) ||
    (expandedTags.gif && tagName in expandedTags.gif)
  ) {
    return 'file';
  }
  
  const nameLower = tagName.toLowerCase();
  if (nameLower.startsWith('gps')) return 'gps';
  if (nameLower.startsWith('icc')) return 'icc';
  if (nameLower.startsWith('xmp')) return 'xmp';
  if (nameLower.startsWith('iptc')) return 'iptc';
  if (nameLower.includes('maker') || nameLower.includes('canon') || nameLower.includes('nikon') || nameLower.includes('sony')) return 'makerNotes';
  
  return 'other';
}

function getDecimalCoords(tags, expandedTags) {
  if (expandedTags?.gps?.Latitude !== undefined && expandedTags?.gps?.Longitude !== undefined) {
    return {
      lat: expandedTags.gps.Latitude,
      lon: expandedTags.gps.Longitude
    };
  }
  
  const formatted = fmtGPS(tags);
  if (!formatted) return null;
  const parts = formatted.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  
  return null;
}

const COMPARE_FIELDS = [
  { labelKey: 'metadata-fields.preview', fn: (img) => (
      <div className="compare-preview-thumb">
        {img.previewSrc ? (
          <img src={img.previewSrc} alt={img.name} />
        ) : (
          <div className="compare-raw-thumb">RAW</div>
        )}
      </div>
    )
  },
  { labelKey: 'metadata-fields.format', fn: (img) => img.type },
  { labelKey: 'metadata-fields.fileSize', fn: (img) => img.strippedInfo ? img.strippedInfo.formattedSize : img.formattedSize },
  { labelKey: 'metadata-fields.resolution', fn: (img) => fmtResolution(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.aspectRatio', fn: (img) => fmtAspectRatio(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.camera', fn: (img) => {
      const tags = img.strippedInfo ? img.strippedInfo.tags : img.tags;
      const make = fmtVal(exifGet(tags, 'Make'));
      const model = fmtVal(exifGet(tags, 'Model'));
      if (make && model) return `${make} ${model}`;
      return make || model || null;
    }
  },
  { labelKey: 'metadata-fields.lens', fn: (img) => fmtVal(exifGet(img.strippedInfo ? img.strippedInfo.tags : img.tags, 'LensModel', 'LensType')) },
  { labelKey: 'metadata-fields.dateTaken', fn: (img) => fmtDateTime(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.shutterSpeed', fn: (img) => fmtShutterSpeed(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.aperture', fn: (img) => fmtAperture(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { label: 'ISO', fn: (img) => fmtISO(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.exposureBias', fn: (img) => fmtVal(exifGet(img.strippedInfo ? img.strippedInfo.tags : img.tags, 'ExposureBiasValue', 'ExposureCompensation')) },
  { labelKey: 'metadata-fields.exposureMode', fn: (img) => fmtExposureMode(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.meteringMode', fn: (img) => fmtMeteringMode(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.focalLength', fn: (img) => fmtFocalLength(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.colorSpace', fn: (img) => fmtColorSpace(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.colorDepth', fn: (img) => fmtColorDepth(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { label: 'GPS', fn: (img) => fmtGPS(img.strippedInfo ? img.strippedInfo.tags : img.tags) },
  { labelKey: 'metadata-fields.software', fn: (img) => fmtVal(exifGet(img.strippedInfo ? img.strippedInfo.tags : img.tags, 'Software')) },
];

function downloadJson(tags, filename) {
  const cleanedTags = {};
  for (const [key, val] of Object.entries(tags)) {
    if (key === 'Thumbnail') {
      cleanedTags[key] = {
        base64: val.base64 ? val.base64.substring(0, 100) + '... [truncated]' : undefined,
        type: val.type
      };
    } else {
      cleanedTags[key] = val;
    }
  }
  const jsonString = JSON.stringify(cleanedTags, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^/.]+$/, "") + "_metadata.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export default function ImgMeta() {
  const { t } = useTranslation('tools');
  const { createObjectUrl, revokeObjectUrl, revokeAllObjectUrls } = useObjectUrlRegistry();
  const [dragOver, setDragOver] = useState(false);
  const [images, setImages] = useState([]); // Array of parsed image objects
  const [selectedImageId, setSelectedImageId] = useState(null); // Active single-view image
  const [compareMode, setCompareMode] = useState(false); // Toggle side-by-side view
  const [compareSelectedIds, setCompareSelectedIds] = useState([]); // Selected image IDs for comparison
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('');

  // Synchronize compareSelectedIds with loaded images
  useEffect(() => {
    setCompareSelectedIds(prev => {
      const activeIds = images.map(img => img.id);
      const kept = prev.filter(id => activeIds.includes(id));
      const newIds = activeIds.filter(id => !prev.includes(id));
      return [...kept, ...newIds];
    });
  }, [images]);

  const handleToggleCompareSelection = (id) => {
    setCompareSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const [collapsedGroups, setCollapsedGroups] = useState({
    exif: false,
    gps: false,
    iptc: false,
    xmp: false,
    icc: false,
    file: false,
    makerNotes: false,
    composite: false,
    other: false,
  });

  const fileInputRef = useRef(null);

  // Reset map view state when selected image changes
  React.useEffect(() => {
  }, [selectedImageId]);

  const processFiles = async (files) => {
    setStatus('');
    if (!files || files.length === 0) return;

    const resourceCheck = validateResourceAddition(images, files, FILE_RESOURCE_POLICIES.imageMetadata);
    if (!resourceCheck.valid) {
      setStatus(t('tool-imgmeta.ui.resourceRejected'));
      return;
    }

    const newImages = [];
    
    for (const file of files) {
      const loadPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target.result;
          let parsedTags = {};
          let expandedTags = {};
          let previewSrc = '';
          let isRaw = false;
          let type = file.name.split('.').pop().toUpperCase() || 'Unknown';
          
          try {
            if (isCR3(arrayBuffer)) {
              type = 'Canon CR3 RAW';
              const result = parseCR3Metadata(arrayBuffer);
              parsedTags = result.tags;
              expandedTags = result.expandedTags;
              
              if (parsedTags.Thumbnail && parsedTags.Thumbnail.base64) {
                previewSrc = 'data:image/jpeg;base64,' + parsedTags.Thumbnail.base64;
                isRaw = false;
              } else {
                isRaw = true;
              }
            } else {
              try {
                parsedTags = ExifReader.load(/** @type {ArrayBuffer} */ (arrayBuffer));
              } catch (exifErr) {
                console.warn("ExifReader failed:", exifErr);
                parsedTags = { 'Error': { value: exifErr.message, description: 'No EXIF metadata found or format unsupported.' } };
              }
              
              try {
                expandedTags = ExifReader.load(/** @type {ArrayBuffer} */ (arrayBuffer), { expanded: true });
              } catch {
                expandedTags = {};
              }
              
              // Load preview URL
              previewSrc = await new Promise((resPreview) => {
                const imgReader = new FileReader();
                imgReader.onload = (ev) => resPreview(String(ev.target?.result || ''));
                imgReader.onerror = () => resPreview('');
                imgReader.readAsDataURL(file);
              });
              isRaw = false;
            }
            
            resolve({
              id: createEphemeralId('image'),
              file: file,
              name: file.name,
              type: type,
              size: file.size,
              formattedSize: formatBytes(file.size),
              tags: parsedTags,
              expandedTags: expandedTags,
              previewSrc: previewSrc,
              isRaw: isRaw,
              originalBuffer: arrayBuffer,
              strippedInfo: null
            });
            
          } catch (err) {
            console.error("Processing error:", err);
            setStatus(t('tool-imgmeta.ui.processingFailed', { name: file.name }));
            resolve(null);
          }
        };
        reader.onerror = () => {
          setStatus(t('tool-imgmeta.ui.readFailed', { name: file.name }));
          resolve(null);
        };
        reader.readAsArrayBuffer(file);
      });
      
      const res = await loadPromise;
      if (res) {
        newImages.push(res);
      }
    }
    
    if (newImages.length > 0) {
      setImages(prev => {
        const updated = [...prev, ...newImages];
        if (!selectedImageId && updated.length > 0) {
          setSelectedImageId(updated[0].id);
        }
        return updated;
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDropzoneClick = (e) => {
    if (e.target === fileInputRef.current || e.target.closest('label') || e.target.closest('button')) {
      return;
    }
    fileInputRef.current.click();
  };

  const handleRemoveImage = (id) => {
    const imgToRemove = images.find(img => img.id === id);
    if (imgToRemove?.strippedInfo?.previewSrc?.startsWith('blob:')) {
      revokeObjectUrl(imgToRemove.strippedInfo.previewSrc);
    }
    
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      if (selectedImageId === id) {
        setSelectedImageId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const handleClear = () => {
    revokeAllObjectUrls();
    setImages([]);
    setSelectedImageId(null);
    setCompareMode(false);
    setActiveTab('all');
    setSearchQuery('');
    setStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStripMetadata = async (image, mode) => {
    try {
      const isJpeg = image.type === 'JPEG' || image.type === 'JPG' || image.name.toLowerCase().endsWith('.jpg') || image.name.toLowerCase().endsWith('.jpeg');
      const sourceMimeType = image.file?.type || '';
      let strippedBuffer;
      let outputMimeType;
      let outputExtension;

      if (isJpeg) {
        strippedBuffer = stripJpegMetadata(image.originalBuffer, mode);
        outputMimeType = 'image/jpeg';
        outputExtension = image.name.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'jpg';
      } else {
        if (mode === 'private') {
          setStatus(t('tool-imgmeta.ui.privateJpegOnly'));
          return;
        }
        if (!image.previewSrc || image.type === 'Canon CR3 RAW') {
          setStatus(t('tool-imgmeta.ui.cannotEncode'));
          return;
        }
        const reencoded = await reencodeImageWithoutMetadata(image.previewSrc, sourceMimeType);
        strippedBuffer = reencoded.buffer;
        outputMimeType = reencoded.mimeType;
        outputExtension = reencoded.extension;
      }
      
      let strippedTags = {};
      let strippedExpanded = {};
      try {
        strippedTags = ExifReader.load(strippedBuffer);
      } catch {
        console.log("Verified: No EXIF tags found in stripped image.");
      }
      try {
        strippedExpanded = ExifReader.load(strippedBuffer, { expanded: true });
      } catch {
        strippedExpanded = {};
      }
      
      const removedTags = [];
      const retainedTags = [];
      
      for (const tagName of Object.keys(image.tags)) {
        if (tagName === 'Thumbnail' || tagName === 'thumbnail' || tagName === 'FileType') continue;
        if (tagName in strippedTags) {
          retainedTags.push(tagName);
        } else {
          removedTags.push(tagName);
        }
      }
      
      const blob = new Blob([strippedBuffer], { type: outputMimeType });
      const strippedPreviewSrc = createObjectUrl(blob);
      
      setImages(prev => prev.map(img => {
        if (img.id === image.id) {
          return {
            ...img,
            strippedInfo: {
              mode: mode,
              buffer: strippedBuffer,
              tags: strippedTags,
              expandedTags: strippedExpanded,
              removedTags: removedTags,
              retainedTags: retainedTags,
              previewSrc: strippedPreviewSrc,
              formattedSize: formatBytes(strippedBuffer.byteLength),
              mimeType: outputMimeType,
              extension: outputExtension,
            }
          };
        }
        return img;
      }));
      
      setStatus(t('tool-imgmeta.ui.stripSuccess', { format: outputExtension.toUpperCase() }));
    } catch (err) {
      console.error(err);
      setStatus(t('tool-imgmeta.ui.stripFailed'));
    }
  };

  const handleRestoreOriginal = (imageId) => {
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        if (img.strippedInfo && img.strippedInfo.previewSrc && img.strippedInfo.previewSrc.startsWith('blob:')) {
          revokeObjectUrl(img.strippedInfo.previewSrc);
        }
        return {
          ...img,
          strippedInfo: null
        };
      }
      return img;
    }));
    setStatus(t('tool-imgmeta.ui.restored'));
  };

  const downloadStrippedFile = (image) => {
    if (!image.strippedInfo) return;
    const blob = new Blob([image.strippedInfo.buffer], { type: image.strippedInfo.mimeType });
    const url = createObjectUrl(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const nameWithoutExt = image.name.substring(0, image.name.lastIndexOf('.'));
    a.download = `${nameWithoutExt}_stripped.${image.strippedInfo.extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeObjectUrl(url);
  };

  const handleExportZip = async () => {
    if (images.length === 0) return;
    setStatus(t('tool-imgmeta.ui.generatingZip'));
    try {
      const zip = new JSZip();
      
      for (const image of images) {
        const buffer = image.strippedInfo ? image.strippedInfo.buffer : image.originalBuffer;
        
        let filename = image.name;
        if (image.strippedInfo) {
          const nameWithoutExt = image.name.substring(0, image.name.lastIndexOf('.'));
          filename = `${nameWithoutExt}_stripped.${image.strippedInfo.extension}`;
        }
        
        zip.file(filename, buffer);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = createObjectUrl(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imgmeta_exported_images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      revokeObjectUrl(url);
      
      setStatus(t('tool-imgmeta.ui.zipSuccess'));
    } catch (err) {
      console.error(err);
      setStatus(t('tool-imgmeta.ui.zipFailed'));
    }
  };

  const activeImage = images.find(img => img.id === selectedImageId) || images[0];
  const displayedTags = activeImage ? (activeImage.strippedInfo ? activeImage.strippedInfo.tags : activeImage.tags) : null;
  const displayedExpanded = activeImage ? (activeImage.strippedInfo ? activeImage.strippedInfo.expandedTags : activeImage.expandedTags) : null;
  const displayedPreviewSrc = activeImage ? (activeImage.strippedInfo ? activeImage.strippedInfo.previewSrc : activeImage.previewSrc) : '';
  const displayedSize = activeImage ? (activeImage.strippedInfo ? activeImage.strippedInfo.formattedSize : activeImage.formattedSize) : '';
  const isRaw = activeImage ? activeImage.isRaw : false;

  const gpsCoords = displayedTags ? getDecimalCoords(displayedTags, displayedExpanded) : null;
  const gpsCoord = displayedTags ? fmtGPS(displayedTags) : null;
  const gpsMapPreview = gpsCoords ? (
    <ExternalMapPreview
      latitude={gpsCoords.lat}
      longitude={gpsCoords.lon}
      title={t('imgmeta-extra.gpsLocation')}
      collapsible
    />
  ) : null;

  const query = searchQuery.toLowerCase().trim();

  const renderCamView = () => {
    if (!displayedTags) return null;
    let anyGroup = false;
    const groupsToRender = [];

    for (const group of EXIF_GROUPS) {
      if (!group.tabs.includes(activeTab)) continue;

      const params = group.params.map(p => ({
        label: p.label,
        value: p.fn(displayedTags),
      })).filter(p => {
        // If there is an isolated GPS block, do not show GPS in the Other/All tables
        if (p.label === 'GPS' && gpsCoord) return false;
        
        // Hide Camera Model and Lens Model under Others if they are empty
        if ((p.label === 'Camera Model' || p.label === 'Lens Model') && !p.value) return false;
        
        if (!query) return true;
        return p.label.toLowerCase().includes(query) || (p.value || '').toLowerCase().includes(query);
      });

      if (params.length === 0) continue;
      anyGroup = true;

      groupsToRender.push(
        <div key={group.id} className="border border-border bg-card rounded-xl p-4 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-main border-b border-border pb-2">
            <span className="text-accent">{group.icon}</span>
            <span>{group.label}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(() => {
              const cells = [];
              let i = 0;
              while (i < params.length) {
                const p = params[i];
                if (p.label === 'Camera Model' && i + 1 < params.length && params[i+1].label === 'Lens Model') {
                  const pNext = params[i+1];
                  cells.push(
                    <div key={`group-${i}`} className="col-span-1 sm:col-span-2 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1 bg-app border border-border/40 rounded-lg p-2.5">
                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{p.label}</div>
                        <div className={`text-sm font-bold text-text-main truncate font-mono ${p.value ? '' : 'opacity-40 font-normal'}`} title={p.value || ''}>
                          {p.value || '—'}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 bg-app border border-border/40 rounded-lg p-2.5">
                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{pNext.label}</div>
                        <div className={`text-sm font-bold text-text-main truncate font-mono ${pNext.value ? '' : 'opacity-40 font-normal'}`} title={pNext.value || ''}>
                          {pNext.value || '—'}
                        </div>
                      </div>
                    </div>
                  );
                  i += 2;
                } else {
                  cells.push(
                    <div key={i} className="flex flex-col gap-1 bg-app border border-border/40 rounded-lg p-2.5">
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{p.label}</div>
                      <div className={`text-sm font-bold text-text-main truncate font-mono ${p.value ? '' : 'opacity-40 font-normal'}`} title={p.value || ''}>
                        {p.value || '—'}
                      </div>
                    </div>
                  );
                  i += 1;
                }
              }
              return cells;
            })()}
          </div>
        </div>
      );
    }

    if (!anyGroup) {
      return <div className="text-center py-8 text-sm text-text-muted italic bg-card border border-border rounded-xl">{t('imgmeta-extra.noMatchingParameters')}</div>;
    }

    return <div className="flex flex-col gap-4 w-full">{groupsToRender}</div>;
  };

  const getGroupedAdvancedTags = () => {
    if (!displayedTags) return {};
    
    const groups = {
      exif: [],
      gps: [],
      iptc: [],
      xmp: [],
      icc: [],
      file: [],
      makerNotes: [],
      composite: [],
      other: []
    };
    
    let matchCount = 0;
    
    Object.keys(displayedTags).forEach(tagName => {
      if (tagName === 'Thumbnail' || tagName === 'thumbnail') return;
      
      const tagData = displayedTags[tagName];
      const valStr = String(tagData.value !== undefined ? tagData.value : '');
      const descStr = String(tagData.description !== undefined ? tagData.description : '');
      
      if (query) {
        if (!tagName.toLowerCase().includes(query) &&
            !valStr.toLowerCase().includes(query) &&
            !descStr.toLowerCase().includes(query)) return;
      }
      
      const groupKey = getTagGroup(tagName, displayedExpanded);
      groups[groupKey].push({
        name: tagName,
        value: valStr,
        description: descStr
      });
      matchCount++;
    });
    
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return { groups, matchCount };
  };

  const toggleExpandAll = () => {
    const anyCollapsed = Object.values(collapsedGroups).some(v => v);
    const target = !anyCollapsed;
    setCollapsedGroups({
      exif: target,
      gps: target,
      iptc: target,
      xmp: target,
      icc: target,
      file: target,
      makerNotes: target,
      composite: target,
      other: target,
    });
  };

  const renderAdvancedGroups = () => {
    const { groups, matchCount } = getGroupedAdvancedTags();
    
    if (matchCount === 0) {
      return (
        <div id="imgmeta-no-tags" className="text-center py-8 text-sm text-text-muted italic bg-card border border-border rounded-xl">
          {t('imgmeta-extra.noMatchingTags')}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-between items-center gap-4 bg-card border border-border rounded-xl p-3 shadow-sm">
          <span className="text-xs font-semibold text-text-main">{t('imgmeta-extra.foundTags', { count: matchCount })}</span>
          <Button variant="secondary" size="sm" onClick={toggleExpandAll}>
            {Object.values(collapsedGroups).every(v => !v) ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>
        
        <div className="flex flex-col gap-3">
          {ADVANCED_GROUPS.map(g => {
            const list = groups[g.id] || [];
            if (list.length === 0) return null;
            
            const isCollapsed = collapsedGroups[g.id];
            
            return (
              <div key={g.id} className="border border-border bg-card rounded-xl shadow-sm overflow-hidden">
                <div
                  className="flex justify-between items-center p-3 cursor-pointer select-none hover:bg-app/40 transition-colors"
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-text-main">
                    <span className="text-accent">{g.icon}</span>
                    <span>{g.label}</span>
                    <span className="text-text-muted font-normal text-xs">({list.length})</span>
                  </div>
                  <span className="text-xs text-text-muted">{isCollapsed ? '▼' : '▲'}</span>
                </div>
                
                {!isCollapsed && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border bg-app/50 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          <th className="p-3 pl-4">{t('imgmeta-extra.tagName')}</th>
                          <th className="p-3">{t('imgmeta-extra.value')}</th>
                          <th className="p-3 pr-4">{t('imgmeta-extra.description')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {list.map(tag => (
                          <tr key={tag.name} className="hover:bg-app/20 transition-colors font-mono">
                            <td className="p-3 pl-4 font-semibold text-text-main whitespace-nowrap">{tag.name}</td>
                            <td className="p-3 text-text-main max-w-[240px] truncate" title={tag.value}>{tag.value}</td>
                            <td className="p-3 pr-4 text-text-muted max-w-[280px] truncate" title={tag.description}>{tag.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCompareView = () => {
    const comparedImages = images.filter(img => compareSelectedIds.includes(img.id));

    return (
      <div className="border border-border bg-card rounded-xl p-5 flex flex-col gap-5 shadow-sm w-full">
        <div className="flex justify-between items-center gap-4 border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text-main">⚖️ {t('imgmeta-extra.comparisonTitle')}</h3>
          <Button variant="secondary" size="sm" onClick={() => setCompareMode(false)}>
            {t('tool-imgmeta.ui.backDetail')}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          {comparedImages.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-app/50 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <th className="p-3.5 pl-4 w-48 shrink-0">{t('tool-imgmeta.ui.fieldParameter')}</th>
                  {comparedImages.map(img => (
                    <th key={img.id} className={`p-3.5 min-w-[200px] max-w-[300px] ${img.id === selectedImageId ? 'bg-accent-light/10 border-x border-accent/20' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-text-main truncate" title={img.name}>{img.name}</span>
                        <button
                          type="button"
                          className="text-text-muted hover:text-red-500 text-sm font-bold cursor-pointer bg-transparent border-none p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompareSelection(img.id);
                          }}
                          title={t('metadata-common.excludeComparison')}
                        >
                          ×
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {COMPARE_FIELDS.map((field, fIdx) => (
                  <tr key={fIdx} className="hover:bg-app/10 transition-colors">
                    <td className="p-3.5 pl-4 font-bold text-text-muted bg-app/20 text-xs font-sans">{t(field.labelKey)}</td>
                    {comparedImages.map(img => {
                      const val = field.fn(img);
                      return (
                        <td
                          key={img.id}
                          className={`p-3.5 truncate max-w-[300px] ${img.id === selectedImageId ? 'bg-accent-light/5 border-x border-accent/10' : ''} ${!val ? 'opacity-40 font-normal font-sans' : 'text-text-main font-semibold'}`}
                        >
                          {val || '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-app/20">
              <p className="text-sm font-semibold text-text-muted">{t('tool-imgmeta.ui.noImagesCompared')}</p>
              <p className="text-xs text-text-muted/60 mt-1">
                {t('tool-imgmeta.ui.selectComparisonHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderThumbnailsBar = () => {
    if (images.length === 0) return null;
    
    const isJpeg = activeImage && (activeImage.type === 'JPEG' || activeImage.type === 'JPG' || activeImage.name.toLowerCase().endsWith('.jpg') || activeImage.name.toLowerCase().endsWith('.jpeg'));
    const canStripMetadata = activeImage && activeImage.type !== 'Canon CR3 RAW' && Boolean(activeImage.previewSrc);
    
    return (
      <div className="flex flex-col gap-4 border-b border-border pb-5 mb-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 w-full">
          {images.map(img => (
            <div
              key={img.id}
              className={`relative flex items-center gap-2.5 bg-card border rounded-xl p-1.5 cursor-pointer hover:border-accent transition-all shrink-0 w-48 ${
                img.id === selectedImageId 
                  ? 'border-accent bg-accent-light/10 shadow-sm' 
                  : 'border-border'
              }`}
              onClick={() => {
                setSelectedImageId(img.id);
              }}
            >
              {images.length > 1 && (
                <input
                  type="checkbox"
                  className="absolute top-2 left-2 z-10 rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                  checked={compareSelectedIds.includes(img.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleCompareSelection(img.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title={t('metadata-common.includeComparison')}
                />
              )}
              <div className="relative w-12 h-12 rounded-lg bg-app overflow-hidden flex items-center justify-center border border-border/50 shrink-0">
                {img.previewSrc ? (
                  <img src={img.previewSrc} alt={img.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[10px] font-black text-text-muted">RAW</div>
                )}
                <button
                  type="button"
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center text-xs font-bold cursor-pointer opacity-0 hover:opacity-100 parent-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(img.id);
                  }}
                  style={{ transform: 'scale(0.85)' }}
                  title={t('imgmeta-extra.removeImage')}
                >
                  ×
                </button>
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-xs font-semibold text-text-main truncate pr-2" title={img.name}>{img.name}</span>
                <span className="text-[10px] text-text-muted mt-0.5">{img.strippedInfo ? img.strippedInfo.formattedSize : img.formattedSize}</span>
              </div>
            </div>
          ))}
          
          <div 
            className="flex items-center justify-center gap-2 bg-app border border-border border-dashed rounded-xl p-3 cursor-pointer hover:border-accent hover:bg-accent-light/5 text-xs font-semibold text-text-muted shrink-0 w-36 select-none transition-colors"
            onClick={handleDropzoneClick}
          >
            <span className="text-base font-bold text-accent">+</span>
            <span>{t('tool-imgmeta.ui.addMore')}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4 mt-1 bg-app/40 border border-border rounded-xl p-3">
          {/* Metadata Stripping inline */}
          {canStripMetadata ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {!activeImage.strippedInfo ? (
                <>
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">{t('tool-imgmeta.ui.stripMeta')}</span>
                  {isJpeg && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-1 hover:text-accent font-bold"
                      onClick={() => handleStripMetadata(activeImage, 'private')}
                    >
                      🔒 {t('metadata-common.private')}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1 hover:text-red-500 font-bold"
                    onClick={() => handleStripMetadata(activeImage, 'all')}
                  >
                    🗑️ {t('imgmeta-extra.removeAll')}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-accent">
                    ✓ {t('imgmeta-extra.stripped', { mode: activeImage.strippedInfo.mode === 'private' ? t('imgmeta-extra.privateOnly') : t('imgmeta-extra.allMetadata') })}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => downloadStrippedFile(activeImage)}
                  >
                    💾 {t('imgmeta-extra.downloadStripped')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestoreOriginal(activeImage.id)}
                  >
                    🔄 {t('imgmeta-extra.restoreOriginal')}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-text-muted/60 italic">
              {t('tool-imgmeta.ui.rawCannotEncode')}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant={compareMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
              title={t('metadata-common.toggleComparison')}
              className="flex items-center gap-1.5"
            >
              <span>⚖️ {t('imgmeta-extra.compare')} {images.length > 1 ? `(${compareSelectedIds.length})` : ''}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportZip}
              title={t('imgmeta-extra.exportZipTitle')}
              className="flex items-center gap-1.5"
            >
              <span>📦 {t('imgmeta-extra.exportZip')}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear}>
              {t('tool-imgmeta.ui.clearAll')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card id="tool-imgmeta" variant="tool" size="wide">
      <ToolHeader 
        title={t('tool-imgmeta.ui.title')}
      />
      
      <div 
        className="relative flex flex-col mt-6 min-h-[300px]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Always render the file input so it is accessible via Ref */}
        <input
          type="file"
          id="imgmeta-file-input"
          accept="image/*,.cr3,.CR3"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        {/* Full-width drag over overlay when files are already present */}
        {dragOver && images.length > 0 && (
          <div className="absolute inset-0 bg-accent/15 border-2 border-dashed border-accent rounded-xl flex items-center justify-center z-30 backdrop-blur-[2px] transition-all">
            <div className="flex flex-col items-center gap-3 text-accent text-center bg-card border border-border rounded-2xl p-6 shadow-lg">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <p className="text-sm font-bold">{t('tool-imgmeta.ui.dropAdd')}</p>
            </div>
          </div>
        )}

        {/* Thumbnails list bar at the top */}
        {renderThumbnailsBar()}

        {/* Drag and Drop Zone */}
        {images.length === 0 && (
          <div
            id="imgmeta-dropzone"
            className={`flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-10 cursor-pointer bg-card/50 hover:bg-card/80 hover:border-accent transition-all text-center select-none ${dragOver ? 'border-accent bg-accent/5' : ''}`}
            onClick={handleDropzoneClick}
          >
            <div className="flex flex-col items-center gap-4 max-w-sm">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted/60">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <div>
                <p className="text-base font-bold text-text-main">{t('tool-imgmeta.ui.dragDrop')}</p>
                <p className="text-xs text-text-muted mt-1">{t('tool-imgmeta.ui.or')}</p>
              </div>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
              >
                {t('tool-imgmeta.ui.browse')}
              </Button>
              <p className="text-[10px] text-text-muted/60 leading-relaxed">{t('tool-imgmeta.ui.supports')}</p>
              <p role="note" className="rounded-md border border-accent/30 bg-accent-light px-2.5 py-1.5 text-xs font-semibold text-accent">
                {t('tool-imgmeta.ui.stripSupport')}
              </p>
            </div>
          </div>
        )}

        {/* Results Area */}
        {images.length > 0 && compareMode && renderCompareView()}

        {images.length > 0 && !compareMode && activeImage && (
          <div id="imgmeta-results" className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            
            {/* Left Column: File Info & Preview & Stripper Diff */}
            <div className="lg:col-span-2 flex flex-col gap-6 w-full">
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="relative bg-app/80 flex items-center justify-center p-4 border-b border-border/60 min-h-[180px] max-h-[360px] overflow-hidden">
                  {displayedPreviewSrc && (
                    <img id="imgmeta-preview-img" alt={t('metadata-common.imagePreview')} src={displayedPreviewSrc} className="max-w-full max-h-[320px] rounded-lg object-contain shadow-sm" />
                  )}
                  {isRaw && (
                    <div id="imgmeta-raw-icon" className="flex flex-col items-center gap-2 text-text-muted/40">
                      <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      <span className="text-xs font-bold uppercase tracking-wider">{t('tool-imgmeta.ui.rawNoThumbnail')}</span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1.5 bg-card">
                  <h3 id="imgmeta-file-name" className="text-sm font-bold text-text-main truncate" title={activeImage.name}>{activeImage.name}</h3>
                  <div className="flex justify-between items-center text-xs mt-1 border-t border-border/40 pt-2 text-text-muted">
                    <p><span className="font-semibold text-text-main">{t('metadata-common.format')}</span> <span className="font-mono">{activeImage.type}</span></p>
                    <p><span className="font-semibold text-text-main">{t('metadata-common.size')}</span> <span className="font-mono">{displayedSize}</span></p>
                  </div>
                </div>
              </div>

              {/* Stripper Diff (Visual list of removed vs retained tags) */}
              {activeImage.strippedInfo && (
                <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('tool-imgmeta.ui.verification')}</h4>
                  <div className="flex flex-col gap-3.5 border border-border rounded-lg p-3 bg-app/30">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{t('imgmeta-extra.removed', { count: activeImage.strippedInfo.removedTags.length })}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeImage.strippedInfo.removedTags.slice(0, 10).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-mono border border-red-500/20">{t}</span>
                        ))}
                        {activeImage.strippedInfo.removedTags.length > 10 && (
                          <span className="px-1.5 py-0.5 rounded bg-app text-text-muted text-[10px] font-mono border border-border">{t('imgmeta-extra.more', { count: activeImage.strippedInfo.removedTags.length - 10 })}</span>
                        )}
                        {activeImage.strippedInfo.removedTags.length === 0 && <span className="text-xs text-text-muted/50 italic">{t('tool-imgmeta.ui.none')}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{t('imgmeta-extra.retained', { count: activeImage.strippedInfo.retainedTags.length })}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeImage.strippedInfo.retainedTags.slice(0, 10).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-mono border border-emerald-500/20">{t}</span>
                        ))}
                        {activeImage.strippedInfo.retainedTags.length > 10 && (
                          <span className="px-1.5 py-0.5 rounded bg-app text-text-muted text-[10px] font-mono border border-border">{t('imgmeta-extra.more', { count: activeImage.strippedInfo.retainedTags.length - 10 })}</span>
                        )}
                        {activeImage.strippedInfo.retainedTags.length === 0 && <span className="text-xs text-text-muted/50 italic">{t('tool-imgmeta.ui.none')}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Actions */}
              <div className="flex items-center gap-2">
                <Button
                  id="imgmeta-download-json"
                  variant="primary"
                  className="flex-1 flex items-center justify-center gap-1.5"
                  onClick={() => downloadJson(displayedTags, activeImage.name)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>{t('tool-imgmeta.ui.exportJson')}</span>
                </Button>
                <Button id="imgmeta-clear" variant="secondary" onClick={() => handleRemoveImage(activeImage.id)}>{t('tool-imgmeta.ui.remove')}</Button>
              </div>
            </div>

            {/* Right Column: Metadata Tabs, Table & GPS Map */}
            <div className="lg:col-span-3 flex flex-col gap-4 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
                <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
                  {['all', 'exposure', 'colors', 'optics', 'others', 'advanced'].map(tab => (
                    <button
                      key={tab}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === tab 
                          ? 'bg-accent border-accent text-white shadow-sm' 
                          : 'bg-card border-border text-text-muted hover:text-text-main hover:bg-nav-hover-bg'
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    id="imgmeta-tag-search"
                    className="w-full bg-card border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-text-main outline-none focus:border-accent"
                    placeholder={t('tool-imgmeta.ui.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Param Group View */}
              {activeTab !== 'advanced' && (
                <div id="imgmeta-cam-view" className="flex flex-col gap-4 w-full">
                  {renderCamView()}
                  
                  {gpsMapPreview}
                </div>
              )}

              {/* Advanced Table View - Collapsible Groups */}
              {activeTab === 'advanced' && (
                <div className="flex flex-col gap-4 w-full">
                  {renderAdvancedGroups()}
                  
                  {gpsMapPreview}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {status && <p className="min-h-[18px] text-red-500 font-medium text-sm mt-4 text-center" id="imgmeta-status">{status}</p>}
    </Card>
  );
}
