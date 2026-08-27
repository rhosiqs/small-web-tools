// Centralized Resource Limits Configuration

export const RESOURCE_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 100 * 1024 * 1024,   // 100 MB
  MAX_DOC_SIZE_BYTES: 100 * 1024 * 1024,     // 100 MB
  MAX_MEDIA_SIZE_BYTES: 500 * 1024 * 1024,   // 500 MB
  MAX_QR_IMAGE_BYTES: 25 * 1024 * 1024,      // 25 MB
  MAX_FOLDER_FILES_COUNT: 1000,
  MAX_BATCH_FILES_COUNT: 100,
  MAX_ZIP_ENTRIES_COUNT: 1000,
  MAX_UNCOMPRESSED_ZIP_BYTES: 512 * 1024 * 1024, // 512 MB
  MAX_ZIP_COMPRESSION_RATIO: 100,
  MAX_REMOTE_RESPONSE_BYTES: 10 * 1024 * 1024,
  REMOTE_REQUEST_TIMEOUT_MS: 8000,
};

const MIB = 1024 * 1024;

export const FILE_RESOURCE_POLICIES = Object.freeze({
  imageMetadata: Object.freeze({
    label: 'images',
    maxFileBytes: 100 * MIB,
    maxTotalBytes: 300 * MIB,
    maxCount: 100,
  }),
  audioMetadata: Object.freeze({
    label: 'audio files',
    maxFileBytes: 100 * MIB,
    maxTotalBytes: 300 * MIB,
    maxCount: 100,
  }),
  videoMetadata: Object.freeze({
    label: 'video files',
    maxFileBytes: 200 * MIB,
    maxTotalBytes: 300 * MIB,
    maxCount: 50,
  }),
  documentMetadata: Object.freeze({
    label: 'documents',
    maxFileBytes: 100 * MIB,
    maxTotalBytes: 300 * MIB,
    maxCount: 100,
  }),
  folderAnalysis: Object.freeze({
    label: 'folder files',
    maxFileBytes: 25 * MIB,
    maxTotalBytes: 512 * MIB,
    maxCount: 1000,
  }),
});

export function getMediaSeparatorPolicy(deviceMemory) {
  const reportedMemory = Number(deviceMemory);
  const maxTotalBytes = Number.isFinite(reportedMemory)
    ? (reportedMemory <= 4 ? 100 : 200) * MIB
    : 150 * MIB;
  return {
    label: 'media queue',
    maxFileBytes: Math.min(200 * MIB, maxTotalBytes),
    maxTotalBytes,
    maxCount: 10,
    maxQueueSize: 10,
  };
}

function fileSize(item) {
  const size = Number(item?.size ?? item?.file?.size ?? item?.originalFile?.size);
  return Number.isFinite(size) && size >= 0 ? size : 0;
}

/**
 * Validate a complete existing + incoming selection before callers read any file.
 * This is intentionally all-or-nothing so rejected files cannot consume resources.
 */
export function validateResourceAddition(existingItems, incomingFiles, policy) {
  const existing = Array.from(existingItems || []);
  const incoming = Array.from(incomingFiles || []);
  const label = policy?.label || 'files';
  const combinedCount = existing.length + incoming.length;
  const maxCount = Math.min(
    Number.isFinite(policy?.maxCount) ? policy.maxCount : Infinity,
    Number.isFinite(policy?.maxQueueSize) ? policy.maxQueueSize : Infinity,
  );

  if (combinedCount > maxCount) {
    return {
      valid: false,
      error: `Adding ${incoming.length} ${label} would exceed the limit of ${maxCount} (currently ${existing.length}).`,
      reason: 'count',
    };
  }

  const oversized = incoming.find((file) => fileSize(file) > policy.maxFileBytes);
  if (oversized) {
    return {
      valid: false,
      error: `${oversized.name || 'File'} exceeds the per-file limit of ${formatBytes(policy.maxFileBytes)}.`,
      reason: 'file-size',
    };
  }

  const existingBytes = existing.reduce((total, item) => total + fileSize(item), 0);
  const incomingBytes = incoming.reduce((total, item) => total + fileSize(item), 0);
  if (existingBytes + incomingBytes > policy.maxTotalBytes) {
    return {
      valid: false,
      error: `Adding ${formatBytes(incomingBytes)} would exceed the ${label} total limit of ${formatBytes(policy.maxTotalBytes)} (currently ${formatBytes(existingBytes)}).`,
      reason: 'total-size',
    };
  }

  return {
    valid: true,
    error: null,
    reason: null,
    existingBytes,
    incomingBytes,
    totalBytes: existingBytes + incomingBytes,
    totalCount: combinedCount,
  };
}

export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function validateFileSize(file, maxBytes, category = 'File') {
  if (!file) return { valid: false, error: 'No file provided' };
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `${category} "${file.name}" exceeds maximum allowed size of ${formatBytes(maxBytes)} (File size: ${formatBytes(file.size)}).`
    };
  }
  return { valid: true, error: null };
}

export function validateBatchCount(files, maxCount, category = 'files') {
  if (!files) return { valid: true, error: null };
  const count = typeof files.length === 'number' ? files.length : files.size || 0;
  if (count > maxCount) {
    return {
      valid: false,
      error: `Number of selected ${category} (${count}) exceeds maximum batch limit of ${maxCount}.`
    };
  }
  return { valid: true, error: null };
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const UINT32_SENTINEL = 0xffffffff;
const UINT16_SENTINEL = 0xffff;

/**
 * Locate the End Of Central Directory record by scanning backwards from the end
 * of the archive. The comment length is bounded by the ZIP format, so the search
 * window is bounded too. Scanning forward for a central-directory signature is
 * unsafe: an attacker can embed that signature inside stored entry data and steer
 * the guard away from the directory the ZIP reader actually uses.
 */
function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - (EOCD_MIN_SIZE + MAX_ZIP_COMMENT_BYTES));
  for (let offset = view.byteLength - EOCD_MIN_SIZE; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + EOCD_MIN_SIZE + commentLength === view.byteLength) return offset;
  }
  return -1;
}

function readZip64Locator(view, eocdOffset) {
  const locatorOffset = eocdOffset - 20;
  if (locatorOffset < 0 || view.getUint32(locatorOffset, true) !== ZIP64_LOCATOR_SIGNATURE) return null;
  const zip64Offset = Number(view.getBigUint64(locatorOffset + 8, true));
  if (!Number.isSafeInteger(zip64Offset) || zip64Offset < 0 || zip64Offset + 56 > view.byteLength) return null;
  if (view.getUint32(zip64Offset, true) !== ZIP64_EOCD_SIGNATURE) return null;
  return {
    entries: Number(view.getBigUint64(zip64Offset + 32, true)),
    directorySize: Number(view.getBigUint64(zip64Offset + 40, true)),
    directoryOffset: Number(view.getBigUint64(zip64Offset + 48, true)),
  };
}

/**
 * ZIP64 entries store 0xffffffff placeholders in the fixed header and the real
 * sizes in the 0x0001 extra field, ordered uncompressed then compressed.
 */
function readZip64EntrySizes(view, extraStart, extraLength, uncompressed, compressed) {
  let sizes = { uncompressed, compressed };
  let cursor = extraStart;
  const extraEnd = extraStart + extraLength;
  while (cursor + 4 <= extraEnd) {
    const headerId = view.getUint16(cursor, true);
    const dataSize = view.getUint16(cursor + 2, true);
    const dataStart = cursor + 4;
    if (dataStart + dataSize > extraEnd) break;
    if (headerId === 0x0001) {
      let fieldCursor = dataStart;
      if (uncompressed === UINT32_SENTINEL && fieldCursor + 8 <= dataStart + dataSize) {
        sizes = { ...sizes, uncompressed: Number(view.getBigUint64(fieldCursor, true)) };
        fieldCursor += 8;
      }
      if (compressed === UINT32_SENTINEL && fieldCursor + 8 <= dataStart + dataSize) {
        sizes = { ...sizes, compressed: Number(view.getBigUint64(fieldCursor, true)) };
      }
      break;
    }
    cursor = dataStart + dataSize;
  }
  return sizes;
}

function emptySummary(malformed) {
  return {
    entries: 0,
    totalCompressedBytes: 0,
    totalUncompressedBytes: 0,
    compressionRatio: 0,
    malformed,
  };
}

/**
 * Summarize a ZIP archive from its authoritative central directory without
 * decompressing any entry.
 */
export function inspectZipCentralDirectory(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < EOCD_MIN_SIZE) return emptySummary('missing-end-of-central-directory');

  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) return emptySummary('missing-end-of-central-directory');

  let declaredEntries = view.getUint16(eocdOffset + 10, true);
  let directorySize = view.getUint32(eocdOffset + 12, true);
  let directoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    declaredEntries === UINT16_SENTINEL
    || directorySize === UINT32_SENTINEL
    || directoryOffset === UINT32_SENTINEL
  ) {
    const zip64 = readZip64Locator(view, eocdOffset);
    if (!zip64) return emptySummary('unreadable-zip64-central-directory');
    declaredEntries = zip64.entries;
    directorySize = zip64.directorySize;
    directoryOffset = zip64.directoryOffset;
  }

  const directoryEnd = directoryOffset + directorySize;
  if (
    !Number.isSafeInteger(declaredEntries)
    || !Number.isSafeInteger(directoryOffset)
    || !Number.isSafeInteger(directorySize)
    || directoryOffset < 0
    || directorySize < 0
    || directoryEnd > view.byteLength
  ) {
    return emptySummary('central-directory-out-of-bounds');
  }

  let entries = 0;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;
  let offset = directoryOffset;

  while (entries < declaredEntries) {
    if (offset + 46 > directoryEnd) return emptySummary('truncated-central-directory');
    if (view.getUint32(offset, true) !== CENTRAL_FILE_SIGNATURE) {
      return emptySummary('invalid-central-directory-entry');
    }
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const next = offset + 46 + fileNameLength + extraLength + commentLength;
    if (next > directoryEnd) return emptySummary('truncated-central-directory');

    const sizes = readZip64EntrySizes(
      view,
      offset + 46 + fileNameLength,
      extraLength,
      view.getUint32(offset + 24, true),
      view.getUint32(offset + 20, true),
    );
    entries += 1;
    totalCompressedBytes += sizes.compressed;
    totalUncompressedBytes += sizes.uncompressed;
    offset = next;
  }

  return {
    entries,
    totalCompressedBytes,
    totalUncompressedBytes,
    compressionRatio: totalUncompressedBytes / Math.max(1, totalCompressedBytes),
    malformed: null,
  };
}

export function validateZipSummary(summary, limits = RESOURCE_LIMITS) {
  if (summary.malformed) {
    return { valid: false, error: 'Archive central directory could not be read (' + summary.malformed + ').' };
  }
  if (summary.entries > limits.MAX_ZIP_ENTRIES_COUNT) {
    return { valid: false, error: `Archive contains more than ${limits.MAX_ZIP_ENTRIES_COUNT} entries.` };
  }
  if (summary.totalUncompressedBytes > limits.MAX_UNCOMPRESSED_ZIP_BYTES) {
    return { valid: false, error: `Archive expands beyond ${formatBytes(limits.MAX_UNCOMPRESSED_ZIP_BYTES)}.` };
  }
  if (summary.compressionRatio > limits.MAX_ZIP_COMPRESSION_RATIO) {
    return { valid: false, error: `Archive compression ratio exceeds ${limits.MAX_ZIP_COMPRESSION_RATIO}:1.` };
  }
  return { valid: true, error: null };
}

export async function validateZipArchive(file, limits = RESOURCE_LIMITS) {
  const summary = inspectZipCentralDirectory(await file.arrayBuffer());
  return { ...validateZipSummary(summary, limits), summary };
}

/**
 * Read one archive entry while enforcing the limit against bytes actually
 * produced by the inflater. The central-directory summary only proves what an
 * archive *declares*; a crafted entry can declare a small size and still expand
 * without bound, so streamed output is metered and aborted on overflow.
 */
export function readZipEntryText(entry, maxBytes = RESOURCE_LIMITS.MAX_UNCOMPRESSED_ZIP_BYTES) {
  if (!entry) return Promise.resolve('');
  if (typeof entry.internalStream !== 'function') return entry.async('string');

  return new Promise((resolve, reject) => {
    const stream = entry.internalStream('string');
    const parts = [];
    let total = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    stream
      .on('data', (chunk) => {
        if (settled) return;
        total += chunk.length;
        if (total > maxBytes) {
          stream.pause();
          finish(reject, new Error(`Archive entry expands beyond ${formatBytes(maxBytes)}.`));
          return;
        }
        parts.push(chunk);
      })
      .on('error', (error) => finish(reject, error))
      .on('end', () => finish(resolve, parts.join('')))
      .resume();
  });
}
