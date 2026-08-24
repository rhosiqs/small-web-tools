import { latin1ToString, parseID3v2, readUint16BE, readUint16LE, readUint32BE, readUint32LE } from './id3.js';

/**
 * @typedef {Object} AudioTechnicalMetadata
 * @property {number} [numChannels]
 * @property {number} [sampleRate]
 * @property {number} [bitsPerSample]
 * @property {string | null} [bitrate]
 * @property {string} [audioFormat]
 * @property {number | null} [durationSec]
 * @property {number} [timescale]
 * @property {string} [brand]
 */
/** @typedef {{ technical: AudioTechnicalMetadata, tags: Record<string, string>, coverArt: string | null }} AudioFormatMetadata */

function parseWav(uint8) {
  /** @type {AudioFormatMetadata} */
  const result = { technical: {}, tags: {}, coverArt: null };
  if (uint8.length < 44) return result;

  const riff = latin1ToString(uint8.slice(0, 4));
  const wave = latin1ToString(uint8.slice(8, 12));
  if (riff !== 'RIFF' || wave !== 'WAVE') return result;

  let pos = 12;

  while (pos + 8 <= uint8.length) {
    const chunkId = latin1ToString(uint8.slice(pos, pos + 4));
    const chunkSize = readUint32LE(uint8, pos + 4);
    pos += 8;

    if (chunkId === 'fmt ') {
      const audioFormat = readUint16LE(uint8, pos);
      const numChannels = readUint16LE(uint8, pos + 2);
      const sampleRate = readUint32LE(uint8, pos + 4);
      const byteRate = readUint32LE(uint8, pos + 8);
      const bitsPerSample = readUint16LE(uint8, pos + 14);
      result.technical = {
        numChannels,
        sampleRate,
        bitsPerSample,
        bitrate: Math.round(byteRate * 8 / 1000) + ' kbps',
        audioFormat: audioFormat === 1 ? 'PCM' : audioFormat === 3 ? 'IEEE Float' : `Format ${audioFormat}`,
      };
    } else if (chunkId === 'data') {
      // Duration from data chunk
      if (result.technical.sampleRate && result.technical.numChannels && result.technical.bitsPerSample) {
        const bytesPerSample = result.technical.bitsPerSample / 8;
        const totalSamples = chunkSize / (result.technical.numChannels * bytesPerSample);
        result.technical.durationSec = totalSamples / result.technical.sampleRate;
      }
    } else if (chunkId === 'LIST') {
      const listType = latin1ToString(uint8.slice(pos, pos + 4));
      if (listType === 'INFO') {
        let infoPos = pos + 4;
        const infoEnd = pos + chunkSize;
        while (infoPos + 8 <= infoEnd) {
          const infoId = latin1ToString(uint8.slice(infoPos, infoPos + 4));
          const infoSize = readUint32LE(uint8, infoPos + 4);
          infoPos += 8;
          const infoVal = latin1ToString(uint8.slice(infoPos, infoPos + infoSize)).replace(/\0+$/, '').trim();
          const infoMap = {
            'INAM': 'TIT2', 'IART': 'TPE1', 'IPRD': 'TALB', 'ICRD': 'TDRC',
            'IGNR': 'TCON', 'ITRK': 'TRCK', 'ICMT': 'COMM', 'ISFT': 'TSSE',
          };
          if (infoMap[infoId] && infoVal) result.tags[infoMap[infoId]] = infoVal;
          infoPos += infoSize + (infoSize % 2);
        }
      }
    } else if (chunkId === 'id3 ' || chunkId === 'ID3 ') {
      const id3Data = uint8.slice(pos, pos + chunkSize);
      const { tags, coverArt } = parseID3v2(id3Data);
      Object.assign(result.tags, tags);
      if (coverArt) result.coverArt = coverArt;
    }

    pos += chunkSize + (chunkSize % 2);
    if (pos >= uint8.length) break;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAC Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseFlac(uint8) {
  /** @type {AudioFormatMetadata} */
  const result = { technical: {}, tags: {}, coverArt: null };
  if (uint8.length < 4) return result;
  if (latin1ToString(uint8.slice(0, 4)) !== 'fLaC') return result;

  let pos = 4;

  while (pos + 4 <= uint8.length) {
    const headerByte = uint8[pos];
    const isLast = (headerByte & 0x80) !== 0;
    const blockType = headerByte & 0x7F;
    const blockLen = (uint8[pos + 1] << 16) | (uint8[pos + 2] << 8) | uint8[pos + 3];
    pos += 4;

    if (pos + blockLen > uint8.length) break;

    const block = uint8.slice(pos, pos + blockLen);

    if (blockType === 0) {
      // STREAMINFO
      const sampleRate = ((block[10] << 12) | (block[11] << 4) | (block[12] >> 4));
      const numChannels = ((block[12] >> 1) & 0x7) + 1;
      const bitsPerSample = (((block[12] & 0x1) << 4) | (block[13] >> 4)) + 1;
      // Total samples (36-bit, stored in 5 bytes somewhat awkwardly)
      const totalSamplesHigh = block[13] & 0xF;
      const totalSamplesLow = readUint32BE(block, 14);
      const totalSamples = totalSamplesHigh * 4294967296 + totalSamplesLow;
      result.technical = {
        sampleRate,
        numChannels,
        bitsPerSample,
        durationSec: sampleRate > 0 ? totalSamples / sampleRate : null,
        bitrate: null, // Filled later
        audioFormat: 'FLAC (Lossless)',
      };
    } else if (blockType === 4) {
      // VORBIS_COMMENT
      let vPos = 0;
      const vendorLen = readUint32LE(block, vPos); vPos += 4;
      vPos += vendorLen;
      const commentCount = readUint32LE(block, vPos); vPos += 4;
      const td = new TextDecoder('utf-8');
      const vorbisMap = {
        'TITLE': 'TIT2', 'ARTIST': 'TPE1', 'ALBUMARTIST': 'TPE2', 'ALBUM': 'TALB',
        'DATE': 'TDRC', 'GENRE': 'TCON', 'TRACKNUMBER': 'TRCK', 'COMMENT': 'COMM',
        'COMPOSER': 'TCOM', 'DISCNUMBER': 'TPOS', 'ENCODER': 'TSSE',
      };
      for (let i = 0; i < commentCount && vPos + 4 <= block.length; i++) {
        const len = readUint32LE(block, vPos); vPos += 4;
        const comment = td.decode(block.slice(vPos, vPos + len)); vPos += len;
        const eqIdx = comment.indexOf('=');
        if (eqIdx >= 0) {
          const key = comment.slice(0, eqIdx).toUpperCase();
          const val = comment.slice(eqIdx + 1).trim();
          const mapped = vorbisMap[key] || ('VC_' + key);
          if (val) result.tags[mapped] = val;
        }
      }
    } else if (blockType === 6) {
      // PICTURE
      if (!result.coverArt) {
        try {
          let pPos = 4; // Skip picture type
          const mimeLen = readUint32BE(block, pPos); pPos += 4;
          const mimeType = latin1ToString(block.slice(pPos, pPos + mimeLen)); pPos += mimeLen;
          const descLen = readUint32BE(block, pPos); pPos += 4 + descLen;
          pPos += 16; // width, height, color depth, colors used
          const dataLen = readUint32BE(block, pPos); pPos += 4;
          const imgBytes = block.slice(pPos, pPos + dataLen);
          const b64 = btoa(String.fromCharCode(...imgBytes));
          result.coverArt = `data:${mimeType};base64,${b64}`;
        } catch { /* ignore */ }
      }
    }

    pos += blockLen;
    if (isLast) break;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// M4A / MP4 Atom Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseM4a(uint8) {
  /** @type {AudioFormatMetadata} */
  const result = { technical: {}, tags: {}, coverArt: null };

  function readString(start, len) {
    return latin1ToString(uint8.slice(start, start + len));
  }

  function parseAtoms(start, end, depth) {
    let pos = start;
    while (pos + 8 <= end) {
      let atomSize = readUint32BE(uint8, pos);
      const atomType = readString(pos + 4, 4);

      if (atomSize === 1) {
        // 64-bit size
        const high = readUint32BE(uint8, pos + 8);
        const low = readUint32BE(uint8, pos + 12);
        atomSize = high * 4294967296 + low;
      } else if (atomSize === 0) {
        atomSize = end - pos;
      }

      if (atomSize < 8 || pos + atomSize > end) break;

      const atomStart = pos + 8;
      const atomEnd = pos + atomSize;
      const atomType4 = atomType.trim();

      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst'].includes(atomType4)) {
        let childStart = atomStart;
        if (atomType4 === 'meta') childStart += 4; // version+flags
        parseAtoms(childStart, atomEnd, depth + 1);
      } else if (atomType4 === 'mvhd') {
        // Movie header - duration and timescale
        const version = uint8[atomStart];
        if (version === 0) {
          const timescale = readUint32BE(uint8, atomStart + 12);
          const duration = readUint32BE(uint8, atomStart + 16);
          result.technical.durationSec = timescale > 0 ? duration / timescale : null;
          result.technical.timescale = timescale;
        } else {
          const timescale = readUint32BE(uint8, atomStart + 20);
          const durHigh = readUint32BE(uint8, atomStart + 24);
          const durLow = readUint32BE(uint8, atomStart + 28);
          const duration = durHigh * 4294967296 + durLow;
          result.technical.durationSec = timescale > 0 ? duration / timescale : null;
        }
      } else if (atomType4 === 'mp4a' || atomType4 === 'alac') {
        // Audio sample entry: channels and sample rate
        const channels = readUint16BE(uint8, atomStart + 8);
        const sampleSize = readUint16BE(uint8, atomStart + 10);
        const sampleRate = readUint32BE(uint8, atomStart + 16) >> 16;
        result.technical.numChannels = channels;
        result.technical.bitsPerSample = sampleSize;
        result.technical.sampleRate = sampleRate;
        result.technical.audioFormat = atomType4 === 'alac' ? 'Apple Lossless (ALAC)' : 'AAC';
      } else if (atomType4 === 'ftyp') {
        const brand = readString(atomStart, 4).trim();
        result.technical.brand = brand;
      } else {
        // ilst item atoms: look for data atoms inside
        const ilstTags = {
          '\u00a9nam': 'TIT2', '\u00a9ART': 'TPE1', 'aART': 'TPE2', '\u00a9alb': 'TALB',
          '\u00a9day': 'TDRC', '\u00a9gen': 'TCON', 'trkn': 'TRCK', '\u00a9cmt': 'COMM',
          '\u00a9wrt': 'TCOM', 'disk': 'TPOS', '\u00a9too': 'TSSE', 'cprt': 'TCOP',
          '\u00a9lyr': 'USLT', 'desc': 'TIT3', 'ldes': 'COMM',
        };
        if (ilstTags[atomType4] !== undefined) {
          // Find 'data' sub-atom
          let dPos = atomStart;
          while (dPos + 8 <= atomEnd) {
            const dSize = readUint32BE(uint8, dPos);
            const dType = readString(dPos + 4, 4);
            if (dType === 'data' && dSize > 16) {
              const dataType = readUint32BE(uint8, dPos + 8);
              const payload = uint8.slice(dPos + 16, dPos + dSize);
              if (dataType === 1) {
                // UTF-8 text
                const td = new TextDecoder('utf-8');
                result.tags[ilstTags[atomType4]] = td.decode(payload).trim();
              } else if (atomType4 === 'trkn' && payload.length >= 4) {
                result.tags['TRCK'] = `${readUint16BE(payload, 2)}/${readUint16BE(payload, 4)}`.replace('/0', '');
              } else if (atomType4 === 'disk' && payload.length >= 4) {
                result.tags['TPOS'] = `${readUint16BE(payload, 2)}/${readUint16BE(payload, 4)}`.replace('/0', '');
              }
            }
            if (dSize === 0) break;
            dPos += dSize;
          }
        }

        // Cover art 'covr'
        if (atomType4 === 'covr' && !result.coverArt) {
          let dPos = atomStart;
          while (dPos + 8 <= atomEnd) {
            const dSize = readUint32BE(uint8, dPos);
            const dType = readString(dPos + 4, 4);
            if (dType === 'data' && dSize > 16) {
              const dataType = readUint32BE(uint8, dPos + 8);
              const imgBytes = uint8.slice(dPos + 16, dPos + dSize);
              const mimeType = dataType === 13 ? 'image/jpeg' : 'image/png';
              try {
                const b64 = btoa(String.fromCharCode(...imgBytes));
                result.coverArt = `data:${mimeType};base64,${b64}`;
              } catch { /* too big for btoa */ }
            }
            if (dSize === 0) break;
            dPos += dSize;
          }
        }
      }

      pos += atomSize;
    }
  }

  try {
    parseAtoms(0, uint8.length, 0);
  } catch { /* ignore parse errors */ }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lossless MP3 Metadata Stripper
// ─────────────────────────────────────────────────────────────────────────────


export { parseFlac, parseM4a, parseWav };
