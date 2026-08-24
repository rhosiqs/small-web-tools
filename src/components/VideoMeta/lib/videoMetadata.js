import { createEphemeralId } from '../../../lib/ephemeralId';
import { formatBytes } from '../../../lib/mediaMetadataFormatters';

/**
 * @typedef {Object} ParsedTrack
 * @property {string | null} type
 * @property {string | null} handlerType
 * @property {string} handlerName
 * @property {string | null} codec
 * @property {string | null} codecFourCC
 * @property {number | null} width
 * @property {number | null} height
 * @property {number | null} sampleRate
 * @property {number | null} channels
 * @property {number | null} bitsPerSample
 * @property {number | null} timescale
 * @property {number | null} duration
 * @property {number | null} sampleCount
 * @property {number | null} colorPrimaries
 * @property {number | null} transferCharacteristics
 * @property {number | null} matrixCoefficients
 * @property {boolean | null} fullRange
 * @property {string | null} colorInfo
 * @property {number | null} timecodeFlags
 * @property {number | null} timecodeFrameDuration
 * @property {number | null} timecodeTimescale
 * @property {number | null} timecodeNumFrames
 * @property {number | null} timecodeStartFrame
 * @property {string | null} language
 * @property {number | null} bitDepth
 * @property {string | null} compressorName
 */

/**
 * @typedef {Object} ParsedMp4
 * @property {string | null} brand
 * @property {string[]} compatibleBrands
 * @property {number | null} duration
 * @property {number | null} timescale
 * @property {number | null} creationTime
 * @property {ParsedTrack[]} tracks
 * @property {Record<string, string>} metadata
 */

/**
 * @typedef {Object} ParsedMediaRecord
 * @property {string} id
 * @property {string} name
 * @property {number} size
 * @property {string} formattedSize
 * @property {string} ext
 * @property {string} format
 * @property {string} type
 * @property {ParsedTrack[]} videoTracks
 * @property {ParsedTrack[]} audioTracks
 * @property {ParsedTrack[]} subtitleTracks
 * @property {ParsedTrack[]} timecodeTracks
 * @property {ParsedTrack[]} otherTracks
 * @property {string | null} brand
 * @property {string[]} compatibleBrands
 * @property {number | null} containerDuration
 * @property {number | null} containerTimescale
 * @property {number | null} creationTime
 * @property {Record<string, string>} metadata
 * @property {Record<string, string> | null} logParams
 * @property {string | null} logRawText
 * @property {string | null} thumbnailUrl
 * @property {string | null} objectUrl
 * @property {File} file
 */

function readUint32BE(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readUint16BE(buf, offset) {
  return ((buf[offset] << 8) | buf[offset + 1]) >>> 0;
}

function latin1ToString(bytes) {
  return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ITU-T H.273 Color parameter mappings
// ─────────────────────────────────────────────────────────────────────────────

export const COLOR_PRIMARIES = {
  1: 'BT.709 (sRGB)', 2: 'Unspecified', 4: 'BT.470M', 5: 'BT.601 (PAL)',
  6: 'BT.601 (NTSC)', 7: 'SMPTE 240M', 8: 'Generic Film', 9: 'BT.2020',
  10: 'SMPTE ST 428', 11: 'SMPTE RP 431', 12: 'Display P3 (D65)', 22: 'EBU Tech 3213-E',
};

export const TRANSFER_CHARACTERISTICS = {
  1: 'BT.709 (SDR)', 2: 'Unspecified', 4: 'BT.470M (Gamma 2.2)', 5: 'BT.470BG (Gamma 2.8)',
  6: 'BT.601 (SDR)', 7: 'SMPTE 240M', 8: 'Linear', 9: 'Log (100:1)', 10: 'Log (316:1)',
  11: 'IEC 61966-2-4', 13: 'IEC 61966-2-1 (sRGB)', 14: 'BT.2020 (10-bit)',
  15: 'BT.2020 (12-bit)', 16: 'SMPTE ST 2084 (PQ / HDR10)', 17: 'SMPTE ST 428',
  18: 'ARIB STD-B67 (HLG)',
};

export const MATRIX_COEFFICIENTS = {
  0: 'Identity (RGB)', 1: 'BT.709', 2: 'Unspecified', 4: 'FCC', 5: 'BT.601 (PAL)',
  6: 'BT.601 (NTSC)', 7: 'SMPTE 240M', 8: 'YCgCo', 9: 'BT.2020 (NCL)',
  10: 'BT.2020 (CL)', 11: 'SMPTE ST 2085', 14: 'ICtCp (BT.2100)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Codec FourCC mapping
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO_CODEC_MAP = {
  'avc1': 'H.264 (AVC)', 'avc2': 'H.264 (AVC)', 'avc3': 'H.264 (AVC)', 'avc4': 'H.264 (AVC)',
  'hev1': 'H.265 (HEVC)', 'hvc1': 'H.265 (HEVC)',
  'vp08': 'VP8', 'vp09': 'VP9', 'av01': 'AV1', 'mp4v': 'MPEG-4 Part 2', 's263': 'H.263',
  'dvhe': 'Dolby Vision HEVC', 'dvh1': 'Dolby Vision HEVC',
  'dva1': 'Dolby Vision AVC', 'dvav': 'Dolby Vision AVC',
  'ap4h': 'Apple ProRes 4444', 'ap4x': 'Apple ProRes 4444 XQ',
  'apch': 'Apple ProRes 422 HQ', 'apcn': 'Apple ProRes 422',
  'apcs': 'Apple ProRes 422 LT', 'apco': 'Apple ProRes 422 Proxy',
  'aprh': 'Apple ProRes RAW HQ', 'aprn': 'Apple ProRes RAW',
};

export const AUDIO_CODEC_MAP = {
  'mp4a': 'AAC', 'ac-3': 'Dolby Digital (AC-3)', 'ec-3': 'Dolby Digital Plus (E-AC-3)',
  'alac': 'Apple Lossless (ALAC)', 'fLaC': 'FLAC', 'Opus': 'Opus', 'vorbis': 'Vorbis',
  'lpcm': 'Linear PCM', 'sowt': 'PCM (Little-Endian)', 'twos': 'PCM (Big-Endian)',
  'alaw': 'A-law PCM', 'ulaw': '\u00b5-law PCM',
  'dtsc': 'DTS Core', 'dtse': 'DTS-HD LBR', 'dtsh': 'DTS-HD', 'dtsl': 'DTS-HD Lossless',
};

const SUBTITLE_HANDLER_TYPES = ['sbtl', 'text', 'subt', 'clcp', 'subp'];

export const getAudioExtension = (codecFourCC, codecName) => {
  const codecc = (codecFourCC || '').toLowerCase();
  const name = (codecName || '').toLowerCase();
  if (codecc === 'mp4a' || name.includes('aac')) return 'm4a';
  if (codecc === 'ac-3' || name.includes('ac-3') || name.includes('dolby digital')) return 'ac3';
  if (codecc === 'ec-3' || name.includes('e-ac-3')) return 'eac3';
  if (codecc === 'flac' || name.includes('flac')) return 'flac';
  if (codecc === 'opus' || name.includes('opus')) return 'opus';
  if (codecc === 'vorbis' || name.includes('vorbis')) return 'ogg';
  if (codecc === 'mp3' || name.includes('mp3')) return 'mp3';
  if (codecc === 'alac' || name.includes('alac')) return 'm4a';
  return 'mka';
};

// ─────────────────────────────────────────────────────────────────────────────
// SMPTE Timecode conversion
// ─────────────────────────────────────────────────────────────────────────────

export function frameCountToTimecode(frameCount, fps, isDropFrame) {
  if (!fps || fps <= 0) return null;
  const roundedFps = Math.round(fps);
  const pad = (n) => n.toString().padStart(2, '0');

  if (isDropFrame && (roundedFps === 30 || roundedFps === 60)) {
    const dropFrames = roundedFps === 60 ? 4 : 2;
    const framesPerMinute = roundedFps * 60 - dropFrames;
    const framesPerTenMinutes = framesPerMinute * 10 + dropFrames;
    const d = Math.floor(frameCount / framesPerTenMinutes);
    let m = frameCount % framesPerTenMinutes;
    let adj = frameCount;
    if (m >= dropFrames) {
      adj += (18 * d) + (dropFrames * Math.floor((m - dropFrames) / framesPerMinute));
    } else {
      adj += 18 * d;
    }
    return `${pad(Math.floor(adj / (roundedFps * 3600)) % 24)}:${pad(Math.floor(adj / (roundedFps * 60)) % 60)}:${pad(Math.floor(adj / roundedFps) % 60)};${pad(adj % roundedFps)}`;
  }

  return `${pad(Math.floor(frameCount / (roundedFps * 3600)) % 24)}:${pad(Math.floor(frameCount / (roundedFps * 60)) % 60)}:${pad(Math.floor(frameCount / roundedFps) % 60)}:${pad(frameCount % roundedFps)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MP4/MOV Parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseMP4(uint8) {
  /** @type {ParsedMp4} */
  const result = { brand: null, compatibleBrands: [], duration: null, timescale: null, creationTime: null, tracks: [], metadata: {} };

  function rs(start, len) { return latin1ToString(uint8.slice(start, start + len)); }

  const CONTAINER_ATOMS = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta', 'ilst', 'edts'];
  /** @type {ParsedTrack | null} */
  let currentTrack = null;
  /** @type {ParsedTrack[]} */
  const trackStack = [];

  function parseAtoms(start, end) {
    let pos = start;
    while (pos + 8 <= end) {
      let atomSize = readUint32BE(uint8, pos);
      const atomType = rs(pos + 4, 4).trim();
      let headerSize = 8;
      if (atomSize === 1 && pos + 16 <= end) {
        atomSize = readUint32BE(uint8, pos + 8) * 4294967296 + readUint32BE(uint8, pos + 12);
        headerSize = 16;
      } else if (atomSize === 0) { atomSize = end - pos; }
      if (atomSize < 8 || pos + atomSize > end) break;
      try { handleAtom(atomType, pos + headerSize, pos + atomSize); } catch { /* skip */ }
      pos += atomSize;
    }
  }

  function handleAtom(type, start, end) {
    if (type === 'ftyp') {
      result.brand = rs(start, 4).trim();
      const brands = [];
      for (let i = start + 8; i + 4 <= end; i += 4) { const b = rs(i, 4).trim(); if (b) brands.push(b); }
      result.compatibleBrands = brands;
    }
    if (type === 'mvhd') {
      const v = uint8[start];
      if (v === 0) {
        result.creationTime = readUint32BE(uint8, start + 4);
        result.timescale = readUint32BE(uint8, start + 12);
        result.duration = result.timescale > 0 ? readUint32BE(uint8, start + 16) / result.timescale : null;
      } else {
        result.timescale = readUint32BE(uint8, start + 20);
        const dur = readUint32BE(uint8, start + 24) * 4294967296 + readUint32BE(uint8, start + 28);
        result.duration = result.timescale > 0 ? dur / result.timescale : null;
      }
    }
    if (type === 'trak') {
      currentTrack = { type: null, handlerType: null, handlerName: '', codec: null, codecFourCC: null, width: null, height: null, sampleRate: null, channels: null, bitsPerSample: null, timescale: null, duration: null, sampleCount: null, colorPrimaries: null, transferCharacteristics: null, matrixCoefficients: null, fullRange: null, colorInfo: null, timecodeFlags: null, timecodeFrameDuration: null, timecodeTimescale: null, timecodeNumFrames: null, timecodeStartFrame: null, language: null, bitDepth: null, compressorName: null };
      trackStack.push(currentTrack);
      parseAtoms(start, end);
      result.tracks.push(currentTrack);
      trackStack.pop();
      currentTrack = trackStack.length > 0 ? trackStack[trackStack.length - 1] : null;
      return;
    }
    if (type === 'hdlr' && currentTrack) {
      const ht = rs(start + 8, 4).trim();
      currentTrack.handlerType = ht;
      const ns = start + 24;
      if (ns < end) { let ne = ns; while (ne < end && uint8[ne] !== 0) ne++; if (ne > ns) currentTrack.handlerName = rs(ns, ne - ns); }
      if (ht === 'vide') currentTrack.type = 'video';
      else if (ht === 'soun') currentTrack.type = 'audio';
      else if (ht === 'tmcd') currentTrack.type = 'timecode';
      else if (SUBTITLE_HANDLER_TYPES.includes(ht)) currentTrack.type = 'subtitle';
      else currentTrack.type = 'other';
    }
    if (type === 'mdhd' && currentTrack) {
      const v = uint8[start];
      if (v === 0) {
        currentTrack.timescale = readUint32BE(uint8, start + 12);
        const dur = readUint32BE(uint8, start + 16);
        currentTrack.duration = currentTrack.timescale > 0 ? dur / currentTrack.timescale : null;
        const lc = readUint16BE(uint8, start + 20);
        if (lc > 0) currentTrack.language = String.fromCharCode(((lc >> 10) & 0x1F) + 0x60, ((lc >> 5) & 0x1F) + 0x60, (lc & 0x1F) + 0x60);
      } else {
        currentTrack.timescale = readUint32BE(uint8, start + 20);
        const dur = readUint32BE(uint8, start + 24) * 4294967296 + readUint32BE(uint8, start + 28);
        currentTrack.duration = currentTrack.timescale > 0 ? dur / currentTrack.timescale : null;
        const lc = readUint16BE(uint8, start + 32);
        if (lc > 0) currentTrack.language = String.fromCharCode(((lc >> 10) & 0x1F) + 0x60, ((lc >> 5) & 0x1F) + 0x60, (lc & 0x1F) + 0x60);
      }
    }
    if (type === 'stsd' && currentTrack) {
      let ePos = start + 8;
      const eCount = readUint32BE(uint8, start + 4);
      for (let i = 0; i < eCount && ePos + 8 <= end; i++) {
        const eSize = readUint32BE(uint8, ePos);
        const eType = rs(ePos + 4, 4).trim();
        const eEnd = ePos + eSize;
        if (eSize < 8 || eEnd > end) break;
        if (currentTrack.type === 'video') {
          currentTrack.codecFourCC = eType;
          currentTrack.codec = VIDEO_CODEC_MAP[eType] || eType;
          if (eSize >= 78) {
            const bo = ePos + 8;
            currentTrack.width = readUint16BE(uint8, bo + 24);
            currentTrack.height = readUint16BE(uint8, bo + 26);
            const cl = uint8[bo + 42];
            if (cl > 0 && cl <= 31) currentTrack.compressorName = rs(bo + 43, cl).trim();
            currentTrack.bitDepth = readUint16BE(uint8, bo + 74);
          }
          const cs = ePos + 86;
          if (cs < eEnd) scanChildBoxes(cs, eEnd);
        } else if (currentTrack.type === 'audio') {
          currentTrack.codecFourCC = eType;
          currentTrack.codec = AUDIO_CODEC_MAP[eType] || eType;
          if (eSize >= 36) {
            const bo = ePos + 8;
            currentTrack.channels = readUint16BE(uint8, bo + 16);
            currentTrack.bitsPerSample = readUint16BE(uint8, bo + 18);
            currentTrack.sampleRate = readUint32BE(uint8, bo + 24) >>> 16;
          }
        } else if (currentTrack.type === 'timecode') {
          if (eSize >= 34) {
            const bo = ePos + 8;
            currentTrack.timecodeFlags = readUint32BE(uint8, bo + 12);
            currentTrack.timecodeTimescale = readUint32BE(uint8, bo + 16);
            currentTrack.timecodeFrameDuration = readUint32BE(uint8, bo + 20);
            currentTrack.timecodeNumFrames = uint8[bo + 24];
          }
        } else if (currentTrack.type === 'subtitle') {
          currentTrack.codecFourCC = eType;
          currentTrack.codec = eType === 'tx3g' ? 'MPEG-4 Timed Text' : eType === 'c608' ? 'CEA-608' : eType === 'c708' ? 'CEA-708' : eType === 'wvtt' ? 'WebVTT' : eType === 'stpp' ? 'TTML' : eType;
        }
        ePos += eSize;
      }
    }
    if (type === 'stsz' && currentTrack) { currentTrack.sampleCount = readUint32BE(uint8, start + 8); }
    if (type === 'stco' && currentTrack && currentTrack.type === 'timecode') {
      const cnt = readUint32BE(uint8, start + 4);
      if (cnt > 0) { const off = readUint32BE(uint8, start + 8); if (off + 4 <= uint8.length) currentTrack.timecodeStartFrame = readUint32BE(uint8, off); }
    }
    if (type === 'co64' && currentTrack && currentTrack.type === 'timecode') {
      const cnt = readUint32BE(uint8, start + 4);
      if (cnt > 0) { const off = readUint32BE(uint8, start + 8) * 4294967296 + readUint32BE(uint8, start + 12); if (off + 4 <= uint8.length) currentTrack.timecodeStartFrame = readUint32BE(uint8, off); }
    }
    // ilst metadata
    const tagMap = { '\u00a9nam': 'Title', '\u00a9ART': 'Artist', '\u00a9alb': 'Album', '\u00a9day': 'Year', '\u00a9gen': 'Genre', '\u00a9cmt': 'Comment', '\u00a9too': 'Encoder', 'cprt': 'Copyright', 'desc': 'Description', '\u00a9wrt': 'Composer', '\u00a9lyr': 'Lyrics' };
    if (tagMap[type] !== undefined) {
      let dPos = start;
      while (dPos + 8 <= end) {
        const dSize = readUint32BE(uint8, dPos); const dType = rs(dPos + 4, 4);
        if (dType === 'data' && dSize > 16) {
          const dt = readUint32BE(uint8, dPos + 8);
          if (dt === 1) { const td = new TextDecoder('utf-8'); result.metadata[tagMap[type]] = td.decode(uint8.slice(dPos + 16, dPos + dSize)).trim(); }
        }
        if (dSize === 0) break; dPos += dSize;
      }
    }
    if (CONTAINER_ATOMS.includes(type) && type !== 'trak') {
      let cs = start; if (type === 'meta') cs += 4;
      parseAtoms(cs, end);
    }
  }

  function scanChildBoxes(start, end) {
    let pos = start;
    while (pos + 8 <= end) {
      const sz = readUint32BE(uint8, pos); const tp = rs(pos + 4, 4).trim();
      if (sz < 8 || pos + sz > end) break;
      if (tp === 'colr' && currentTrack) {
        const ct = rs(pos + 8, 4).trim();
        if ((ct === 'nclx' || ct === 'nclc') && sz >= 18) {
          currentTrack.colorPrimaries = readUint16BE(uint8, pos + 12);
          currentTrack.transferCharacteristics = readUint16BE(uint8, pos + 14);
          currentTrack.matrixCoefficients = readUint16BE(uint8, pos + 16);
          if (ct === 'nclx' && sz >= 19) currentTrack.fullRange = (uint8[pos + 18] & 0x80) !== 0;
          currentTrack.colorInfo = ct;
        }
      }
      pos += sz;
    }
  }

  try { parseAtoms(0, uint8.length); } catch { /* skip */ }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log File Parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseLogFile(text) {
  const lines = text.split(/\r?\n/);
  /** @type {Record<string, string>} */
  const params = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const match = trimmed.match(/^([^:=\t]+)\s*[:=\t]\s*(.+)$/);
    if (match) { const key = match[1].trim(); const val = match[2].trim(); if (key && val) params[key] = val; }
  }
  return { params, rawText: text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Master file parser dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export async function parseMediaFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  /** @type {ParsedMediaRecord} */
  const fr = {
    id: createEphemeralId('video'),
    name: file.name, size: file.size, formattedSize: formatBytes(file.size), ext, format: ext.toUpperCase(), type: 'video',
    videoTracks: [], audioTracks: [], subtitleTracks: [], timecodeTracks: [], otherTracks: [],
    brand: null, compatibleBrands: [], containerDuration: null, containerTimescale: null, creationTime: null, metadata: {},
    logParams: null, logRawText: null, thumbnailUrl: null, objectUrl: null, file,
  };

  if (['log', 'txt'].includes(ext)) {
    fr.type = 'log'; fr.format = ext.toUpperCase();
    const text = new TextDecoder('utf-8').decode(uint8);
    const lr = parseLogFile(text); fr.logParams = lr.params; fr.logRawText = lr.rawText;
    return fr;
  }

  if (['mp4', 'mov', 'm4v', 'f4v', '3gp', '3g2'].includes(ext)) {
    const r = parseMP4(uint8);
    fr.brand = r.brand; fr.compatibleBrands = r.compatibleBrands; fr.containerDuration = r.duration;
    fr.containerTimescale = r.timescale; fr.creationTime = r.creationTime; fr.metadata = r.metadata;
    for (const t of r.tracks) {
      if (t.type === 'video') fr.videoTracks.push(t);
      else if (t.type === 'audio') fr.audioTracks.push(t);
      else if (t.type === 'subtitle') fr.subtitleTracks.push(t);
      else if (t.type === 'timecode') fr.timecodeTracks.push(t);
      else if (t.type === 'other') fr.otherTracks.push(t);
    }
    if (ext === 'mov') fr.format = 'MOV';
    else if (ext === 'm4v') fr.format = 'M4V';
    else if (ext === '3gp' || ext === '3g2') fr.format = ext.toUpperCase();
    else fr.format = 'MP4';
  } else if (['avi', 'mkv', 'webm', 'wmv', 'flv', 'ts', 'mts', 'm2ts', 'mxf'].includes(ext)) {
    fr.format = ext.toUpperCase(); fr.type = 'video';
  } else {
    // Try ftyp detection
    if (uint8.length >= 12 && latin1ToString(uint8.slice(4, 8)) === 'ftyp') {
      const r = parseMP4(uint8);
      fr.brand = r.brand; fr.compatibleBrands = r.compatibleBrands; fr.containerDuration = r.duration; fr.metadata = r.metadata;
      for (const t of r.tracks) {
        if (t.type === 'video') fr.videoTracks.push(t);
        else if (t.type === 'audio') fr.audioTracks.push(t);
        else if (t.type === 'subtitle') fr.subtitleTracks.push(t);
        else if (t.type === 'timecode') fr.timecodeTracks.push(t);
      }
    }
  }

  if (fr.type === 'video') {
    const hi = await getVideoInfo(file);
    if (hi) {
      if (!fr.containerDuration && hi.duration) fr.containerDuration = hi.duration;
      if (hi.videoWidth && fr.videoTracks.length > 0 && !fr.videoTracks[0].width) { fr.videoTracks[0].width = hi.videoWidth; fr.videoTracks[0].height = hi.videoHeight; }
      fr.thumbnailUrl = hi.thumbnail;
    }
  }
  return fr;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML5 Video info extraction (duration + thumbnail)
// ─────────────────────────────────────────────────────────────────────────────

export async function getVideoInfo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata'; video.muted = true;
    let resolved = false;

    video.onloadeddata = () => { video.currentTime = Math.min(1, video.duration * 0.1); };

    video.onseeked = () => {
      if (resolved) return; resolved = true;
      let thumbnail = null;
      try {
        const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
        thumbnail = c.toDataURL('image/jpeg', 0.7);
      } catch { /* skip */ }
      URL.revokeObjectURL(url);
      resolve({ duration: isFinite(video.duration) ? video.duration : null, videoWidth: video.videoWidth || null, videoHeight: video.videoHeight || null, thumbnail });
    };

    video.onerror = () => { if (resolved) return; resolved = true; URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
        resolve({ duration: isFinite(video.duration) ? video.duration : null, videoWidth: video.videoWidth || null, videoHeight: video.videoHeight || null, thumbnail: null });
      }
    }, 8000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Thumbnail Placeholder
// ─────────────────────────────────────────────────────────────────────────────
