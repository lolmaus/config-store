import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

class TestAdapter extends BaseAdapter {
  async read(): Promise<AdapterEnvelope> {
    return {config: {value: 'default'}, metadata: {dataVersion: 1, schemaVersion: 1}};
  }

  async write(nextConfig: unknown, metadata: ManagerMetadata): Promise<AdapterEnvelope> {
    return {config: nextConfig, metadata};
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
      assert.deepStrictEqual(
        readResult,
        {config: {value: 'default'}, metadata: {dataVersion: 1, schemaVersion: 1}},
        m
      );

      // Validating write()
      // Now we pass a valid object and partial object
      const writeResult = await adapter.write(
        {value: 'new-val'},
        {dataVersion: 2, schemaVersion: 1}
      );

      m = 'Write should return the defined write result';
      assert.deepStrictEqual(
        writeResult,
        {config: {value: 'new-val'}, metadata: {dataVersion: 2, schemaVersion: 1}},
        m
      );
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
      assert.match(args?.[0] as string, /\[@config-store\] Write failed/, m);

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
