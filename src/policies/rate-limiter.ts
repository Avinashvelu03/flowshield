import type { RateLimiterOptions, RateLimiterHandle } from '../types.js';
import { RateLimitExceededError } from '../types.js';
import { assertPositiveInteger, assertPositive } from '../utils.js';

const DEFAULTS = {
  tokensPerInterval: 10,
  interval: 1000,
  rejectOnLimit: false,
};

interface Waiter {
  resolve: () => void;
}

/**
 * Creates a token-bucket rate limiter policy that limits how many times
 * the wrapped operation can be executed within a time interval.
 *
 * Returns an object with `execute` (the policy function) and `handle`
 * (an interface to inspect / reset the bucket).
 *
 * @example
 * ```ts
 * const rl = rateLimiter({ tokensPerInterval: 5, interval: 1000 });
  * const result = await rl.execute(() => callApi());
 * ```
 */
export function rateLimiter(options: RateLimiterOptions = {}): {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  handle: RateLimiterHandle;
} {
  const tokensPerInterval = options.tokensPerInterval ?? DEFAULTS.tokensPerInterval;
  const interval = options.interval ?? DEFAULTS.interval;
  const rejectOnLimit = options.rejectOnLimit ?? DEFAULTS.rejectOnLimit;

  assertPositiveInteger(tokensPerInterval, 'tokensPerInterval');
  assertPositive(interval, 'interval');

  let tokens = tokensPerInterval;
  let lastRefill = Date.now();
  const waiters: Waiter[] = [];

  function refill(): void {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = Math.floor((elapsed / interval) * tokensPerInterval);

    if (newTokens > 0) {
      tokens = Math.min(tokensPerInterval, tokens + newTokens);
      lastRefill = now;
    }
  }

  function releaseWaiters(): void {
    while (tokens > 0 && waiters.length > 0) {
      tokens--;
      const waiter = waiters.shift()!;
      waiter.resolve();
    }
  }

  // Refill timer — only active when there are waiters
  let refillTimer: ReturnType<typeof setInterval> | null = null;

  function startRefillTimer(): void {
    if (refillTimer !== null) return;
    refillTimer = setInterval(() => {
      refill();
      releaseWaiters();
      if (waiters.length === 0 && refillTimer !== null) {
        clearInterval(refillTimer);
        refillTimer = null;
      }
    }, Math.min(interval, 100));
  }

  const handle: RateLimiterHandle = {
    get availableTokens() {
      refill();
      return tokens;
    },
    reset() {
      tokens = tokensPerInterval;
      lastRefill = Date.now();
      releaseWaiters();
    },
  };

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    refill();

    if (tokens > 0) {
      tokens--;
      return fn();
    }

    if (rejectOnLimit) {
      throw new RateLimitExceededError();
    }

    // Queue and wait for a token
    await new Promise<void>((resolve) => {
      waiters.push({ resolve });
      startRefillTimer();
    });

    return fn();
  }

  return { execute, handle };
}
