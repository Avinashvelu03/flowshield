import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cache } from '../src/policies/cache';

describe('cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should cache the result and return it on subsequent calls', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const c = cache({ ttl: 5000 });

    const r1 = await c.execute(fn);
    const r2 = await c.execute(fn);

    expect(r1).toBe('data');
    expect(r2).toBe('data');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after TTL expires', async () => {
    let count = 0;
    const fn = vi.fn().mockImplementation(() => Promise.resolve(++count));
    const c = cache({ ttl: 1000 });

    const r1 = await c.execute(fn);
    expect(r1).toBe(1);

    vi.advanceTimersByTime(1100);
    const r2 = await c.execute(fn);
    expect(r2).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use custom key function', async () => {
    let key = 'a';
    const fn = vi.fn().mockImplementation(() => Promise.resolve(`data-${key}`));
    const c = cache({ ttl: 5000, keyFn: () => key });

    const r1 = await c.execute(fn);
    expect(r1).toBe('data-a');

    key = 'b';
    const r2 = await c.execute(fn);
    expect(r2).toBe('data-b');

    // 'a' still cached
    key = 'a';
    const r3 = await c.execute(fn);
    expect(r3).toBe('data-a');
    expect(fn).toHaveBeenCalledTimes(2); // only a and b
  });

  it('should invalidate specific key', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const onEvict = vi.fn();
    const c = cache({ ttl: 5000, onEvict });

    await c.execute(fn);
    expect(c.handle.size).toBe(1);

    c.handle.invalidate('default');
    expect(c.handle.size).toBe(0);
    expect(onEvict).toHaveBeenCalledWith('default', 'data');
  });

  it('should invalidate default key when no key provided', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const c = cache({ ttl: 5000 });

    await c.execute(fn);
    c.handle.invalidate();
    expect(c.handle.size).toBe(0);
  });

  it('should clear all entries', async () => {
    let key = 'a';
    const fn = vi.fn().mockImplementation(() => Promise.resolve(`data-${key}`));
    const onEvict = vi.fn();
    const c = cache({ ttl: 5000, keyFn: () => key, onEvict });

    await c.execute(fn);
    key = 'b';
    await c.execute(fn);
    expect(c.handle.size).toBe(2);

    c.handle.clear();
    expect(c.handle.size).toBe(0);
    expect(onEvict).toHaveBeenCalledTimes(2);
  });

  it('should support stale-while-revalidate', async () => {
    let count = 0;
    const fn = vi.fn().mockImplementation(() => Promise.resolve(++count));
    const c = cache({ ttl: 1000, staleWhileRevalidate: true });

    // Initial fetch
    const r1 = await c.execute(fn);
    expect(r1).toBe(1);

    // Expire the entry
    vi.advanceTimersByTime(1100);

    // Should return stale value and revalidate in background
    const r2 = await c.execute(fn);
    expect(r2).toBe(1); // stale value

    // Let the background revalidation promise settle
    await vi.advanceTimersByTimeAsync(10);

    // Now should have new value
    const r3 = await c.execute(fn);
    expect(r3).toBe(2); // fresh value
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle SWR revalidation failure gracefully', async () => {
    let count = 0;
    const fn = vi.fn().mockImplementation(() => {
      count++;
      if (count === 2) return Promise.reject(new Error('revalidation-fail'));
      return Promise.resolve(count);
    });
    const c = cache({ ttl: 1000, staleWhileRevalidate: true });

    const r1 = await c.execute(fn);
    expect(r1).toBe(1);

    vi.advanceTimersByTime(1100);

    // Returns stale, background revalidation fails
    const r2 = await c.execute(fn);
    expect(r2).toBe(1);

    // Let the revalidation fail
    await vi.advanceTimersByTimeAsync(10);

    // Should try again since stale flag was reset
    vi.advanceTimersByTime(1100);
    const r3 = await c.execute(fn);
    expect(r3).toBe(1); // still stale, triggers another revalidation
    await vi.advanceTimersByTimeAsync(10);

    // Now count=3, should succeed
    const r4 = await c.execute(fn);
    expect(r4).toBe(3);
  });

  it('should handle onEvict being called on TTL expiry re-fetch', async () => {
    const onEvict = vi.fn();
    let count = 0;
    const fn = vi.fn().mockImplementation(() => Promise.resolve(++count));
    const c = cache({ ttl: 1000, onEvict });

    await c.execute(fn);
    vi.advanceTimersByTime(1100);
    await c.execute(fn);

    expect(onEvict).toHaveBeenCalledWith('default', 1);
  });

  it('should not call onEvict if key does not exist', () => {
    const onEvict = vi.fn();
    const c = cache({ ttl: 5000, onEvict });

    c.handle.invalidate('non-existent');
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('should clear without onEvict callback', async () => {
    const fn = vi.fn().mockResolvedValue('data');
    const c = cache({ ttl: 5000 });

    await c.execute(fn);
    c.handle.clear();
    expect(c.handle.size).toBe(0);
  });

  it('should throw on invalid ttl', () => {
    expect(() => cache({ ttl: 0 })).toThrow(RangeError);
    expect(() => cache({ ttl: -100 })).toThrow(RangeError);
  });

  it('should use defaults when no options provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const c = cache();
    const result = await c.execute(fn);
    expect(result).toBe(42);
  });

  it('should handle SWR not re-triggering while already stale', async () => {
    let count = 0;
    // Use a delayed mock so background revalidation doesn't settle immediately
    const fn = vi.fn().mockImplementation(() => {
      count++;
      return new Promise((resolve) => setTimeout(() => resolve(count), 100));
    });
    const c = cache({ ttl: 1000, staleWhileRevalidate: true });

    // Initial fetch
    await vi.advanceTimersByTimeAsync(0);
    const execPromise1 = c.execute(fn);
    await vi.advanceTimersByTimeAsync(100);
    const r1 = await execPromise1;
    expect(r1).toBe(1);

    vi.advanceTimersByTime(1100);

    // First stale hit triggers revalidation, returns stale value
    const r2 = await c.execute(fn);
    expect(r2).toBe(1);

    // Second call while revalidation is still in flight — entry.stale === true
    // falls through to evict + re-fetch
    const execPromise3 = c.execute(fn);
    await vi.advanceTimersByTimeAsync(200);
    const r3 = await execPromise3;
    expect(r3).toBe(3);

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
