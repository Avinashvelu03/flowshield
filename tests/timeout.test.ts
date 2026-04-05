import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timeout } from '../src/policies/timeout';
import { TimeoutError } from '../src/types';

describe('timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result if operation completes within deadline', async () => {
    const fn = () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 50));
    const promise = timeout({ ms: 200 })(fn);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result).toBe('ok');
  });

  it('should throw TimeoutError if operation exceeds deadline', async () => {
    const fn = () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 5000));
    const promise = timeout({ ms: 100 })(fn);
    const assertion = expect(promise).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
  });

  it('should propagate errors from the wrapped function', async () => {
    const fn = () => Promise.reject(new Error('inner error'));
    const promise = timeout({ ms: 5000 })(fn);

    await expect(promise).rejects.toThrow('inner error');
  });

  it('should throw on invalid ms', () => {
    expect(() => timeout({ ms: 0 })).toThrow(RangeError);
    expect(() => timeout({ ms: -100 })).toThrow(RangeError);
    expect(() => timeout({ ms: NaN })).toThrow(RangeError);
  });

  it('should not reject after resolve if operation completes before timeout', async () => {
    const fn = () => new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 50));
    const promise = timeout({ ms: 100 })(fn);
    await vi.advanceTimersByTimeAsync(60);
    const result = await promise;
    expect(result).toBe('ok');
  });

  it('should handle immediate resolution', async () => {
    const fn = () => Promise.resolve(42);
    const result = await timeout({ ms: 1000 })(fn);
    expect(result).toBe(42);
  });

  it('should handle immediate rejection', async () => {
    const fn = () => Promise.reject(new Error('instant fail'));
    await expect(timeout({ ms: 1000 })(fn)).rejects.toThrow('instant fail');
  });

  it('should ignore late resolve after timeout', async () => {
    let resolver: (v: string) => void;
    const fn = () => new Promise<string>((resolve) => { resolver = resolve; });
    const promise = timeout({ ms: 50 })(fn);
    const assertion = expect(promise).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;

    // Late resolve should be silently ignored
    resolver!('late');
  });

  it('should handle timeout with pending inner promise', async () => {
    // Inner promise never resolves or rejects
    const fn = () => new Promise<string>(() => {/* never settles */});
    const promise = timeout({ ms: 50 })(fn);
    const assertion = expect(promise).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });
});
