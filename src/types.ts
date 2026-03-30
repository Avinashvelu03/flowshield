// ─── Core Types ─────────────────────────────────────────────────────────────

/**
 * A policy is a higher-order function that wraps an async operation
 * with fault-tolerance behaviour.
 */
export type Policy = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * A policy factory returns a Policy and, optionally, a handle to
 * inspect / control the policy at runtime (e.g. circuit-breaker state).
 */
export type PolicyFactory<H = void> = H extends void
  ? Policy
  : { execute: Policy; handle: H };

// ─── Retry ──────────────────────────────────────────────────────────────────

export type BackoffStrategy = 'constant' | 'linear' | 'exponential' | 'decorrelatedJitter';

export interface RetryOptions {
  /** Maximum number of attempts (including the initial call). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms between retries. Default: 200 */
  delay?: number;
  /** Backoff strategy. Default: 'exponential' */
  backoff?: BackoffStrategy;
  /** Maximum delay cap in ms. Default: 30 000 */
  maxDelay?: number;
  /** Predicate – return `true` to retry on this error. Default: always retry */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** AbortSignal for cooperative cancellation */
  signal?: AbortSignal;
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures to trip the breaker. Default: 5 */
  failureThreshold?: number;
  /** Number of successes in half-open to close the breaker. Default: 1 */
  successThreshold?: number;
  /** Time in ms the breaker stays open before moving to half-open. Default: 30 000 */
  resetTimeout?: number;
  /** Called when the circuit opens */
  onOpen?: () => void;
  /** Called when the circuit closes */
  onClose?: () => void;
  /** Called when the circuit transitions to half-open */
  onHalfOpen?: () => void;
}

export interface CircuitBreakerHandle {
  /** Current state of the circuit */
  readonly state: CircuitState;
  /** Current consecutive failure count */
  readonly failureCount: number;
  /** Current consecutive success count (in half-open) */
  readonly successCount: number;
  /** Manually reset the breaker to closed */
  reset(): void;
}

// ─── Timeout ────────────────────────────────────────────────────────────────

export interface TimeoutOptions {
  /** Timeout deadline in milliseconds */
  ms: number;
}

// ─── Bulkhead ───────────────────────────────────────────────────────────────

export interface BulkheadOptions {
  /** Maximum concurrent executions. Default: 10 */
  maxConcurrent?: number;
  /** Maximum queue size. Default: 0 (no queue) */
  maxQueue?: number;
}

export interface BulkheadHandle {
  /** Number of currently running executions */
  readonly running: number;
  /** Number of queued executions */
  readonly queued: number;
}

// ─── Fallback ───────────────────────────────────────────────────────────────

export interface FallbackOptions<T> {
  /** The fallback value or async function producing one */
  fallback: T | ((error: unknown) => T) | ((error: unknown) => Promise<T>);
  /** Predicate – return `true` to use fallback for this error. Default: always */
  shouldFallback?: (error: unknown) => boolean;
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Maximum number of tokens (requests) per interval. Default: 10 */
  tokensPerInterval?: number;
  /** Interval duration in ms. Default: 1000 */
  interval?: number;
  /** If true, reject immediately when no tokens. If false, queue. Default: false */
  rejectOnLimit?: boolean;
}

export interface RateLimiterHandle {
  /** Number of tokens currently available */
  readonly availableTokens: number;
  /** Reset the bucket to full */
  reset(): void;
}

// ─── Hedge ──────────────────────────────────────────────────────────────────

export interface HedgeOptions {
  /** Delay in ms before sending the hedged (parallel) request. Default: 2000 */
  hedgeDelay?: number;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

export interface CacheOptions<T> {
  /** Time-to-live in ms. Default: 60 000 */
  ttl?: number;
  /** If true, return stale value while revalidating in the background. Default: false */
  staleWhileRevalidate?: boolean;
  /** Custom cache key generator. Default: 'default' */
  keyFn?: () => string;
  /** Called when a cache entry is evicted */
  onEvict?: (key: string, value: T) => void;
}

export interface CacheHandle {
  /** Number of entries currently in cache */
  readonly size: number;
  /** Invalidate a specific cache key */
  invalidate(key?: string): void;
  /** Clear all cache entries */
  clear(): void;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class FlowShieldError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'FlowShieldError';
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class TimeoutError extends FlowShieldError {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends FlowShieldError {
  constructor() {
    super('Circuit breaker is open — request rejected');
    this.name = 'CircuitOpenError';
  }
}

export class BulkheadRejectedError extends FlowShieldError {
  constructor() {
    super('Bulkhead capacity exceeded — request rejected');
    this.name = 'BulkheadRejectedError';
  }
}

export class RateLimitExceededError extends FlowShieldError {
  constructor() {
    super('Rate limit exceeded — request rejected');
    this.name = 'RateLimitExceededError';
  }
}

export class RetryExhaustedError extends FlowShieldError {
  public readonly attempts: number;
  constructor(attempts: number, lastError: unknown) {
    super(`All ${attempts} retry attempts exhausted`, lastError);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
  }
}
