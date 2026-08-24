function readUint32BE(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readUint32LE(buf, offset) {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readUint16LE(buf, offset) {
  return (buf[offset] | (buf[offset + 1] << 8)) >>> 0;
}

function readUint16BE(buf, offset) {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0;
}

// Read syncsafe integer (ID3v2)
function readSyncsafeInt(buf, offset) {
  return ((buf[offset] & 0x7f) << 21) |
         ((buf[offset + 1] & 0x7f) << 14) |
         ((buf[offset + 2] & 0x7f) << 7) |
         (buf[offset + 3] & 0x7f);
}

function latin1ToString(bytes) {
  return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
}



function decodeTextFrame(encoding, data) {
  try {
    if (encoding === 0) {
      // ISO-8859-1 / Latin-1 (windows-1252 is a compatible superset)
      const td = new TextDecoder('windows-1252');
      return td.decode(data).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM (detected automatically by TextDecoder)
      const td = new TextDecoder('utf-16');
      return td.decode(data).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      const td = new TextDecoder('utf-16be');
      return td.decode(data).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      const td = new TextDecoder('utf-8');
      return td.decode(data).replace(/\0+$/, '').trim();
    }
    return new TextDecoder('utf-8').decode(data).replace(/\0+$/, '').trim();
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ID3v2 Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseID3v2(uint8) {
  const tags = {};
  let coverArt = null;

  if (uint8.length < 10) return { tags, coverArt };

  // Scan first 1024 bytes for 'ID3' identifier to handle prepended junk/headers
  let startOffset = -1;
  const scanLimit = Math.min(uint8.length - 10, 1024);
  for (let i = 0; i < scanLimit; i++) {
    if (uint8[i] === 0x49 && uint8[i+1] === 0x44 && uint8[i+2] === 0x33) {
      startOffset = i;
      break;
    }
  }

  if (startOffset === -1) return { tags, coverArt };

  const majorVersion = uint8[startOffset + 3];
  // const minorVersion = uint8[startOffset + 4];
  const flags = uint8[startOffset + 5];
  const hasExtHeader = (flags & 0x40) !== 0;
  let tagSize = ((uint8[startOffset + 6] & 0x7f) << 21) |
                 ((uint8[startOffset + 7] & 0x7f) << 14) |
                 ((uint8[startOffset + 8] & 0x7f) << 7) |
                 (uint8[startOffset + 9] & 0x7f);
  let pos = startOffset + 10;

  if (hasExtHeader) {
    if (majorVersion === 4) {
      const extSize = ((uint8[pos] & 0x7f) << 21) |
                      ((uint8[pos + 1] & 0x7f) << 14) |
                      ((uint8[pos + 2] & 0x7f) << 7) |
                      (uint8[pos + 3] & 0x7f);
      pos += extSize;
    } else {
      const extSize = ((uint8[pos] << 24) | (uint8[pos + 1] << 16) | (uint8[pos + 2] << 8) | uint8[pos + 3]) >>> 0;
      pos += 4 + extSize;
    }
  }

  const end = Math.min(startOffset + 10 + tagSize, uint8.length);

  while (pos < end - 10) {
    let frameId, frameSize;

    if (majorVersion === 2) {
      // ID3v2.2 has 3-char IDs and 3-byte sizes
      frameId = latin1ToString(uint8.slice(pos, pos + 3));
      if (frameId === '\0\0\0') break;
      frameSize = (uint8[pos + 3] << 16) | (uint8[pos + 4] << 8) | uint8[pos + 5];
      pos += 6;
    } else {
      frameId = latin1ToString(uint8.slice(pos, pos + 4));
      if (frameId === '\0\0\0\0') break;
      frameSize = (majorVersion === 4)
        ? readSyncsafeInt(uint8, pos + 4)
        : readUint32BE(uint8, pos + 4);
      pos += 10;
    }

    if (frameSize <= 0 || pos + frameSize > end) break;

    const frameData = uint8.slice(pos, pos + frameSize);
    pos += frameSize;

    const encoding = frameData[0];
    const textData = frameData.slice(1);

    // Text frames
    if (frameId[0] === 'T' && frameId !== 'TXX' && frameId !== 'TXXX') {
      const text = decodeTextFrame(encoding, textData);
      if (text) tags[frameId] = text;
    }

    // ID3v2.2 picture frame PIC
    if (frameId === 'PIC' && !coverArt) {
      try {
        // 3-char image format
        const imgFmt = latin1ToString(frameData.slice(1, 4)).toLowerCase();
        const mimeType = imgFmt === 'jpg' || imgFmt === 'jpeg' ? 'image/jpeg' : `image/${imgFmt}`;
        // pictureType
        let dataStart = 5;
        // Skip description
        const descEnd = frameData.indexOf(0, dataStart);
        dataStart = descEnd >= 0 ? descEnd + 1 : dataStart;
        const imgBytes = frameData.slice(dataStart);
        if (imgBytes.length > 0) {
          const b64 = btoa(String.fromCharCode(...imgBytes));
          coverArt = `data:${mimeType};base64,${b64}`;
        }
      } catch { /* ignore */ }
    }

    // APIC picture frame (ID3v2.3+)
    if (frameId === 'APIC' && !coverArt) {
      try {
        const picEncoding = frameData[0];
        let dataPos = 1;
        // Read MIME type (null-terminated Latin-1)
        const mimeEnd = frameData.indexOf(0, dataPos);
        const mimeType = mimeEnd > dataPos
          ? latin1ToString(frameData.slice(dataPos, mimeEnd))
          : 'image/jpeg';
        dataPos = mimeEnd + 1;
        // Picture type byte
        dataPos += 1;
        // Description (null-terminated, encoding-dependent)
        if (picEncoding === 1 || picEncoding === 2) {
          // UTF-16: find null word
          while (dataPos + 1 < frameData.length) {
            if (frameData[dataPos] === 0 && frameData[dataPos + 1] === 0) { dataPos += 2; break; }
            dataPos += 2;
          }
        } else {
          const descEnd2 = frameData.indexOf(0, dataPos);
          dataPos = descEnd2 >= 0 ? descEnd2 + 1 : dataPos;
        }
        const imgBytes = frameData.slice(dataPos);
        if (imgBytes.length > 0) {
          const b64 = btoa(String.fromCharCode(...imgBytes));
          coverArt = `data:${mimeType};base64,${b64}`;
        }
      } catch { /* ignore */ }
    }

    // COMM comment frame
    if ((frameId === 'COMM' || frameId === 'COM') && !tags['COMM']) {
      try {
        const commEnc = frameData[0];
        // 3 lang bytes + description + null + text
        const langAndDesc = frameData.slice(4);
        const nullIdx = langAndDesc.indexOf(0);
        const textPart = nullIdx >= 0 ? langAndDesc.slice(nullIdx + 1) : langAndDesc;
        const text = decodeTextFrame(commEnc, textPart);
        if (text) tags['COMM'] = text;
      } catch { /* ignore */ }
    }
  }

  return { tags, coverArt };
}

// ─────────────────────────────────────────────────────────────────────────────
// ID3v1 Parser (last 128 bytes)
// ─────────────────────────────────────────────────────────────────────────────

function parseID3v1(uint8) {
  const tags = {};
  if (uint8.length < 128) return { tags, hasV1: false };
  const tail = uint8.slice(uint8.length - 128);
  if (tail[0] !== 0x54 || tail[1] !== 0x41 || tail[2] !== 0x47) return { tags, hasV1: false };

  const readFixed = (start, len) =>
    latin1ToString(tail.slice(start, start + len)).replace(/\0+$/, '').trim();

  tags['TIT2'] = tags['TIT2'] || readFixed(3, 30);
  tags['TPE1'] = tags['TPE1'] || readFixed(33, 30);
  tags['TALB'] = tags['TALB'] || readFixed(63, 30);
  tags['TDRC'] = tags['TDRC'] || readFixed(93, 4);
  tags['COMM'] = tags['COMM'] || readFixed(97, 28);
  // ID3v1.1 track number
  if (tail[125] === 0 && tail[126] !== 0) {
    tags['TRCK'] = tags['TRCK'] || String(tail[126]);
  }

  const GENRES = [
    'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz','Metal',
    'New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno','Industrial',
    'Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient','Trip-Hop',
    'Vocal','Jazz+Funk','Fusion','Trance','Classical','Instrumental','Acid','House','Game',
    'Sound Clip','Gospel','Noise','AlternRock','Bass','Soul','Punk','Space','Meditative',
    'Instrumental Pop','Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial',
    'Electronic','Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta',
    'Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave',
    'Psychedelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz',
    'Polka','Retro','Musical','Rock & Roll','Hard Rock'
  ];
  const genreIdx = tail[127];
  if (genreIdx < GENRES.length) tags['TCON'] = tags['TCON'] || GENRES[genreIdx];

  return { tags, hasV1: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MP3 Duration Estimator (scans for first valid MPEG frame header)
// ─────────────────────────────────────────────────────────────────────────────

function estimateMp3Duration(uint8, fileSizeBytes) {
  const BITRATES = [
    null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, null
  ];
  const SAMPLE_RATES = [44100, 48000, 32000];

  let offset = 0;
  const maxScan = Math.min(uint8.length, 200000);

  while (offset < maxScan - 4) {
    if (uint8[offset] === 0xFF && (uint8[offset + 1] & 0xE0) === 0xE0) {
      const header = readUint32BE(uint8, offset);
      const version = (header >> 19) & 0x3;  // 3=MPEG1, 2=MPEG2
      const layer = (header >> 17) & 0x3;    // 3=Layer1, 2=Layer2, 1=Layer3
      const bitrateIdx = (header >> 12) & 0xF;
      const sampleRateIdx = (header >> 10) & 0x3;

      if (layer === 1 && version !== 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
        const bitrate = BITRATES[bitrateIdx];
        const sampleRate = SAMPLE_RATES[sampleRateIdx] / (version === 2 ? 2 : 1);
        if (bitrate && sampleRate) {
          const id3v1Size = uint8[uint8.length - 128] === 0x54 && uint8[uint8.length - 127] === 0x41 && uint8[uint8.length - 126] === 0x47 ? 128 : 0;
          const audioDataSize = fileSizeBytes - offset - id3v1Size;
          return {
            durationSec: (audioDataSize * 8) / (bitrate * 1000),
            bitrate: bitrate + ' kbps',
            sampleRate: sampleRate,
          };
        }
      }
    }
    offset++;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAV / RIFF Parser
// ─────────────────────────────────────────────────────────────────────────────


export {
  decodeTextFrame,
  estimateMp3Duration,
  latin1ToString,
  parseID3v1,
  parseID3v2,
  readSyncsafeInt,
  readUint16BE,
  readUint16LE,
  readUint32BE,
  readUint32LE,
};
