export const PUBLIC_ERRORS = Object.freeze({
  VALIDATION_FAILED: 'The request could not be validated.',
  CONSENT_REQUIRED: 'Permission is required before contacting this service.',
  RATE_LIMITED: 'Too many requests. Please wait and try again.',
  RATE_LIMIT_UNAVAILABLE: 'Request protection is temporarily unavailable.',
  FEATURE_UNAVAILABLE: 'This feature is temporarily unavailable.',
  UPSTREAM_TIMEOUT: 'The external service did not respond in time.',
  BLOCKED_TARGET: 'That network target is not allowed.',
  PROVIDER_UNAVAILABLE: 'The external provider is temporarily unavailable.',
  UPSTREAM_REJECTED: 'The website refused the request or returned an error.',
  UNSUPPORTED_CONTENT: 'The address did not return a supported page.',
  PROCESSING_FAILED: 'Processing failed. Check the input and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
});

export function getPublicError(code) {
  const safeCode = Object.hasOwn(PUBLIC_ERRORS, code) ? code : 'INTERNAL_ERROR';
  return { code: safeCode, message: PUBLIC_ERRORS[safeCode] };
}

export function toPublicProcessingError(error, development = false) {
  const publicError = getPublicError('PROCESSING_FAILED');
  return {
    ...publicError,
    developmentDetail: development
      ? String(error?.stack || error?.message || error || '')
      : null,
  };
}
