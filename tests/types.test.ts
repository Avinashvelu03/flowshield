import { describe, it, expect } from 'vitest';
import {
  FlowShieldError,
  TimeoutError,
  CircuitOpenError,
  BulkheadRejectedError,
  RateLimitExceededError,
  RetryExhaustedError,
} from '../src/types';

describe('error types', () => {
  it('FlowShieldError should have correct name and message', () => {
    const err = new FlowShieldError('test');
    expect(err.name).toBe('FlowShieldError');
    expect(err.message).toBe('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FlowShieldError);
  });

  it('FlowShieldError should carry cause', () => {
    const cause = new Error('root');
    const err = new FlowShieldError('wrapper', cause);
    expect(err.cause).toBe(cause);
  });

  it('TimeoutError should have correct name and message', () => {
    const err = new TimeoutError(5000);
    expect(err.name).toBe('TimeoutError');
    expect(err.message).toBe('Operation timed out after 5000ms');
    expect(err).toBeInstanceOf(FlowShieldError);
    expect(err).toBeInstanceOf(TimeoutError);
  });

  it('CircuitOpenError should have correct name', () => {
    const err = new CircuitOpenError();
    expect(err.name).toBe('CircuitOpenError');
    expect(err).toBeInstanceOf(FlowShieldError);
    expect(err).toBeInstanceOf(CircuitOpenError);
  });

  it('BulkheadRejectedError should have correct name', () => {
    const err = new BulkheadRejectedError();
    expect(err.name).toBe('BulkheadRejectedError');
    expect(err).toBeInstanceOf(FlowShieldError);
    expect(err).toBeInstanceOf(BulkheadRejectedError);
  });

  it('RateLimitExceededError should have correct name', () => {
    const err = new RateLimitExceededError();
    expect(err.name).toBe('RateLimitExceededError');
    expect(err).toBeInstanceOf(FlowShieldError);
    expect(err).toBeInstanceOf(RateLimitExceededError);
  });

  it('RetryExhaustedError should have correct name and attempts', () => {
    const cause = new Error('last');
    const err = new RetryExhaustedError(5, cause);
    expect(err.name).toBe('RetryExhaustedError');
    expect(err.attempts).toBe(5);
    expect(err.cause).toBe(cause);
    expect(err.message).toBe('All 5 retry attempts exhausted');
    expect(err).toBeInstanceOf(FlowShieldError);
    expect(err).toBeInstanceOf(RetryExhaustedError);
  });
});
