/**
 * Sleep for `ms` milliseconds. Supports cooperative cancellation via AbortSignal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    let done = false;

    const timer = setTimeout(() => {
      done = true;
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(signal!.reason);
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Calculate the delay for a given attempt using the specified backoff strategy.
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  strategy: 'constant' | 'linear' | 'exponential' | 'decorrelatedJitter',
  maxDelay: number,
  previousDelay?: number,
): number {
  let delay: number;

  switch (strategy) {
    case 'constant':
      delay = baseDelay;
      break;
    case 'linear':
      delay = baseDelay * attempt;
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt - 1);
      break;
    case 'decorrelatedJitter': {
      const prev = previousDelay ?? baseDelay;
      delay = Math.random() * (prev * 3 - baseDelay) + baseDelay;
      break;
    }
  }

  return Math.min(delay, maxDelay);
}

/**
 * Validate that a number is a positive integer.
 */
export function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 1 || Math.floor(value) !== value) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

/**
 * Validate that a number is a positive finite number.
 */
export function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number, got ${value}`);
  }
}

/**
 * Validate that a number is a non-negative finite number.
 */
export function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number, got ${value}`);
  }
}
