import ipaddr from 'ipaddr.js';

export function parseIpInput(value, { allowEmpty = true } = {}) {
  const input = String(value ?? '').trim();
  if (!input) {
    return allowEmpty
      ? { value: '', kind: null, error: null, errorCode: null }
      : { value: null, kind: null, error: 'IP address is required', errorCode: 'required' };
  }
  if (
    input.length > 45
    || /[/\s?#%]/u.test(input)
    || Array.from(input).some((character) => character.charCodeAt(0) < 0x20)
  ) {
    return { value: null, kind: null, error: 'Invalid IP address syntax', errorCode: 'invalidSyntax' };
  }

  try {
    const address = ipaddr.parse(input);
    return {
      value: address.toString(),
      kind: address.kind(),
      error: null,
      errorCode: null,
    };
  } catch {
    return { value: null, kind: null, error: 'Invalid IPv4 or IPv6 address', errorCode: 'invalidAddress' };
  }
}
