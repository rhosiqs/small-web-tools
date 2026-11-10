import ExifReader from 'exifreader';
import { describe, expect, it } from 'vitest';
import { isJpegBuffer, strippedImageFileName, stripJpegMetadata } from '../components/ImgMeta.jsx';

// Phones store portrait photos as landscape pixels plus an EXIF Orientation
// tag. Dropping that tag along with the rest of APP1 makes every viewer show
// the "cleaned" photo lying on its side, so stripping keeps Orientation alone.

const segment = (marker, payload) => {
  const bytes = new Uint8Array(4 + payload.length);
  bytes[0] = 0xff;
  bytes[1] = marker;
  new DataView(bytes.buffer).setUint16(2, payload.length + 2);
  bytes.set(payload, 4);
  return bytes;
};

const ascii = (text) => Uint8Array.from(text, (character) => character.charCodeAt(0));

// Little-endian TIFF with IFD0 = { Make, Orientation }, the layout most
// cameras and phones write.
function exifPayload(orientation) {
  const tiff = new Uint8Array(8 + 2 + 2 * 12 + 4 + 8);
  const view = new DataView(tiff.buffer);
  tiff.set(ascii('II'), 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 2, true);
  const makeOffset = 8 + 2 + 2 * 12 + 4;
  // Make (0x010F), ASCII, 8 bytes stored at makeOffset.
  view.setUint16(10, 0x010f, true);
  view.setUint16(12, 2, true);
  view.setUint32(14, 8, true);
  view.setUint32(18, makeOffset, true);
  // Orientation (0x0112), SHORT, 1 value stored inline.
  view.setUint16(22, 0x0112, true);
  view.setUint16(24, 3, true);
  view.setUint32(26, 1, true);
  view.setUint16(30, orientation, true);
  view.setUint32(34, 0, true);
  tiff.set(ascii('PhoneCo\0'), makeOffset);
  return new Uint8Array([...ascii('Exif\0\0'), ...tiff]);
}

function buildJpeg(orientation) {
  const parts = [
    new Uint8Array([0xff, 0xd8]),
    segment(0xe0, new Uint8Array([...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])),
    segment(0xe1, exifPayload(orientation)),
    segment(0xe2, new Uint8Array([...ascii('ICC_PROFILE\0'), 1, 1, 0, 0, 0, 0])),
    segment(0xdb, new Uint8Array(65)),
    segment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0])),
    new Uint8Array([0x12, 0x34, 0xff, 0x00, 0x56]),
    new Uint8Array([0xff, 0xd9]),
  ];
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    bytes.set(part, cursor);
    cursor += part.length;
  }
  return bytes;
}

const markersOf = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const markers = [];
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    markers.push(marker);
    if (marker === 0xda) break;
    offset += 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3]);
  }
  return markers;
};

describe('ImgMeta JPEG metadata stripping', () => {
  it.each(['private', 'all'])('keeps a rotated photo upright in %s mode', (mode) => {
    const output = stripJpegMetadata(buildJpeg(6).buffer, mode);
    const tags = ExifReader.load(output);

    expect(tags.Orientation?.value).toBe(6);
    expect(tags.Make).toBeUndefined();
    // JFIF must stay directly after SOI; the orientation-only EXIF follows it.
    expect(markersOf(output).slice(0, 2)).toEqual([0xe0, 0xe1]);
  });

  it('writes no EXIF block at all when the photo is already upright', () => {
    const output = stripJpegMetadata(buildJpeg(1).buffer, 'all');
    expect(markersOf(output)).not.toContain(0xe1);
  });

  it('keeps the colour profile in private mode and drops it in all mode', () => {
    expect(markersOf(stripJpegMetadata(buildJpeg(6).buffer, 'private'))).toContain(0xe2);
    expect(markersOf(stripJpegMetadata(buildJpeg(6).buffer, 'all'))).not.toContain(0xe2);
  });

  it('copies the entropy-coded image data unchanged', () => {
    const input = buildJpeg(6);
    const output = new Uint8Array(stripJpegMetadata(input.buffer, 'all'));
    const scan = (bytes) => bytes.slice(bytes.lastIndexOf(0xda) - 1);
    expect(scan(output)).toEqual(scan(input));
  });
});

describe('ImgMeta stripped output naming and format detection', () => {
  it('detects JPEG by content so a .jfif photo gets the lossless path and a mislabelled PNG does not', () => {
    expect(isJpegBuffer(buildJpeg(1).buffer)).toBe(true);
    expect(isJpegBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer)).toBe(false);
    expect(isJpegBuffer(new ArrayBuffer(0))).toBe(false);
  });

  it('keeps the base name of a file that has no extension', () => {
    expect(strippedImageFileName('IMG_0001', 'png')).toBe('IMG_0001_stripped.png');
    expect(strippedImageFileName('holiday.photo.jpeg', 'jpeg')).toBe('holiday.photo_stripped.jpeg');
    expect(strippedImageFileName('.hidden', 'png')).toBe('.hidden_stripped.png');
  });
});
