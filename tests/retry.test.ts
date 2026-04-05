import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from '../src/policies/retry';
import { RetryExhaustedError } from '../src/types';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry()(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValue('ok');

    const promise = retry({ maxAttempts: 3, delay: 100, backoff: 'constant' })(fn);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw RetryExhaustedError after all attempts fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = retry({ maxAttempts: 2, delay: 50, backoff: 'constant' })(fn);
    // Attach rejection handler immediately to prevent unhandled rejection
    const caught = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(200);

    const e = await caught;
    expect(e).toBeInstanceOf(RetryExhaustedError);
    const rErr = e as RetryExhaustedError;
    expect(rErr.attempts).toBe(2);
    expect(rErr.message).toBe('All 2 retry attempts exhausted');
    expect(rErr.cause).toBeDefined();
    expect((rErr.cause as Error).message).toBe('always fails');
  });

  it('should use constant backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 3, delay: 100, backoff: 'constant', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(200);
    await promise;
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
  });

  it('should use linear backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 4, delay: 100, backoff: 'linear', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, 200);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 4, delay: 100, backoff: 'exponential', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, 200);
  });

  it('should use decorrelatedJitter backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 3, delay: 100, backoff: 'decorrelatedJitter', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    const delay = onRetry.mock.calls[0][2];
    expect(delay).toBeGreaterThanOrEqual(100);
  });

  it('should respect maxDelay cap', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({
      maxAttempts: 3,
      delay: 10000,
      backoff: 'exponential',
      maxDelay: 500,
      onRetry,
    })(fn);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(onRetry.mock.calls[0][2]).toBeLessThanOrEqual(500);
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const shouldRetry = vi.fn().mockReturnValue(false);
    const promise = retry({ maxAttempts: 5, delay: 50, backoff: 'constant', shouldRetry })(fn);
    const assertion = expect(promise).rejects.toThrow(RetryExhaustedError);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should abort when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('pre-aborted'));
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(
      retry({ signal: controller.signal })(fn),
    ).rejects.toThrow('pre-aborted');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should abort mid-retry when signal fires', async () => {
    vi.useRealTimers();
    const controller = new AbortController();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockResolvedValue('ok');
    const promise = retry({ maxAttempts: 5, delay: 5000, backoff: 'constant', signal: controller.signal })(fn);
    // Give time for first attempt to fail and enter sleep
    await new Promise((r) => setTimeout(r, 50));
    controller.abort(new Error('cancelled'));
    await expect(promise).rejects.toThrow('cancelled');
    vi.useFakeTimers();
  });

  it('should call onRetry callback before each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 4, delay: 50, backoff: 'constant', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(300);
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should throw on invalid maxAttempts', () => {
    expect(() => retry({ maxAttempts: 0 })).toThrow(RangeError);
    expect(() => retry({ maxAttempts: -1 })).toThrow(RangeError);
    expect(() => retry({ maxAttempts: 1.5 })).toThrow(RangeError);
    expect(() => retry({ maxAttempts: NaN })).toThrow(RangeError);
  });

  it('should throw on invalid delay', () => {
    expect(() => retry({ delay: 0 })).toThrow(RangeError);
    expect(() => retry({ delay: -100 })).toThrow(RangeError);
  });

  it('should throw on invalid maxDelay', () => {
    expect(() => retry({ maxDelay: 0 })).toThrow(RangeError);
    expect(() => retry({ maxDelay: -100 })).toThrow(RangeError);
  });

  it('should use defaults when no options provided', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await retry()(fn);
    expect(result).toBe(42);
  });

  it('should work with decorrelatedJitter on multiple retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    const promise = retry({ maxAttempts: 4, delay: 50, backoff: 'decorrelatedJitter', onRetry })(fn);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should abort with default error when signal.reason is undefined', async () => {
    const controller = new AbortController();
    controller.abort(); // no reason
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(
      retry({ signal: controller.signal })(fn),
    ).rejects.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});
