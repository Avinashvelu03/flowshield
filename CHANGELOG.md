# Changelog

## [1.0.0] - 2026-03-30

### 🎉 Initial Release

#### Policies
- **Retry** — Exponential, linear, constant, and decorrelated jitter backoff strategies. Supports `shouldRetry` predicates, `onRetry` callbacks, and `AbortSignal` cancellation.
- **Circuit Breaker** — Closed/open/half-open state machine with configurable failure/success thresholds, reset timeout, and event callbacks (`onOpen`, `onClose`, `onHalfOpen`).
- **Timeout** — AbortSignal-based timeout with configurable deadline in milliseconds.
- **Bulkhead** — Semaphore-based concurrency limiter with configurable max concurrent executions and queue size.
- **Fallback** — Type-safe fallback values or async fallback functions with `shouldFallback` predicate.
- **Rate Limiter** — Token bucket algorithm with configurable tokens per interval, reject-on-limit mode, and manual reset.
- **Hedge** — Hedged requests pattern — sends a parallel request after a configurable delay; first to resolve wins.
- **Cache** — TTL-based memoization with stale-while-revalidate, custom key generation, and eviction callbacks.

#### Composition
- **`pipe(...policies)`** — Compose policies left-to-right (outermost first).
- **`wrap(outer, inner)`** — Nest an inner policy within an outer policy.

#### Error Types
- `FlowShieldError` — Base error class with cause support.
- `TimeoutError`, `CircuitOpenError`, `BulkheadRejectedError`, `RateLimitExceededError`, `RetryExhaustedError`.

#### Infrastructure
- Zero dependencies.
- Dual ESM/CJS output with TypeScript declarations.
- 100% test coverage (statements, branches, functions, lines).
- Tree-shakable — only import what you use.
- Node.js ≥ 18.0.0, compatible with Bun, Deno, and edge runtimes.
