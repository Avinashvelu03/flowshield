import type { TimeoutOptions } from '../types.js';
import { TimeoutError } from '../types.js';
import { assertPositive } from '../utils.js';

/**
 * Creates a timeout policy that rejects if the wrapped operation
 * does not resolve within the specified deadline.
 *
 * Uses AbortController for cooperative cancellation when the
 * wrapped function supports it.
 *
 * @example
 * ```ts
 * const result = await timeout({ ms: 5000 })(() => fetch('/api/data'));
 * ```
 */
export function timeout(options: TimeoutOptions) {
  assertPositive(options.ms, 'ms');

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new TimeoutError(options.ms));
        }
      }, options.ms);

      fn().then(
        (value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        },
      );
    });
  };
}
