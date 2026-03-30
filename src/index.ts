// ─── Policies ───────────────────────────────────────────────────────────────
export { retry } from './policies/retry.js';
export { circuitBreaker } from './policies/circuit-breaker.js';
export { timeout } from './policies/timeout.js';
export { bulkhead } from './policies/bulkhead.js';
export { fallback } from './policies/fallback.js';
export { rateLimiter } from './policies/rate-limiter.js';
export { hedge } from './policies/hedge.js';
export { cache } from './policies/cache.js';

// ─── Composition ────────────────────────────────────────────────────────────
export { pipe, wrap } from './compose.js';

// ─── Types & Errors ─────────────────────────────────────────────────────────
export type {
  Policy,
  RetryOptions,
  BackoffStrategy,
  CircuitBreakerOptions,
  CircuitBreakerHandle,
  CircuitState,
  TimeoutOptions,
  BulkheadOptions,
  BulkheadHandle,
  FallbackOptions,
  RateLimiterOptions,
  RateLimiterHandle,
  HedgeOptions,
  CacheOptions,
  CacheHandle,
} from './types.js';

export {
  FlowShieldError,
  TimeoutError,
  CircuitOpenError,
  BulkheadRejectedError,
  RateLimitExceededError,
  RetryExhaustedError,
} from './types.js';
