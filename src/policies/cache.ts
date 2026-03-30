import type { CacheOptions, CacheHandle } from '../types.js';
import { assertPositive } from '../utils.js';

const DEFAULTS = {
  ttl: 60_000,
  staleWhileRevalidate: false,
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  stale: boolean;
}

/**
 * Creates a TTL-based cache policy that memoizes the result of the wrapped
 * async operation. Supports stale-while-revalidate for background refresh.
 *
 * Returns an object with `execute` (the policy function) and `handle`
 * (an interface to inspect / invalidate the cache).
 *
 * @example
 * ```ts
 * const c = cache({ ttl: 10_000 });
 * const result = await c.execute(() => fetch('/api/data').then(r => r.json()));
 * ```
 */
export function cache<V = unknown>(options: CacheOptions<V> = {}): {
  execute: <T extends V>(fn: () => Promise<T>) => Promise<T>;
  handle: CacheHandle;
} {
  const ttl = options.ttl ?? DEFAULTS.ttl;
  const staleWhileRevalidate = options.staleWhileRevalidate ?? DEFAULTS.staleWhileRevalidate;
  const keyFn = options.keyFn ?? (() => 'default');
  const onEvict = options.onEvict;

  assertPositive(ttl, 'ttl');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = new Map<string, CacheEntry<any>>();

  function evict(key: string): void {
    const entry = store.get(key);
    if (entry) {
      store.delete(key);
      onEvict?.(key, entry.value);
    }
  }

  const handle: CacheHandle = {
    get size() {
      return store.size;
    },
    invalidate(key?: string) {
      if (key !== undefined) {
        evict(key);
      } else {
        // Invalidate default key
        evict(keyFn());
      }
    },
    clear() {
      if (onEvict) {
        for (const [k, v] of store) {
          onEvict(k, v.value);
        }
      }
      store.clear();
    },
  };

  async function execute<T extends V>(fn: () => Promise<T>): Promise<T> {
    const key = keyFn();
    const now = Date.now();
    const entry = store.get(key) as CacheEntry<T> | undefined;

    if (entry) {
      if (now < entry.expiresAt) {
        // Fresh cache hit
        return entry.value;
      }

      if (staleWhileRevalidate && !entry.stale) {
        // Return stale value and revalidate in background
        entry.stale = true;
        fn()
          .then((value) => {
            store.set(key, {
              value,
              expiresAt: Date.now() + ttl,
              stale: false,
            });
          })
          .catch(() => {
            // Revalidation failed — keep stale value, lift stale flag
            // so next request tries again
            entry.stale = false;
          });
        return entry.value;
      }

      // Expired and not SWR — evict and re-fetch
      evict(key);
    }

    const value = await fn();
    store.set(key, {
      value,
      expiresAt: now + ttl,
      stale: false,
    });
    return value;
  }

  return { execute, handle };
}
