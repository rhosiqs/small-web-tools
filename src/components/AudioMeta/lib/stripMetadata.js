import { readSyncsafeInt } from './id3.js';

function stripMp3Metadata(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  let start = 0;
  let end = uint8.length;

  // Strip ID3v2 from start
  if (uint8[0] === 0x49 && uint8[1] === 0x44 && uint8[2] === 0x33) {
    const tagSize = readSyncsafeInt(uint8, 6);
    // ID3v2.4 flag 0x10: a 10-byte footer follows the tag, outside tagSize.
    const footerSize = uint8[3] === 4 && (uint8[5] & 0x10) ? 10 : 0;
    start = 10 + tagSize + footerSize;
  }

  // Strip ID3v1 from end
  if (end >= 128 && uint8[end - 128] === 0x54 && uint8[end - 127] === 0x41 && uint8[end - 126] === 0x47) {
    end = end - 128;
  }

  // A tag that claims to reach past the audio would leave an empty "stripped"
  // file; report a failure instead of offering that download.
  if (start >= end) throw new Error('The ID3 tag size exceeds the file.');

  // mode === 'all' strips both; mode === 'id3v2only' strips only v2
  const sliced = uint8.slice(start, end);
  return sliced.buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Master file parser dispatcher
// ─────────────────────────────────────────────────────────────────────────────


export { stripMp3Metadata };
