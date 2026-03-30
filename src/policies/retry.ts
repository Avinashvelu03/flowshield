import type { RetryOptions } from '../types.js';
import { RetryExhaustedError } from '../types.js';
import { sleep, calculateDelay, assertPositiveInteger, assertPositive } from '../utils.js';

const DEFAULTS = {
  maxAttempts: 3,
  delay: 200,
  backoff: 'exponential' as const,
  maxDelay: 30_000,
};

/**
 * Creates a retry policy that re-executes the wrapped operation on failure
 * using the configured backoff strategy.
 *
 * @example
 * ```ts
 * const result = await retry({ maxAttempts: 5, backoff: 'exponential' })(
 *   () => fetch('/api/data'),
 * );
 * ```
 */
export function retry(options: RetryOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelay = options.delay ?? DEFAULTS.delay;
  const backoff = options.backoff ?? DEFAULTS.backoff;
  const maxDelay = options.maxDelay ?? DEFAULTS.maxDelay;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const onRetry = options.onRetry;
  const signal = options.signal;

  assertPositiveInteger(maxAttempts, 'maxAttempts');
  assertPositive(baseDelay, 'delay');
  assertPositive(maxDelay, 'maxDelay');

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    let previousDelay = baseDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw signal.reason;
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        if (!shouldRetry(error, attempt)) {
          break;
        }

        const delayMs = calculateDelay(attempt, baseDelay, backoff, maxDelay, previousDelay);
        previousDelay = delayMs;

        onRetry?.(error, attempt, delayMs);

        await sleep(delayMs, signal);
      }
    }

    throw new RetryExhaustedError(maxAttempts, lastError);
  };
}
