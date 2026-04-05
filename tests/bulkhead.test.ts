import { describe, it, expect, vi } from 'vitest';
import { bulkhead } from '../src/policies/bulkhead';
import { BulkheadRejectedError } from '../src/types';

describe('bulkhead', () => {
  it('should allow up to maxConcurrent executions', async () => {
    const bh = bulkhead({ maxConcurrent: 2, maxQueue: 0 });
    let running = 0;
    let maxRunning = 0;

    const fn = () => new Promise<void>((resolve) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      setTimeout(() => {
        running--;
        resolve();
      }, 50);
    });

    vi.useFakeTimers();
    const p1 = bh.execute(fn);
    const p2 = bh.execute(fn);

    expect(bh.handle.running).toBe(2);
    expect(bh.handle.queued).toBe(0);

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);

    expect(maxRunning).toBe(2);
    vi.useRealTimers();
  });

  it('should reject when maxConcurrent and maxQueue are full', async () => {
    const bh = bulkhead({ maxConcurrent: 1, maxQueue: 0 });

    // Fill the concurrent slot
    const longFn = () => new Promise<void>((resolve) => setTimeout(resolve, 10000));
    vi.useFakeTimers();
    bh.execute(longFn); // takes the slot

    // Should reject
    await expect(bh.execute(() => Promise.resolve())).rejects.toThrow(BulkheadRejectedError);
    vi.useRealTimers();
  });

  it('should queue up to maxQueue and process in order', async () => {
    vi.useFakeTimers();
    const bh = bulkhead({ maxConcurrent: 1, maxQueue: 2 });
    const order: number[] = [];

    const makeFn = (id: number) => () => new Promise<number>((resolve) => {
      setTimeout(() => {
        order.push(id);
        resolve(id);
      }, 50);
    });

    const p1 = bh.execute(makeFn(1));
    const p2 = bh.execute(makeFn(2));
    const p3 = bh.execute(makeFn(3));

    expect(bh.handle.running).toBe(1);
    expect(bh.handle.queued).toBe(2);

    // Reject 4th
    await expect(bh.execute(makeFn(4))).rejects.toThrow(BulkheadRejectedError);

    // Process all
    await vi.advanceTimersByTimeAsync(200);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(r3).toBe(3);
    expect(order).toEqual([1, 2, 3]);
    vi.useRealTimers();
  });

  it('should propagate errors from queued tasks', async () => {
    vi.useFakeTimers();
    const bh = bulkhead({ maxConcurrent: 1, maxQueue: 1 });

    const blocker = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
    const failing = () => Promise.reject(new Error('queued fail'));

    const p1 = bh.execute(blocker);
    const p2 = bh.execute(failing);
    const assertion = expect(p2).rejects.toThrow('queued fail');

    await vi.advanceTimersByTimeAsync(100);
    await p1;
    await assertion;
    vi.useRealTimers();
  });

  it('should use defaults when no options provided', async () => {
    const bh = bulkhead();
    const result = await bh.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('should throw on invalid maxConcurrent', () => {
    expect(() => bulkhead({ maxConcurrent: 0 })).toThrow(RangeError);
    expect(() => bulkhead({ maxConcurrent: -1 })).toThrow(RangeError);
    expect(() => bulkhead({ maxConcurrent: 1.5 })).toThrow(RangeError);
  });

  it('should throw on invalid maxQueue', () => {
    expect(() => bulkhead({ maxQueue: -1 })).toThrow(RangeError);
    expect(() => bulkhead({ maxQueue: NaN })).toThrow(RangeError);
  });

  it('should handle concurrent completions and drain queue', async () => {
    vi.useFakeTimers();
    const bh = bulkhead({ maxConcurrent: 2, maxQueue: 3 });

    const results: number[] = [];
    const makeFn = (id: number) => () => new Promise<number>((resolve) => {
      setTimeout(() => {
        results.push(id);
        resolve(id);
      }, 50);
    });

    const promises = [
      bh.execute(makeFn(1)),
      bh.execute(makeFn(2)),
      bh.execute(makeFn(3)),
      bh.execute(makeFn(4)),
      bh.execute(makeFn(5)),
    ];

    expect(bh.handle.running).toBe(2);
    expect(bh.handle.queued).toBe(3);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(promises);

    expect(results).toEqual([1, 2, 3, 4, 5]);
    vi.useRealTimers();
  });
});
