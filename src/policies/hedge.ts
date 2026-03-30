import type { HedgeOptions } from '../types.js';
import { assertPositive } from '../utils.js';

const DEFAULTS = {
  hedgeDelay: 2000,
};

/**
 * Creates a hedge policy that sends a parallel (hedged) request if the
 * primary request doesn't resolve within the configured delay.
 * The first request to resolve wins; the other's result is discarded.
 *
 * @example
 * ```ts
 * const result = await hedge({ hedgeDelay: 1000 })(
 *   () => fetch('/api/data').then(r => r.json()),
 * );
 * ```
 */
export function hedge(options: HedgeOptions = {}) {
  const hedgeDelay = options.hedgeDelay ?? DEFAULTS.hedgeDelay;

  assertPositive(hedgeDelay, 'hedgeDelay');

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let primaryDone = false;
      let hedgeDone = false;
      let primaryError: unknown;
      let hedgeLaunched = false;

      const trySettle = (value: T) => {
        if (!settled) {
          settled = true;
          clearTimeout(hedgeTimer);
          resolve(value);
        }
      };

      const tryRejectBoth = () => {
        if (primaryDone && hedgeDone && !settled) {
          settled = true;
          reject(primaryError);
        }
      };

      const doLaunchHedge = () => {
        hedgeLaunched = true;
        const hedgeRequest = fn();
        hedgeRequest.then(trySettle, (_hedgeErr: unknown) => {
          hedgeDone = true;
          if (!primaryDone && !settled) {
            return;
          }
          tryRejectBoth();
        });
      };

      // Primary request
      const primary = fn();
      primary.then(trySettle, (err: unknown) => {
        primaryDone = true;
        primaryError = err;

        if (!hedgeLaunched) {
          clearTimeout(hedgeTimer);
          doLaunchHedge();
        }

        tryRejectBoth();
      });

      // Schedule hedged request
      const hedgeTimer = setTimeout(() => {
        if (!settled) {
          doLaunchHedge();
        }
      }, hedgeDelay);
    });
  };
}
