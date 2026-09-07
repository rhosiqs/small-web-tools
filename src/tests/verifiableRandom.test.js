import { describe, expect, it } from 'vitest';
import {
  createDrawRecord,
  createShuffleRecord,
  deriveShuffleOrder,
  selectUnbiasedIndexFromValues,
  selectWinnerIndex,
  SHUFFLE_ALGORITHM_VERSION,
  verifyDrawRecord,
  verifyShuffleRecord,
  WHEEL_ALGORITHM_VERSION,
} from '../lib/verifiableRandom.js';

const SEED_A = '00'.repeat(32);
const SEED_B = '01'.repeat(32);

describe('verifiable wheel randomness', () => {
  it('is deterministic for a fixed seed and list', async () => {
    const first = await selectWinnerIndex(SEED_A, 7);
    const second = await selectWinnerIndex(SEED_A, 7);
    expect(second).toBe(first);
    expect(await selectWinnerIndex(SEED_B, 7)).not.toBe(first);
  });

  it('handles one and zero items explicitly', async () => {
    await expect(selectWinnerIndex(SEED_A, 1)).resolves.toBe(0);
    await expect(selectWinnerIndex(SEED_A, 0)).rejects.toThrow('At least one');
  });

  it('rejects out-of-range uint32 values before applying modulo', () => {
    expect(selectUnbiasedIndexFromValues(10, [0xffff_ffff, 24])).toBe(4);
    expect(() => selectUnbiasedIndexFromValues(0, [1])).toThrow('At least one');
  });

  it('creates and verifies a versioned immutable list snapshot', async () => {
    const record = await createDrawRecord(['Alice', 'Alice', 'Bob'], {
      seed: SEED_A,
      timestamp: '2026-07-22T00:00:00.000Z',
    });
    expect(record.algorithm).toBe(WHEEL_ALGORITHM_VERSION);
    expect(record.items).toEqual(['Alice', 'Alice', 'Bob']);
    await expect(verifyDrawRecord(record)).resolves.toMatchObject({ valid: true });

    record.items[0] = 'Mallory';
    await expect(verifyDrawRecord(record)).resolves.toMatchObject({ valid: false });
  });
});

describe('verifiable shuffle randomness', () => {
  it('is deterministic for a fixed seed and separates seeds and domains', async () => {
    const first = await deriveShuffleOrder(SEED_A, 12);
    expect(await deriveShuffleOrder(SEED_A, 12)).toEqual(first);
    expect(await deriveShuffleOrder(SEED_B, 12)).not.toEqual(first);
    // The wheel domain must not leak its winner into the shuffle's first draw.
    expect(first).not.toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  it('returns a complete permutation of every position', async () => {
    const order = await deriveShuffleOrder(SEED_B, 40);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, index) => index));
  });

  it('handles one and zero items explicitly', async () => {
    await expect(deriveShuffleOrder(SEED_A, 1)).resolves.toEqual([0]);
    await expect(deriveShuffleOrder(SEED_A, 0)).rejects.toThrow('At least one');
  });

  it('creates and verifies a versioned snapshot of the drawn order', async () => {
    const record = await createShuffleRecord(['Alice', 'Bob', 'Chen', 'Dara'], {
      seed: SEED_A,
      timestamp: '2026-07-22T00:00:00.000Z',
    });
    expect(record.algorithm).toBe(SHUFFLE_ALGORITHM_VERSION);
    expect(record.result).toEqual(record.order.map((index) => record.items[index]));
    expect([...record.result].sort()).toEqual(['Alice', 'Bob', 'Chen', 'Dara']);
    await expect(verifyShuffleRecord(record)).resolves.toMatchObject({ valid: true });
  });

  it('rejects a tampered order, a tampered list, and an unknown algorithm', async () => {
    const record = await createShuffleRecord(['Alice', 'Bob', 'Chen'], { seed: SEED_B });
    const reordered = { ...record, order: [...record.order].reverse() };
    await expect(verifyShuffleRecord(reordered)).resolves.toMatchObject({ valid: false });

    const renamed = { ...record, items: ['Mallory', 'Bob', 'Chen'] };
    await expect(verifyShuffleRecord(renamed)).resolves.toMatchObject({ valid: false });

    await expect(verifyShuffleRecord({ ...record, algorithm: 'other' }))
      .resolves.toMatchObject({ valid: false, error: 'Unsupported algorithm version' });
    await expect(verifyShuffleRecord({ ...record, seed: 'not-a-seed' }))
      .resolves.toMatchObject({ valid: false });
  });

  it('refuses an empty or blank entry list', async () => {
    await expect(createShuffleRecord([])).rejects.toThrow('At least one');
    await expect(createShuffleRecord(['Alice', '  '])).rejects.toThrow('cannot be blank');
  });
});
