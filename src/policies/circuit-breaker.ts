import type { CircuitBreakerOptions, CircuitBreakerHandle, CircuitState } from '../types.js';
import { CircuitOpenError } from '../types.js';
import { assertPositiveInteger, assertPositive } from '../utils.js';

const DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 1,
  resetTimeout: 30_000,
};

/**
 * Creates a circuit breaker policy that prevents calls to a failing service.
 *
 * Returns an object with `execute` (the policy function) and `handle`
 * (an interface to inspect / reset the breaker state).
 *
 * @example
 * ```ts
 * const cb = circuitBreaker({ failureThreshold: 3, resetTimeout: 10_000 });
 * const result = await cb.execute(() => fetch('/api/health'));
 * console.log(cb.handle.state); // 'closed'
 * ```
 */
export function circuitBreaker(options: CircuitBreakerOptions = {}): {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  handle: CircuitBreakerHandle;
} {
  const failureThreshold = options.failureThreshold ?? DEFAULTS.failureThreshold;
  const successThreshold = options.successThreshold ?? DEFAULTS.successThreshold;
  const resetTimeout = options.resetTimeout ?? DEFAULTS.resetTimeout;

  assertPositiveInteger(failureThreshold, 'failureThreshold');
  assertPositiveInteger(successThreshold, 'successThreshold');
  assertPositive(resetTimeout, 'resetTimeout');

  let state: CircuitState = 'closed';
  let failureCount = 0;
  let successCount = 0;
  let nextAttemptTime = 0;

  function trip(): void {
    state = 'open';
    nextAttemptTime = Date.now() + resetTimeout;
    options.onOpen?.();
  }

  function resetState(): void {
    state = 'closed';
    failureCount = 0;
    successCount = 0;
    options.onClose?.();
  }

  function tryTransitionToHalfOpen(): boolean {
    if (state === 'open' && Date.now() >= nextAttemptTime) {
      state = 'half-open';
      successCount = 0;
      options.onHalfOpen?.();
      return true;
    }
    return false;
  }

  const handle: CircuitBreakerHandle = {
    get state() {
      // Auto-transition if timer has elapsed
      if (state === 'open' && Date.now() >= nextAttemptTime) {
        state = 'half-open';
        successCount = 0;
        options.onHalfOpen?.();
      }
      return state;
    },
    get failureCount() {
      return failureCount;
    },
    get successCount() {
      return successCount;
    },
    reset() {
      resetState();
    },
  };

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    if (state === 'open') {
      if (!tryTransitionToHalfOpen()) {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();

      // Success handling
      if (state === 'half-open') {
        successCount++;
        if (successCount >= successThreshold) {
          resetState();
        }
      } else {
        // In closed state, reset failure count on success
        failureCount = 0;
      }

      return result;
    } catch (error) {
      failureCount++;

      if (state === 'half-open') {
        // Any failure in half-open trips back to open
        trip();
      } else if (failureCount >= failureThreshold) {
        trip();
      }

      throw error;
    }
  }

  return { execute, handle };
}
