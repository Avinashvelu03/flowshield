import type { FallbackOptions } from '../types.js';

/**
 * Creates a fallback policy that returns a fallback value (or the result
 * of a fallback function) when the wrapped operation fails.
 *
 * @example
 * ```ts
 * const result = await fallback({ fallback: [] })(
 *   () => fetch('/api/items').then(r => r.json()),
 * );
 * ```
 */
export function fallback<F>(options: FallbackOptions<F>) {
  const shouldFallback = options.shouldFallback ?? (() => true);

  return async <T>(fn: () => Promise<T>): Promise<T | F> => {
    try {
      return await fn();
    } catch (error) {
      if (!shouldFallback(error)) {
        throw error;
      }

      const fb = options.fallback;
      if (typeof fb === 'function') {
        return await (fb as (error: unknown) => F | Promise<F>)(error);
      }
      return fb;
    }
  };
}
