import type { Policy } from './types.js';

/**
 * Composes multiple policies into a single policy.
 * Policies are applied **left-to-right** (outermost first).
 *
 * `pipe(a, b, c)(fn)` is equivalent to `a(()=> b(()=> c(fn)))`.
 *
 * @example
 * ```ts
 * const resilient = pipe(
 *   timeout({ ms: 5000 }),
 *   retry({ maxAttempts: 3 }),
 * );
 * const result = await resilient(() => fetch('/api'));
 * ```
 */
export function pipe(...policies: Policy[]): Policy {
  if (policies.length === 0) {
    return <T>(fn: () => Promise<T>) => fn();
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    // Build from right to left: the innermost policy wraps fn directly
    let composed: () => Promise<T> = fn;

    for (let i = policies.length - 1; i >= 0; i--) {
      const policy = policies[i];
      const next = composed;
      composed = () => policy(next);
    }

    return composed();
  };
}

/**
 * Wraps an inner policy with an outer policy.
 * `wrap(outer, inner)(fn)` is equivalent to `outer(() => inner(fn))`.
 *
 * @example
 * ```ts
 * const policy = wrap(
 *   timeout({ ms: 5000 }),
 *   retry({ maxAttempts: 3 }),
 * );
 * const result = await policy(() => fetch('/api'));
 * ```
 */
export function wrap(outer: Policy, inner: Policy): Policy {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return outer(() => inner(fn));
  };
}
