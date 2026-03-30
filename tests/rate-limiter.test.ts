import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimiter } from '../src/policies/rate-limiter';
import { RateLimitExceededError } from '../src/types';

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within the token limit', async () => {
    const rl = rateLimiter({ tokensPerInterval: 3, interval: 1000 });

    const r1 = await rl.execute(() => Promise.resolve(1));
    const r2 = await rl.execute(() => Promise.resolve(2));
    const r3 = await rl.execute(() => Promise.resolve(3));

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(r3).toBe(3);
  });

  it('should reject when rejectOnLimit is true and tokens exhausted', async () => {
    const rl = rateLimiter({ tokensPerInterval: 1, interval: 1000, rejectOnLimit: true });

    await rl.execute(() => Promise.resolve('ok'));
    await expect(rl.execute(() => Promise.resolve('ok'))).rejects.toThrow(RateLimitExceededError);
  });

  it('should queue when rejectOnLimit is false and tokens exhausted', async () => {
    const rl = rateLimiter({ tokensPerInterval: 1, interval: 1000, rejectOnLimit: false });

    const r1 = rl.execute(() => Promise.resolve(1));
    const r2 = rl.execute(() => Promise.resolve(2));

    // r1 should resolve immediately
    expect(await r1).toBe(1);

    // r2 is queued — advance time to refill
    await vi.advanceTimersByTimeAsync(1100);
    expect(await r2).toBe(2);
  });

  it('should refill tokens over time', async () => {
    const rl = rateLimiter({ tokensPerInterval: 2, interval: 1000 });

    // Use all tokens
    await rl.execute(() => Promise.resolve(1));
    await rl.execute(() => Promise.resolve(2));

    expect(rl.handle.availableTokens).toBe(0);

    // Advance time and check refill
    vi.advanceTimersByTime(1000);
    expect(rl.handle.availableTokens).toBe(2);
  });

  it('should not exceed max tokens on refill', async () => {
    const rl = rateLimiter({ tokensPerInterval: 3, interval: 1000 });

    // Don't use any tokens, just advance time
    vi.advanceTimersByTime(5000);
    expect(rl.handle.availableTokens).toBe(3); // capped at max
  });

  it('should handle reset', async () => {
    const rl = rateLimiter({ tokensPerInterval: 2, interval: 1000 });

    await rl.execute(() => Promise.resolve(1));
    await rl.execute(() => Promise.resolve(2));
    expect(rl.handle.availableTokens).toBe(0);

    rl.handle.reset();
    expect(rl.handle.availableTokens).toBe(2);
  });

  it('should release waiters when reset is called', async () => {
    const rl = rateLimiter({ tokensPerInterval: 1, interval: 1000, rejectOnLimit: false });

    await rl.execute(() => Promise.resolve(1)); // use the token

    const p2 = rl.execute(() => Promise.resolve(2)); // queued

    // Reset should release the waiter
    rl.handle.reset();

    // Need to tick for the microtask queue
    await vi.advanceTimersByTimeAsync(10);
    expect(await p2).toBe(2);
  });

  it('should use defaults when no options provided', async () => {
    const rl = rateLimiter();
    const result = await rl.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('should throw on invalid tokensPerInterval', () => {
    expect(() => rateLimiter({ tokensPerInterval: 0 })).toThrow(RangeError);
    expect(() => rateLimiter({ tokensPerInterval: -1 })).toThrow(RangeError);
    expect(() => rateLimiter({ tokensPerInterval: 1.5 })).toThrow(RangeError);
  });

  it('should throw on invalid interval', () => {
    expect(() => rateLimiter({ interval: 0 })).toThrow(RangeError);
    expect(() => rateLimiter({ interval: -100 })).toThrow(RangeError);
  });

  it('should handle multiple queued requests', async () => {
    const rl = rateLimiter({ tokensPerInterval: 1, interval: 500, rejectOnLimit: false });
    const results: number[] = [];

    await rl.execute(() => Promise.resolve(1).then(v => { results.push(v); return v; })); // immediate

    const p2 = rl.execute(() => Promise.resolve(2).then(v => { results.push(v); return v; })); // queued
    const p3 = rl.execute(() => Promise.resolve(3).then(v => { results.push(v); return v; })); // queued

    // advance enough for both to process
    await vi.advanceTimersByTimeAsync(2000);

    await Promise.all([p2, p3]);
    expect(results).toContain(1);
    expect(results).toContain(2);
    expect(results).toContain(3);
  });
});
