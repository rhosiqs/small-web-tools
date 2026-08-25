import { describe, it, expect, vi } from 'vitest';
import {
  isPrivateHost,
  safeExternalFetch,
  validateTargetUrl,
} from '../../functions/_shared/safeExternalFetch.js';

describe('isPrivateHost', () => {
  it('blocks empty/null hostname', () => {
    expect(isPrivateHost('')).toBe(true);
    expect(isPrivateHost(null)).toBe(true);
  });

  it('blocks localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });

  it('blocks .local domains', () => {
    expect(isPrivateHost('myserver.local')).toBe(true);
  });

  it('blocks loopback 127.0.0.1', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
  });

  it('blocks 10.x.x.x private range', () => {
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('10.255.255.255')).toBe(true);
  });

  it('blocks 172.16-31.x.x private range', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.31.255.255')).toBe(true);
  });

  it('does not block 172.15.x.x (public)', () => {
    expect(isPrivateHost('172.15.0.1')).toBe(false);
  });

  it('blocks 192.168.x.x private range', () => {
    expect(isPrivateHost('192.168.1.1')).toBe(true);
  });

  it('blocks 169.254.x.x link-local (AWS metadata)', () => {
    expect(isPrivateHost('169.254.169.254')).toBe(true);
  });

  it('blocks carrier-grade NAT, benchmark, documentation, and multicast ranges', () => {
    expect(isPrivateHost('100.64.0.1')).toBe(true);
    expect(isPrivateHost('198.18.0.1')).toBe(true);
    expect(isPrivateHost('203.0.113.10')).toBe(true);
    expect(isPrivateHost('224.0.0.1')).toBe(true);
  });

  it('blocks IPv6 loopback ::1', () => {
    expect(isPrivateHost('::1')).toBe(true);
  });

  it('blocks IPv6 private, link-local, documentation, and mapped loopback addresses', () => {
    expect(isPrivateHost('fd00::1')).toBe(true);
    expect(isPrivateHost('fe80::1')).toBe(true);
    expect(isPrivateHost('2001:db8::1')).toBe(true);
    expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateHost('::ffff:7f00:1')).toBe(true);
  });

  it('blocks reserved IPv6 addresses written in full, uncompressed form', () => {
    expect(isPrivateHost('0000:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
    expect(isPrivateHost('0000:0000:0000:0000:0000:0000:0000:0000')).toBe(true);
    expect(isPrivateHost('fe80:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
    expect(isPrivateHost('fd00:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
    expect(isPrivateHost('0:0:0:0:0:ffff:7f00:1')).toBe(true);
  });

  it('blocks IPv6 transition and special-purpose ranges', () => {
    expect(isPrivateHost('64:ff9b::7f00:1')).toBe(true);
    expect(isPrivateHost('2001:0:5ef5:79fd::1')).toBe(true);
    expect(isPrivateHost('100::1')).toBe(true);
  });

  it('allows public IPv6 unicast addresses', () => {
    expect(isPrivateHost('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateHost('2001:4860:4860::8888')).toBe(false);
  });

  it('allows public IP addresses', () => {
    expect(isPrivateHost('1.1.1.1')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('104.18.0.1')).toBe(false);
  });

  it('allows public domain names', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('fonts.googleapis.com')).toBe(false);
  });
});

describe('safeExternalFetch', () => {
  const publicResolver = vi.fn(async () => ['93.184.216.34']);

  it('rejects a public hostname that resolves to a private address', async () => {
    await expect(safeExternalFetch('https://example.com', {
      resolveHostname: async () => ['127.0.0.1'],
      fetchImpl: vi.fn(),
    })).rejects.toThrow('resolves to a private');
  });

  it('revalidates DNS after every redirect', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { Location: 'https://cdn.example.com/font.css' },
      }))
      .mockResolvedValueOnce(new Response('body', {
        status: 200,
        headers: { 'Content-Type': 'text/css' },
      }));
    const resolver = vi.fn(async (hostname) => (
      hostname === 'cdn.example.com' ? ['10.0.0.5'] : ['93.184.216.34']
    ));

    await expect(safeExternalFetch('https://example.com', {
      fetchImpl,
      resolveHostname: resolver,
    })).rejects.toThrow('resolves to a private');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('enforces response MIME and streamed byte limits', async () => {
    const htmlResponse = new Response('<html></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
    await expect(safeExternalFetch('https://example.com/file.css', {
      fetchImpl: vi.fn(async () => htmlResponse),
      resolveHostname: publicResolver,
      allowedContentTypes: ['text/css'],
    })).rejects.toThrow('Unexpected response Content-Type');

    const largeResponse = new Response(new Uint8Array(5));
    await expect(safeExternalFetch('https://example.com/file', {
      fetchImpl: vi.fn(async () => largeResponse),
      resolveHostname: publicResolver,
      maxBytes: 4,
    })).rejects.toThrow('Response size exceeds limit');
  });

  it('uses one absolute deadline across redirects and body reading', async () => {
    const fetchImpl = vi.fn(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return new Response(null, {
        status: 302,
        headers: { Location: new URL('/next', url).href },
      });
    });
    await expect(safeExternalFetch('https://example.com/start', {
      fetchImpl,
      resolveHostname: publicResolver,
      timeoutMs: 25,
      maxRedirects: 5,
    })).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
    expect(fetchImpl.mock.calls.length).toBeLessThan(6);
  });

  it('rejects mixed public and private DNS answers', async () => {
    await expect(safeExternalFetch('https://example.com', {
      fetchImpl: vi.fn(),
      resolveHostname: async () => ['93.184.216.34', 'fd00::1'],
    })).rejects.toThrow('resolves to a private');
  });

  it('honors caller cancellation during a hanging resolver', async () => {
    const controller = new AbortController();
    const running = safeExternalFetch('https://example.com', {
      fetchImpl: vi.fn(),
      resolveHostname: () => new Promise(() => {}),
      signal: controller.signal,
      timeoutMs: 5000,
    });
    controller.abort();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('validateTargetUrl', () => {
  it('throws on invalid URL', () => {
    expect(() => validateTargetUrl('not-a-url')).toThrow('Invalid URL format');
  });

  it('throws on non-http/https protocol', () => {
    expect(() => validateTargetUrl('ftp://example.com')).toThrow('Only HTTP and HTTPS');
  });

  it('throws on URL with credentials', () => {
    expect(() => validateTargetUrl('https://user:pass@example.com')).toThrow('credentials');
  });

  it('throws on non-standard port', () => {
    expect(() => validateTargetUrl('https://example.com:8080/path')).toThrow('ports are allowed');
  });

  it('throws on private IP', () => {
    expect(() => validateTargetUrl('https://192.168.1.1/api')).toThrow('internal');
  });

  it.each([
    'https://2130706433/',
    'https://0x7f000001/',
    'https://127.1/',
    'https://[::ffff:127.0.0.1]/',
    'http://metadata.google.internal/',
    'http://instance-data/',
  ])('rejects ambiguous numeric or metadata target %s', (target) => {
    expect(() => validateTargetUrl(target)).toThrow();
  });

  it('allows valid public HTTPS URL', () => {
    const parsed = validateTargetUrl('https://fonts.googleapis.com/css2?family=Inter');
    expect(parsed.hostname).toBe('fonts.googleapis.com');
  });

  it('allows standard port 443 explicitly', () => {
    const parsed = validateTargetUrl('https://example.com:443/path');
    expect(parsed.hostname).toBe('example.com');
  });

  it('allows standard port 80 explicitly', () => {
    const parsed = validateTargetUrl('http://example.com:80/path');
    expect(parsed.hostname).toBe('example.com');
  });
});
