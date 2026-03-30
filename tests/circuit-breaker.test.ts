import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { circuitBreaker } from '../src/policies/circuit-breaker';
import { CircuitOpenError } from '../src/types';

describe('circuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should pass through on success in closed state', async () => {
    const cb = circuitBreaker({ failureThreshold: 3 });
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.handle.state).toBe('closed');
  });

  it('should trip to open after failureThreshold consecutive failures', async () => {
    const onOpen = vi.fn();
    const cb = circuitBreaker({ failureThreshold: 2, onOpen });

    await expect(cb.execute(() => Promise.reject(new Error('f1')))).rejects.toThrow('f1');
    expect(cb.handle.state).toBe('closed');
    expect(cb.handle.failureCount).toBe(1);

    await expect(cb.execute(() => Promise.reject(new Error('f2')))).rejects.toThrow('f2');
    expect(cb.handle.state).toBe('open');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('should reject immediately when open', async () => {
    const cb = circuitBreaker({ failureThreshold: 1, resetTimeout: 10000 });

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow('f');
    expect(cb.handle.state).toBe('open');

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('should transition to half-open after resetTimeout', async () => {
    const onHalfOpen = vi.fn();
    const cb = circuitBreaker({ failureThreshold: 1, resetTimeout: 5000, onHalfOpen });

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();
    expect(cb.handle.state).toBe('open');

    vi.advanceTimersByTime(5000);
    expect(cb.handle.state).toBe('half-open');
    expect(onHalfOpen).toHaveBeenCalledTimes(1);
  });

  it('should close after successThreshold successes in half-open', async () => {
    const onClose = vi.fn();
    const cb = circuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      resetTimeout: 1000,
      onClose,
    });

    // Trip it
    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();
    vi.advanceTimersByTime(1000);

    // First success in half-open
    const r1 = await cb.execute(() => Promise.resolve('ok1'));
    expect(r1).toBe('ok1');
    expect(cb.handle.state).toBe('half-open');
    expect(cb.handle.successCount).toBe(1);

    // Second success closes it
    const r2 = await cb.execute(() => Promise.resolve('ok2'));
    expect(r2).toBe('ok2');
    expect(cb.handle.state).toBe('closed');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should trip back to open on any failure in half-open', async () => {
    const onOpen = vi.fn();
    const cb = circuitBreaker({
      failureThreshold: 1,
      resetTimeout: 1000,
      onOpen,
    });

    // Trip it
    await expect(cb.execute(() => Promise.reject(new Error('f1')))).rejects.toThrow();
    expect(onOpen).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    // Now half-open; failure should trip again
    await expect(cb.execute(() => Promise.reject(new Error('f2')))).rejects.toThrow();
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(cb.handle.state).toBe('open');
  });

  it('should reset failure count on success in closed state', async () => {
    const cb = circuitBreaker({ failureThreshold: 3 });

    await expect(cb.execute(() => Promise.reject(new Error('f1')))).rejects.toThrow();
    expect(cb.handle.failureCount).toBe(1);

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.handle.failureCount).toBe(0);
  });

  it('should manually reset via handle', async () => {
    const onClose = vi.fn();
    const cb = circuitBreaker({ failureThreshold: 1, onClose });

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();
    expect(cb.handle.state).toBe('open');

    cb.handle.reset();
    expect(cb.handle.state).toBe('closed');
    expect(cb.handle.failureCount).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should transition to half-open during execute when timer elapsed', async () => {
    const onHalfOpen = vi.fn();
    const cb = circuitBreaker({ failureThreshold: 1, resetTimeout: 1000, onHalfOpen });

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();

    vi.advanceTimersByTime(1000);

    // Next execute should transition to half-open and try
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(onHalfOpen).toHaveBeenCalled();
  });

  it('should throw on invalid options', () => {
    expect(() => circuitBreaker({ failureThreshold: 0 })).toThrow(RangeError);
    expect(() => circuitBreaker({ successThreshold: 0 })).toThrow(RangeError);
    expect(() => circuitBreaker({ resetTimeout: 0 })).toThrow(RangeError);
    expect(() => circuitBreaker({ failureThreshold: -1 })).toThrow(RangeError);
    expect(() => circuitBreaker({ failureThreshold: 1.5 })).toThrow(RangeError);
    expect(() => circuitBreaker({ resetTimeout: -100 })).toThrow(RangeError);
  });

  it('should use defaults when no options provided', async () => {
    const cb = circuitBreaker();
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('should handle onHalfOpen being called only once on state getter', async () => {
    const onHalfOpen = vi.fn();
    const cb = circuitBreaker({ failureThreshold: 1, resetTimeout: 1000, onHalfOpen });

    await expect(cb.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();
    vi.advanceTimersByTime(1000);

    // Access state twice — onHalfOpen should only fire once
    const s1 = cb.handle.state;
    const s2 = cb.handle.state;
    expect(s1).toBe('half-open');
    expect(s2).toBe('half-open');
    expect(onHalfOpen).toHaveBeenCalledTimes(1);
  });
});
