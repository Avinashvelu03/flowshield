import type { BulkheadOptions, BulkheadHandle } from '../types.js';
import { BulkheadRejectedError } from '../types.js';
import { assertNonNegative, assertPositiveInteger } from '../utils.js';

const DEFAULTS = {
  maxConcurrent: 10,
  maxQueue: 0,
};

interface QueueEntry<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * Creates a bulkhead (concurrency limiter) policy that limits the number
 * of concurrent executions of the wrapped operation.
 *
 * Returns an object with `execute` (the policy function) and `handle`
 * (an interface to inspect the bulkhead's running / queued counts).
 *
 * @example
 * ```ts
 * const bh = bulkhead({ maxConcurrent: 5, maxQueue: 10 });
 * const result = await bh.execute(() => fetch('/api/data'));
 * console.log(bh.handle.running); // number of active calls
 * ```
 */
export function bulkhead(options: BulkheadOptions = {}): {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  handle: BulkheadHandle;
} {
  const maxConcurrent = options.maxConcurrent ?? DEFAULTS.maxConcurrent;
  const maxQueue = options.maxQueue ?? DEFAULTS.maxQueue;

  assertPositiveInteger(maxConcurrent, 'maxConcurrent');
  assertNonNegative(maxQueue, 'maxQueue');

  let running = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: QueueEntry<any>[] = [];

  function dequeue(): void {
    while (running < maxConcurrent && queue.length > 0) {
      const entry = queue.shift()!;
      run(entry);
    }
  }

  function run<T>(entry: QueueEntry<T>): void {
    running++;
    entry
      .fn()
      .then(
        (value) => {
          entry.resolve(value);
        },
        (error) => {
          entry.reject(error);
        },
      )
      .finally(() => {
        running--;
        dequeue();
      });
  }

  const handle: BulkheadHandle = {
    get running() {
      return running;
    },
    get queued() {
      return queue.length;
    },
  };

  function execute<T>(fn: () => Promise<T>): Promise<T> {
    if (running < maxConcurrent) {
      return new Promise<T>((resolve, reject) => {
        run({ fn, resolve, reject });
      });
    }

    if (queue.length >= maxQueue) {
      return Promise.reject(new BulkheadRejectedError());
    }

    return new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve, reject });
    });
  }

  return { execute, handle };
}
