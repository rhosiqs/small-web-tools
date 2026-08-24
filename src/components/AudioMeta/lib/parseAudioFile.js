import { createEphemeralId } from '../../../lib/ephemeralId.js';
import { formatBytes } from '../../../lib/mediaMetadataFormatters.js';
import { estimateMp3Duration, latin1ToString, parseID3v1, parseID3v2, readUint16BE, readUint32BE } from './id3.js';
import { parseFlac, parseM4a, parseWav } from './audioFormats.js';

async function parseAudioFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  /** @type {Record<string, any>} */
  let technical = {};
  /** @type {Record<string, any>} */
  let tags = {};
  let coverArt = null;
  let format = ext.toUpperCase();

  if (ext === 'mp3') {
    // Parse ID3v2 from start
    const id3 = parseID3v2(uint8);
    tags = { ...tags, ...id3.tags };
    if (id3.coverArt) coverArt = id3.coverArt;
    // Parse ID3v1 from end
    const id3v1 = parseID3v1(uint8);
    tags = { ...tags, ...id3v1.tags };
    // Estimate technical from MPEG frames
    const mp3tech = estimateMp3Duration(uint8, file.size);
    if (mp3tech) {
      technical = {
        durationSec: mp3tech.durationSec,
        bitrate: mp3tech.bitrate,
        sampleRate: mp3tech.sampleRate,
        numChannels: 2, // Default; proper VBR/Xing parsing would refine this
        bitsPerSample: 0,
        audioFormat: 'MP3 (MPEG Layer III)',
      };
    }
    format = 'MP3';
  } else if (ext === 'wav' || ext === 'wave') {
    const wavResult = parseWav(uint8);
    technical = wavResult.technical;
    tags = { ...tags, ...wavResult.tags };
    if (wavResult.coverArt) coverArt = wavResult.coverArt;
    format = 'WAV';
  } else if (ext === 'flac') {
    const flacResult = parseFlac(uint8);
    technical = flacResult.technical;
    tags = { ...tags, ...flacResult.tags };
    if (flacResult.coverArt) coverArt = flacResult.coverArt;
    if (technical.durationSec && file.size > 0) {
      const audioBitrate = Math.round((file.size * 8) / technical.durationSec / 1000);
      technical.bitrate = audioBitrate + ' kbps';
    }
    format = 'FLAC';
  } else if (['m4a', 'aac', 'm4b', 'm4p', 'mp4'].includes(ext)) {
    const m4aResult = parseM4a(uint8);
    technical = m4aResult.technical;
    tags = { ...tags, ...m4aResult.tags };
    if (m4aResult.coverArt) coverArt = m4aResult.coverArt;
    if (technical.durationSec && file.size > 0) {
      const audioBitrate = Math.round((file.size * 8) / technical.durationSec / 1000);
      technical.bitrate = audioBitrate + ' kbps';
    }
    format = ext.toUpperCase();
  } else if (ext === 'ogg' || ext === 'oga' || ext === 'opus') {
    // OGG: Try to find Vorbis comment block via simple scan
    format = ext === 'opus' ? 'Opus' : 'OGG Vorbis';
    // OGG is complex to parse fully; use HTML5 for duration
  } else if (ext === 'aiff' || ext === 'aif') {
    format = 'AIFF';
    // AIFF is similar to RIFF, parse COMM and NAME/AUTH chunks
    if (latin1ToString(uint8.slice(0, 4)) === 'FORM') {
      const fileType = latin1ToString(uint8.slice(8, 12));
      if (fileType === 'AIFF' || fileType === 'AIFC') {
        let pos = 12;
        while (pos + 8 <= uint8.length) {
          const chunkId = latin1ToString(uint8.slice(pos, pos + 4));
          const chunkSize = readUint32BE(uint8, pos + 4);
          pos += 8;
          if (chunkId === 'COMM') {
            technical.numChannels = readUint16BE(uint8, pos);
            const numSampleFrames = readUint32BE(uint8, pos + 2);
            technical.bitsPerSample = readUint16BE(uint8, pos + 6);
            // 80-bit extended sampleRate (IEEE 754)
            const exp = ((readUint16BE(uint8, pos + 8) & 0x7FFF) - 16383);
            const mantHigh = readUint32BE(uint8, pos + 10);
            technical.sampleRate = Math.round(mantHigh * Math.pow(2, exp - 31));
            if (technical.sampleRate > 0) {
              technical.durationSec = numSampleFrames / technical.sampleRate;
              technical.bitrate = Math.round(technical.sampleRate * technical.numChannels * technical.bitsPerSample / 1000) + ' kbps';
            }
            technical.audioFormat = fileType === 'AIFC' ? 'AIFF-C (Compressed)' : 'AIFF (Uncompressed)';
          } else if (chunkId === 'ID3 ' || chunkId === 'id3 ') {
            const id3Data = uint8.slice(pos, pos + chunkSize);
            const id3Result = parseID3v2(id3Data);
            Object.assign(tags, id3Result.tags);
            if (id3Result.coverArt) coverArt = id3Result.coverArt;
          } else if (chunkId === 'NAME') {
            tags['TIT2'] = tags['TIT2'] || latin1ToString(uint8.slice(pos, pos + chunkSize)).replace(/\0+$/, '').trim();
          } else if (chunkId === 'AUTH') {
            tags['TPE1'] = tags['TPE1'] || latin1ToString(uint8.slice(pos, pos + chunkSize)).replace(/\0+$/, '').trim();
          } else if (chunkId === 'ANNO') {
            tags['COMM'] = tags['COMM'] || latin1ToString(uint8.slice(pos, pos + chunkSize)).replace(/\0+$/, '').trim();
          }
          pos += chunkSize + (chunkSize % 2);
          if (pos >= uint8.length) break;
        }
      }
    }
  } else if (ext === 'wma' || ext === 'asf') {
    format = 'WMA/ASF';
    // WMA/ASF has a complex binary structure; basic detection only
  } else {
    // Try ID3v2 as fallback for unknown types
    const id3 = parseID3v2(uint8);
    if (Object.keys(id3.tags).length > 0) {
      tags = id3.tags;
      if (id3.coverArt) coverArt = id3.coverArt;
    }
  }

  // Use HTML5 Audio element as fallback for duration if not parsed
  const durationFromAudio = await getAudioDuration(file);
  if (!technical.durationSec && durationFromAudio) {
    technical.durationSec = durationFromAudio;
  }

  return {
    id: createEphemeralId('audio'),
    name: file.name,
    size: file.size,
    formattedSize: formatBytes(file.size),
    format,
    ext,
    technical,
    tags,
    coverArt,
    arrayBuffer,
    objectUrl: null, // Created lazily for audio preview
    strippedInfo: null,
  };
}

async function getAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    let timeoutId;
    const finish = (duration) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      finish(isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => finish(null);
    audio.src = url;
    timeoutId = setTimeout(() => finish(null), 5000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag display name mapping
// ─────────────────────────────────────────────────────────────────────────────


export { getAudioDuration, parseAudioFile };
