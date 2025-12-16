import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, AdapterWriteResult} from '../types.js';

// Define a simple object shape for testing
interface TestData {
  value: string;
}

// 1. Create a concrete implementation for testing
class TestAdapter extends BaseAdapter<TestData, number> {
  async read(): Promise<AdapterEnvelope<TestData, number>> {
    return {settings: {value: 'default'}, metadata: 1};
  }

  async write(
    settings: TestData,
    _changes: Partial<TestData>,
    metadata?: number
  ): Promise<AdapterWriteResult<TestData, number>> {
    return {settings, metadata};
  }
}

describe('BaseAdapter', () => {
  let adapter: TestAdapter;
  let m: string;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('Contract Implementation', () => {
    it('allows a concrete class to implement the Envelope pattern', async () => {
      // Validating read()
      const readResult = await adapter.read();
      m = 'Read should return the defined envelope';
      assert.deepStrictEqual(readResult, {settings: {value: 'default'}, metadata: 1}, m);

      // Validating write()
      // Now we pass a valid object and partial object
      const writeResult = await adapter.write({value: 'new-val'}, {}, 2);

      m = 'Write should return the defined write result';
      assert.deepStrictEqual(writeResult, {settings: {value: 'new-val'}, metadata: 2}, m);
    });
  });

  describe('onWriteError()', () => {
    it('logs errors to console.error by default', (t) => {
      const consoleSpy = t.mock.method(console, 'error', () => {});
      const error = new Error('Test Error');

      adapter.onWriteError(error);

      m = 'Should call console.error once';
      assert.strictEqual(consoleSpy.mock.callCount(), 1, m);

      const args = consoleSpy.mock.calls[0]?.arguments;

      m = 'First arg should be a prefix string';
      assert.match(args?.[0] as string, /\[SettingsManager\]/, m);

      m = 'Second arg should be the error object';
      assert.strictEqual(args?.[1], error, m);
    });

    it('can be overridden by subclasses or instances', (t) => {
      const consoleSpy = t.mock.method(console, 'error', () => {});
      const error = new Error('Test Error');

      adapter.onWriteError = mock.fn();

      adapter.onWriteError(error);

      m = 'Console.error should NOT be called';
      assert.strictEqual(consoleSpy.mock.callCount(), 0, m);
    });
  });
});
