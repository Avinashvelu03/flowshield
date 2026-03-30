import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hedge } from '../src/policies/hedge';

describe('hedge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return primary result when it resolves before hedge delay', async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('primary'), 50)),
    );

    const promise = hedge({ hedgeDelay: 200 })(fn);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('primary');
    // Advance past hedge delay so the setTimeout fires but launchHedge is a no-op
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(1); // hedge never actually launched
  });

  it('should launch hedge request after delay and return the faster one', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Primary: slow
        return new Promise((resolve) => setTimeout(() => resolve('primary'), 500));
      }
      // Hedge: fast
      return new Promise((resolve) => setTimeout(() => resolve('hedge'), 50));
    });

    const promise = hedge({ hedgeDelay: 100 })(fn);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe('hedge');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle primary failing before hedge is launched', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('primary-fail'));
      }
      return new Promise((resolve) => setTimeout(() => resolve('hedge-ok'), 50));
    });

    const promise = hedge({ hedgeDelay: 5000 })(fn);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe('hedge-ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should reject when both primary and hedge fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('both-fail'));

    const promise = hedge({ hedgeDelay: 100 })(fn);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('both-fail');
  });

  it('should use default hedgeDelay', async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('ok'), 50)),
    );

    const promise = hedge()(fn);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('ok');
  });

  it('should throw on invalid hedgeDelay', () => {
    expect(() => hedge({ hedgeDelay: 0 })).toThrow(RangeError);
    expect(() => hedge({ hedgeDelay: -100 })).toThrow(RangeError);
  });

  it('should handle primary failing after hedge was launched but hedge succeeds', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Primary: slow then fail
        return new Promise((_, reject) => setTimeout(() => reject(new Error('primary-late-fail')), 300));
      }
      // Hedge: resolves
      return new Promise((resolve) => setTimeout(() => resolve('hedge-wins'), 50));
    });

    const promise = hedge({ hedgeDelay: 100 })(fn);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toBe('hedge-wins');
  });

  it('should handle hedge failing but primary succeeds', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Primary: slow but succeeds
        return new Promise((resolve) => setTimeout(() => resolve('primary-wins'), 300));
      }
      // Hedge: fails
      return new Promise((_, reject) => setTimeout(() => reject(new Error('hedge-fail')), 50));
    });

    const promise = hedge({ hedgeDelay: 100 })(fn);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toBe('primary-wins');
  });

  it('should handle primary failing after hedge launched, hedge also fails', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error('primary-fail')), 300));
      }
      return new Promise((_, reject) => setTimeout(() => reject(new Error('hedge-fail')), 50));
    });

    const promise = hedge({ hedgeDelay: 100 })(fn);
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).rejects.toThrow('primary-fail');
  });
});
