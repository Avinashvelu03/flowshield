import { describe, it, expect, vi } from 'vitest';
import { pipe, wrap } from '../src/compose';
import type { Policy } from '../src/types';

describe('compose', () => {
  describe('pipe', () => {
    it('should execute fn directly when no policies provided', async () => {
      const result = await pipe()(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should apply a single policy', async () => {
      const mockPolicy: Policy = (fn) => fn();
      const result = await pipe(mockPolicy)(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should apply policies left-to-right (outermost first)', async () => {
      const order: string[] = [];

      const policyA: Policy = async (fn) => {
        order.push('A-before');
        const result = await fn();
        order.push('A-after');
        return result;
      };

      const policyB: Policy = async (fn) => {
        order.push('B-before');
        const result = await fn();
        order.push('B-after');
        return result;
      };

      const result = await pipe(policyA, policyB)(() => {
        order.push('fn');
        return Promise.resolve('ok');
      });

      expect(result).toBe('ok');
      expect(order).toEqual(['A-before', 'B-before', 'fn', 'B-after', 'A-after']);
    });

    it('should compose three policies', async () => {
      const order: string[] = [];

      const makePolicy = (name: string): Policy => async (fn) => {
        order.push(`${name}-in`);
        const result = await fn();
        order.push(`${name}-out`);
        return result;
      };

      const result = await pipe(
        makePolicy('A'),
        makePolicy('B'),
        makePolicy('C'),
      )(() => {
        order.push('fn');
        return Promise.resolve(42);
      });

      expect(result).toBe(42);
      expect(order).toEqual(['A-in', 'B-in', 'C-in', 'fn', 'C-out', 'B-out', 'A-out']);
    });

    it('should propagate errors through composed policies', async () => {
      const policy: Policy = (fn) => fn();
      const composed = pipe(policy, policy);

      await expect(
        composed(() => Promise.reject(new Error('inner'))),
      ).rejects.toThrow('inner');
    });

    it('should allow a policy to intercept errors', async () => {
      const catchingPolicy: Policy = async <T>(fn: () => Promise<T>) => {
        try {
          return await fn();
        } catch {
          return 'caught' as unknown as T;
        }
      };

      const result = await pipe(catchingPolicy)(
        () => Promise.reject(new Error('fail')),
      );
      expect(result).toBe('caught');
    });
  });

  describe('wrap', () => {
    it('should wrap inner with outer', async () => {
      const order: string[] = [];

      const outer: Policy = async (fn) => {
        order.push('outer-before');
        const result = await fn();
        order.push('outer-after');
        return result;
      };

      const inner: Policy = async (fn) => {
        order.push('inner-before');
        const result = await fn();
        order.push('inner-after');
        return result;
      };

      const result = await wrap(outer, inner)(() => {
        order.push('fn');
        return Promise.resolve('ok');
      });

      expect(result).toBe('ok');
      expect(order).toEqual(['outer-before', 'inner-before', 'fn', 'inner-after', 'outer-after']);
    });

    it('should propagate errors', async () => {
      const noop: Policy = (fn) => fn();
      const composed = wrap(noop, noop);

      await expect(
        composed(() => Promise.reject(new Error('err'))),
      ).rejects.toThrow('err');
    });
  });
});
