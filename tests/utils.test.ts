import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleep, calculateDelay, assertPositiveInteger, assertPositive, assertNonNegative } from '../src/utils';

describe('utils', () => {
  describe('sleep', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should resolve after the specified delay', async () => {
      const p = sleep(100);
      await vi.advanceTimersByTimeAsync(100);
      await p;
    });

    it('should reject if signal is already aborted', async () => {
      const ctrl = new AbortController();
      ctrl.abort(new Error('pre'));
      await expect(sleep(100, ctrl.signal)).rejects.toThrow('pre');
    });

    it('should reject if signal fires during sleep', async () => {
      const ctrl = new AbortController();
      const p = sleep(1000, ctrl.signal);
      await vi.advanceTimersByTimeAsync(50);
      ctrl.abort(new Error('mid'));
      await expect(p).rejects.toThrow('mid');
    });

    it('should resolve normally with signal that never fires', async () => {
      const ctrl = new AbortController();
      const p = sleep(100, ctrl.signal);
      await vi.advanceTimersByTimeAsync(100);
      await p;
    });

    it('should use default error when signal.reason is undefined', async () => {
      const ctrl = new AbortController();
      ctrl.abort();
      await expect(sleep(100, ctrl.signal)).rejects.toThrow();
    });

    it('should use default error on mid-sleep abort without reason', async () => {
      const ctrl = new AbortController();
      const p = sleep(1000, ctrl.signal);
      await vi.advanceTimersByTimeAsync(50);
      ctrl.abort();
      await expect(p).rejects.toThrow();
    });
  });

  describe('calculateDelay', () => {
    it('should return baseDelay for constant strategy', () => {
      expect(calculateDelay(1, 100, 'constant', 30000)).toBe(100);
      expect(calculateDelay(5, 100, 'constant', 30000)).toBe(100);
    });

    it('should return linear delay', () => {
      expect(calculateDelay(1, 100, 'linear', 30000)).toBe(100);
      expect(calculateDelay(3, 100, 'linear', 30000)).toBe(300);
    });

    it('should return exponential delay', () => {
      expect(calculateDelay(1, 100, 'exponential', 30000)).toBe(100);
      expect(calculateDelay(3, 100, 'exponential', 30000)).toBe(400);
    });

    it('should return decorrelated jitter delay', () => {
      const d = calculateDelay(1, 100, 'decorrelatedJitter', 30000);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(30000);
    });

    it('should use previousDelay for decorrelated jitter', () => {
      const d = calculateDelay(2, 100, 'decorrelatedJitter', 30000, 200);
      expect(d).toBeGreaterThanOrEqual(100);
    });

    it('should cap at maxDelay', () => {
      expect(calculateDelay(10, 1000, 'exponential', 5000)).toBe(5000);
    });
  });

  describe('assertPositiveInteger', () => {
    it('should pass for valid values', () => {
      expect(() => assertPositiveInteger(1, 'x')).not.toThrow();
      expect(() => assertPositiveInteger(100, 'x')).not.toThrow();
    });
    it('should throw for invalid values', () => {
      expect(() => assertPositiveInteger(0, 'x')).toThrow(RangeError);
      expect(() => assertPositiveInteger(-1, 'x')).toThrow(RangeError);
      expect(() => assertPositiveInteger(1.5, 'x')).toThrow(RangeError);
      expect(() => assertPositiveInteger(NaN, 'x')).toThrow(RangeError);
      expect(() => assertPositiveInteger(Infinity, 'x')).toThrow(RangeError);
    });
  });

  describe('assertPositive', () => {
    it('should pass for valid values', () => {
      expect(() => assertPositive(0.1, 'x')).not.toThrow();
      expect(() => assertPositive(100, 'x')).not.toThrow();
    });
    it('should throw for invalid values', () => {
      expect(() => assertPositive(0, 'x')).toThrow(RangeError);
      expect(() => assertPositive(-1, 'x')).toThrow(RangeError);
      expect(() => assertPositive(NaN, 'x')).toThrow(RangeError);
      expect(() => assertPositive(Infinity, 'x')).toThrow(RangeError);
    });
  });

  describe('assertNonNegative', () => {
    it('should pass for valid values', () => {
      expect(() => assertNonNegative(0, 'x')).not.toThrow();
      expect(() => assertNonNegative(100, 'x')).not.toThrow();
    });
    it('should throw for invalid values', () => {
      expect(() => assertNonNegative(-1, 'x')).toThrow(RangeError);
      expect(() => assertNonNegative(NaN, 'x')).toThrow(RangeError);
      expect(() => assertNonNegative(Infinity, 'x')).toThrow(RangeError);
    });
  });
});
