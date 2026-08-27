import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enforceRateLimit,
  resetDevelopmentRateLimits,
} from '../../functions/_shared/rateLimit.js';
import { createRateLimiterWorker } from '../../workers/rate-limiter/src/index.js';

const secret = 'test-secret-with-at-least-32-characters';
const request = new Request('https://tools.example/api/iplookup', {
  headers: { 'CF-Connecting-IP': '203.0.113.99' },
});

beforeEach(() => resetDevelopmentRateLimits());

describe('Pages rate-limiter client', () => {
  it('ignores a client-supplied X-Forwarded-For and fails closed off the edge', async () => {
    const fetch = vi.fn(async () => Response.json({ allowed: true }));
    const spoofed = new Request('https://tools.example/api/iplookup', {
      headers: { 'X-Forwarded-For': '198.51.100.7' },
    });
    const response = await enforceRateLimit({
      request: spoofed,
      env: { RATE_LIMIT_HMAC_SECRET: secret, RATE_LIMITER_SERVICE: { fetch } },
    }, { name: 'iplookup', limit: 60 });

    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('derives the bucket from CF-Connecting-IP even when X-Forwarded-For disagrees', async () => {
    const keys = [];
    const fetch = vi.fn(async (serviceRequest) => {
      keys.push((await serviceRequest.json()).clientKey);
      return Response.json({ allowed: true });
    });
    const env = { RATE_LIMIT_HMAC_SECRET: secret, RATE_LIMITER_SERVICE: { fetch } };
    const options = { name: 'iplookup', limit: 60, now: () => 1_800_000_000_000 };

    for (const forwarded of ['198.51.100.1', '198.51.100.2']) {
      await enforceRateLimit({
        request: new Request('https://tools.example/api/iplookup', {
          headers: { 'CF-Connecting-IP': '203.0.113.99', 'X-Forwarded-For': forwarded },
        }),
        env,
      }, options);
    }

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('allows and denies according to the service response without forwarding the raw IP', async () => {
    const fetch = vi.fn(async () => Response.json({ allowed: false }));
    const result = await enforceRateLimit({
      request,
      env: {
        RATE_LIMIT_HMAC_SECRET: secret,
        RATE_LIMITER_SERVICE: { fetch },
      },
    }, { name: 'iplookup', limit: 60, now: () => 1_800_000_000_000 });
    expect(result.status).toBe(429);
    expect(await result.json()).toMatchObject({ code: 'RATE_LIMITED' });
    expect(result.headers.get('Retry-After')).toBe('60');
    expect(await fetch.mock.calls[0][0].text()).not.toContain('203.0.113.99');
  });

  it('fails closed when the service or HMAC secret is unavailable', async () => {
    for (const env of [
      { RATE_LIMIT_HMAC_SECRET: secret },
      { RATE_LIMITER_SERVICE: { fetch: vi.fn() } },
      {
        RATE_LIMIT_HMAC_SECRET: secret,
        RATE_LIMITER_SERVICE: { fetch: vi.fn(async () => new Response(null, { status: 503 })) },
      },
    ]) {
      const response = await enforceRateLimit({ request, env }, { name: 'iplookup', limit: 60 });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
    }
  });

  it('uses in-memory fallback only behind the explicit development flag', async () => {
    const env = {
      RATE_LIMIT_HMAC_SECRET: secret,
      RATE_LIMIT_DEVELOPMENT_MODE: 'true',
    };
    expect(await enforceRateLimit({ request, env }, {
      name: 'extract-fonts', limit: 1, now: () => 1_800_000_000_000,
    })).toBeNull();
    for (let requestNumber = 2; requestNumber <= 20; requestNumber += 1) {
      expect(await enforceRateLimit({ request, env }, {
        name: 'extract-fonts', limit: 1, now: () => 1_800_000_000_000,
      })).toBeNull();
    }
    const denied = await enforceRateLimit({ request, env }, {
      name: 'extract-fonts', limit: 1, now: () => 1_800_000_000_000,
    });
    expect(denied.status).toBe(429);
  });
});

describe('rate-limiter Worker', () => {
  it('selects the route policy and returns its atomic decision', async () => {
    const expensive = { limit: vi.fn(async () => ({ success: true })) };
    const standard = { limit: vi.fn(async () => ({ success: false })) };
    const worker = createRateLimiterWorker();
    const response = await worker.fetch(new Request('https://internal/limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'exchange-rates', clientKey: 'a'.repeat(64) }),
    }), {
      EXPENSIVE_LIMITER: expensive,
      STANDARD_LIMITER: standard,
    });
    expect(await response.json()).toMatchObject({ allowed: false });
    expect(standard.limit).toHaveBeenCalledWith({ key: `exchange-rates:${'a'.repeat(64)}` });
    expect(expensive.limit).not.toHaveBeenCalled();
  });
});
