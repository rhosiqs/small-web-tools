export function attachAudioPreviewUrl(parsedFile, sourceFile, createObjectUrl) {
  const previewBlob = new Blob(
    [parsedFile.arrayBuffer],
    { type: sourceFile.type || 'application/octet-stream' },
  );
  return { ...parsedFile, objectUrl: createObjectUrl(previewBlob) };
}

export function revokeAudioFileUrls(fileRecord, revokeObjectUrl) {
  if (!fileRecord) return;
  if (fileRecord.objectUrl) revokeObjectUrl(fileRecord.objectUrl);
  if (fileRecord.strippedInfo?.url) revokeObjectUrl(fileRecord.strippedInfo.url);
}

export function createReplacementAudioUrl(previousUrl, blob, createObjectUrl, revokeObjectUrl) {
  if (previousUrl) revokeObjectUrl(previousUrl);
  return createObjectUrl(blob);
}
