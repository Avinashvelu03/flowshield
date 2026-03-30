import { describe, it, expect, vi } from 'vitest';
import { fallback } from '../src/policies/fallback';

describe('fallback', () => {
  it('should return the original result on success', async () => {
    const result = await fallback({ fallback: 'default' })(
      () => Promise.resolve('ok'),
    );
    expect(result).toBe('ok');
  });

  it('should return fallback value on failure', async () => {
    const result = await fallback({ fallback: 'default' })(
      () => Promise.reject(new Error('fail')),
    );
    expect(result).toBe('default');
  });

  it('should call fallback function on failure', async () => {
    const result = await fallback({
      fallback: (err: unknown) => `recovered: ${(err as Error).message}`,
    })(() => Promise.reject(new Error('oops')));

    expect(result).toBe('recovered: oops');
  });

  it('should call async fallback function on failure', async () => {
    const result = await fallback({
      fallback: async (err: unknown) => {
        return `async-recovered: ${(err as Error).message}`;
      },
    })(() => Promise.reject(new Error('async-fail')));

    expect(result).toBe('async-recovered: async-fail');
  });

  it('should not use fallback when shouldFallback returns false', async () => {
    await expect(
      fallback({
        fallback: 'default',
        shouldFallback: () => false,
      })(() => Promise.reject(new Error('no-fallback'))),
    ).rejects.toThrow('no-fallback');
  });

  it('should use fallback when shouldFallback returns true', async () => {
    const result = await fallback({
      fallback: 'caught',
      shouldFallback: (err) => (err as Error).message === 'catch-me',
    })(() => Promise.reject(new Error('catch-me')));

    expect(result).toBe('caught');
  });

  it('should re-throw when shouldFallback returns false for specific errors', async () => {
    const policy = fallback({
      fallback: 'default',
      shouldFallback: (err) => (err as Error).message !== 'critical',
    });

    // Non-critical: should fallback
    const r1 = await policy(() => Promise.reject(new Error('minor')));
    expect(r1).toBe('default');

    // Critical: should re-throw
    await expect(
      policy(() => Promise.reject(new Error('critical'))),
    ).rejects.toThrow('critical');
  });

  it('should handle fallback value of null', async () => {
    const result = await fallback({ fallback: null })(
      () => Promise.reject(new Error('fail')),
    );
    expect(result).toBeNull();
  });

  it('should handle fallback value of 0', async () => {
    const result = await fallback({ fallback: 0 })(
      () => Promise.reject(new Error('fail')),
    );
    expect(result).toBe(0);
  });

  it('should handle fallback value of empty array', async () => {
    const result = await fallback({ fallback: [] as string[] })(
      () => Promise.reject(new Error('fail')),
    );
    expect(result).toEqual([]);
  });

  it('should default shouldFallback to always true', async () => {
    const spy = vi.fn().mockReturnValue('fb');
    const result = await fallback({ fallback: spy })(
      () => Promise.reject(new Error('x')),
    );
    expect(result).toBe('fb');
    expect(spy).toHaveBeenCalledWith(expect.any(Error));
  });
});
