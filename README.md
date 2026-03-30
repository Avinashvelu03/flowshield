# FlowShield

> **Zero-dependency, TypeScript-first resilience & fault-tolerance toolkit.**

[![npm version](https://img.shields.io/npm/v/flowshield.svg)](https://www.npmjs.com/package/flowshield)
[![npm downloads](https://img.shields.io/npm/dm/flowshield.svg)](https://www.npmjs.com/package/flowshield)
[![license](https://img.shields.io/npm/l/flowshield.svg)](https://github.com/Avinashvelu03/flowshield/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Avinashvelu03/flowshield)

Composable fault-tolerance policies for any async operation. Ship resilient microservices, API clients, and distributed systems with **retry**, **circuit breaker**, **timeout**, **bulkhead**, **fallback**, **rate limiter**, **hedge**, and **cache** — all in a lightweight, tree-shakable package.

---

## ✨ Features

- 🔁 **Retry** — Exponential backoff, jitter, configurable strategies
- ⚡ **Circuit Breaker** — Half-open/open/closed with auto-recovery
- ⏱️ **Timeout** — AbortSignal-based deadlines
- 🚧 **Bulkhead** — Concurrency limiting (semaphore pattern)
- 🛡️ **Fallback** — Type-safe fallback chains
- 🚦 **Rate Limiter** — Token bucket algorithm
- 🏎️ **Hedge** — Hedged (parallel) requests for latency reduction
- 💾 **Cache** — TTL-based memoization with stale-while-revalidate
- 🔗 **Composable** — Chain any policies together with `pipe()` or `wrap()`
- 📦 **Zero dependencies** — No supply chain risk
- 🌳 **Tree-shakable** — Only pay for what you use
- 🌐 **Edge-ready** — Works in Node.js, Bun, Deno, Cloudflare Workers
- 🎯 **100% test coverage** — Statements, branches, functions, lines

## 📦 Installation

```bash
npm install flowshield
```

```bash
yarn add flowshield
```

```bash
pnpm add flowshield
```

## 🚀 Quick Start

```typescript
import { retry, circuitBreaker, timeout, pipe } from 'flowshield';

// Simple retry with exponential backoff
const data = await retry({ maxAttempts: 3, backoff: 'exponential' })(
  () => fetch('/api/data').then(r => r.json()),
);

// Compose multiple policies
const resilientFetch = pipe(
  timeout({ ms: 5000 }),
  retry({ maxAttempts: 3, backoff: 'exponential' }),
);

const result = await resilientFetch(() => fetch('/api/data'));
```

---

## 📖 API Reference

### Retry

Re-executes a failed operation with configurable backoff strategies.

```typescript
import { retry } from 'flowshield';

const result = await retry({
  maxAttempts: 5,           // Default: 3
  delay: 200,               // Base delay in ms. Default: 200
  backoff: 'exponential',   // 'constant' | 'linear' | 'exponential' | 'decorrelatedJitter'
  maxDelay: 30000,          // Cap delay at 30s. Default: 30000
  shouldRetry: (err, attempt) => attempt < 3,  // Conditional retry
  onRetry: (err, attempt, delay) => console.log(`Retry ${attempt} in ${delay}ms`),
  signal: controller.signal, // AbortSignal for cancellation
})(
  () => fetch('/api/data'),
);
```

### Circuit Breaker

Prevents calls to a failing service, allowing it time to recover.

```typescript
import { circuitBreaker } from 'flowshield';

const cb = circuitBreaker({
  failureThreshold: 5,    // Failures before opening. Default: 5
  successThreshold: 1,    // Successes in half-open to close. Default: 1
  resetTimeout: 30000,    // Time in open state before half-open. Default: 30000
  onOpen: () => console.log('Circuit opened!'),
  onClose: () => console.log('Circuit closed!'),
  onHalfOpen: () => console.log('Circuit half-open...'),
});

const result = await cb.execute(() => fetch('/api/health'));
console.log(cb.handle.state); // 'closed' | 'open' | 'half-open'
cb.handle.reset();             // Manually reset
```

### Timeout

Rejects if an operation doesn't complete within a deadline.

```typescript
import { timeout } from 'flowshield';

const result = await timeout({ ms: 5000 })(
  () => fetch('/api/slow-endpoint'),
);
// Throws TimeoutError if not resolved within 5 seconds
```

### Bulkhead

Limits concurrent executions to prevent resource exhaustion.

```typescript
import { bulkhead } from 'flowshield';

const bh = bulkhead({
  maxConcurrent: 10,  // Max parallel executions. Default: 10
  maxQueue: 100,      // Max queued requests. Default: 0 (no queue)
});

const result = await bh.execute(() => fetch('/api/data'));
console.log(bh.handle.running); // Current active count
console.log(bh.handle.queued);  // Current queue size
```

### Fallback

Returns a fallback value when an operation fails.

```typescript
import { fallback } from 'flowshield';

// Static fallback
const result = await fallback({ fallback: [] })(
  () => fetch('/api/items').then(r => r.json()),
);

// Dynamic fallback
const result2 = await fallback({
  fallback: async (error) => fetchFromCache(error),
  shouldFallback: (err) => err instanceof NetworkError,
})(
  () => fetch('/api/data'),
);
```

### Rate Limiter

Controls how many operations can execute within a time window.

```typescript
import { rateLimiter } from 'flowshield';

const rl = rateLimiter({
  tokensPerInterval: 10,  // Requests per interval. Default: 10
  interval: 1000,         // Interval in ms. Default: 1000
  rejectOnLimit: false,   // Queue or reject. Default: false (queue)
});

const result = await rl.execute(() => fetch('/api/data'));
console.log(rl.handle.availableTokens); // Check remaining tokens
rl.handle.reset();                       // Reset the bucket
```

### Hedge

Sends a parallel request if the primary is too slow — first to resolve wins.

```typescript
import { hedge } from 'flowshield';

const result = await hedge({ hedgeDelay: 2000 })(
  () => fetch('/api/data').then(r => r.json()),
);
// If primary doesn't resolve in 2s, a second request is sent.
// The fastest response wins.
```

### Cache

Memoizes async operation results with TTL and stale-while-revalidate support.

```typescript
import { cache } from 'flowshield';

const c = cache({
  ttl: 60000,                    // Time-to-live in ms. Default: 60000
  staleWhileRevalidate: true,    // Return stale, refresh in background
  keyFn: () => 'custom-key',    // Custom cache key
  onEvict: (key, value) => {},   // Eviction callback
});

const result = await c.execute(() => fetch('/api/data').then(r => r.json()));
c.handle.invalidate('custom-key'); // Invalidate specific key
c.handle.clear();                   // Clear all
```

### Composing Policies

Combine multiple policies with `pipe()` (left-to-right) or `wrap()`.

```typescript
import { pipe, wrap, retry, timeout, circuitBreaker, fallback } from 'flowshield';

// pipe: policies applied left-to-right (outermost first)
const resilient = pipe(
  timeout({ ms: 10000 }),
  retry({ maxAttempts: 3, backoff: 'exponential' }),
);

const data = await resilient(() => fetch('/api/data'));

// wrap: explicit outer/inner nesting
const policy = wrap(
  timeout({ ms: 5000 }),
  retry({ maxAttempts: 3 }),
);
```

---

## 🛡️ Error Types

FlowShield provides typed errors for each failure mode:

```typescript
import {
  FlowShieldError,       // Base error class
  TimeoutError,          // Operation timed out
  CircuitOpenError,      // Circuit breaker is open
  BulkheadRejectedError, // Bulkhead capacity exceeded
  RateLimitExceededError, // Rate limit exceeded
  RetryExhaustedError,   // All retry attempts failed
} from 'flowshield';

try {
  await resilientFetch(() => fetch('/api'));
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof CircuitOpenError) {
    // Handle circuit open
  } else if (error instanceof RetryExhaustedError) {
    console.log(`Failed after ${error.attempts} attempts`);
    console.log(`Last error:`, error.cause);
  }
}
```

---

## 🔧 Requirements

- **Node.js** ≥ 18.0.0
- **TypeScript** ≥ 5.0 (for type inference)

## 📄 License

[MIT](./LICENSE) © [Avinash Velu](https://github.com/Avinashvelu03)
