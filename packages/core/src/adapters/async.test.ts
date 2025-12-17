import {describe, it, mock, beforeEach, afterEach, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncAdapter, type AsyncAdapterOptions} from './async.js';
import type {AdapterWriteResult, Meta} from '../types.js';

interface TestConfig {
  theme: 'light' | 'dark';
  volume: number;
}

// Helper type to fix the tuple indexing errors
type WriteArgs = Parameters<AsyncAdapterOptions['write']>;

describe('AsyncAdapter', () => {
  let m: string;
  let adapter: AsyncAdapter<TestConfig>;

  // Mock Definitions
  let readMock: Mock<AsyncAdapterOptions['read']>;
  let writeMock: Mock<AsyncAdapterOptions['write']>;

  beforeEach(() => {
    mock.timers.enable({apis: ['setTimeout']});

    // 1. Mock Read
    readMock = mock.fn(async () => ({
      config: {theme: 'light', volume: 50},
      metadata: {dataVersion: 1, schemaVersion: 1},
    }));

    // 2. Mock Write
    writeMock = mock.fn(async () => ({metadata: {dataVersion: 2, schemaVersion: 1}}));

    adapter = new AsyncAdapter({
      read: readMock,
      write: writeMock,
      debounceMs: 100,
    });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  describe('read()', () => {
    it('calls the user-provided read function', async () => {
      await adapter.read();
      assert.strictEqual(readMock.mock.callCount(), 1);
    });

    it('returns the envelope resolved by the read function', async () => {
      const result = await adapter.read();

      m = 'Result matches the mocked read return value';
      assert.deepStrictEqual(
        result,
        {
          config: {theme: 'light', volume: 50},
          metadata: {dataVersion: 1, schemaVersion: 1},
        },
        m
      );
    });

    it('propagates errors from the read function', async () => {
      const error = new Error('Network error');
      const failMock = mock.fn(async () => {
        throw error;
      });

      adapter = new AsyncAdapter({read: failMock, write: writeMock});

      await assert.rejects(() => adapter.read(), error);
    });
  });

  describe('write() — Debouncing & Metadata', () => {
    it('passes metadata to the write function as the 3rd argument', async () => {
      const config: TestConfig = {theme: 'dark', volume: 50};
      const metadata: Meta = {dataVersion: 1, schemaVersion: 1};

      const promise = adapter.write(config, {theme: 'dark'}, metadata);

      mock.timers.tick(150);
      await promise;

      m = 'Write mock should be called once';
      assert.strictEqual(writeMock.mock.callCount(), 1, m);

      const args = writeMock.mock.calls[0]?.arguments as WriteArgs;

      m = '3rd argument should be the metadata';
      assert.deepStrictEqual(args[2], metadata, m);
    });

    it('returns the WriteResult from the user function', async () => {
      const result = await new Promise((resolve) => {
        adapter
          .write({theme: 'dark', volume: 50}, {}, {dataVersion: 1, schemaVersion: 1})
          .then(resolve);
        mock.timers.tick(150);
      });

      m = 'Should return the object provided by writeMock';
      assert.deepStrictEqual(result, {metadata: {dataVersion: 2, schemaVersion: 1}}, m);
    });
  });

  describe('write() — Concurrency: "abort" (default)', () => {
    it('passes a valid AbortSignal as the 4th argument', async () => {
      const promise = adapter.write(
        {theme: 'dark', volume: 50},
        {theme: 'dark'},
        {dataVersion: 1, schemaVersion: 1}
      );

      mock.timers.tick(150);
      await promise;

      const args = writeMock.mock.calls[0]?.arguments as WriteArgs;
      const signal = args[3];

      m = '4th argument should be an AbortSignal';
      assert.ok(signal instanceof AbortSignal, m);
      assert.strictEqual(signal.aborted, false, m);
    });

    it('aborts the previous pending request signal', async () => {
      let resolveFirst: ((value: AdapterWriteResult) => void) | undefined;

      const slowMock = mock.fn(async () => {
        if (!resolveFirst) {
          return new Promise<AdapterWriteResult>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(undefined);
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
        debounceMs: 100,
      });

      // Req A
      const p1 = adapter.write({theme: 'light', volume: 1}, {}, {dataVersion: 1, schemaVersion: 1});
      mock.timers.tick(150);

      const callA = slowMock.mock.calls[0];
      assert.ok(callA, 'Request A should have been called');

      const argsA = callA.arguments as unknown as WriteArgs;
      const signalA = argsA[3] as AbortSignal; // Explicit cast for usage

      assert.strictEqual(signalA.aborted, false, 'Signal A not aborted yet');

      // Req B
      const p2 = adapter.write({theme: 'light', volume: 2}, {}, {dataVersion: 2, schemaVersion: 1});
      mock.timers.tick(100);

      assert.strictEqual(signalA.aborted, true, 'Signal A should be aborted');

      if (resolveFirst) resolveFirst({metadata: {dataVersion: 2, schemaVersion: 1}});
      await p1;
      await p2;
    });

    it('suppresses AbortErrors', async () => {
      const abortMock = mock.fn(async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: abortMock,
        debounceMs: 100,
      });

      const p = adapter.write({theme: 'light', volume: 1}, {}, {dataVersion: 1, schemaVersion: 1});
      mock.timers.tick(150);

      await assert.doesNotReject(p);
    });
  });

  describe('write() — Concurrency: "queue"', () => {
    it('queues requests and passes correct metadata to each', async () => {
      let resolveFirst: (() => void) | undefined;

      const slowMock = mock.fn(async () => {
        if (!resolveFirst) {
          return new Promise<void>((r) => {
            resolveFirst = r;
          });
        }
        return Promise.resolve();
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
        debounceMs: 100,
        concurrency: 'queue',
      });

      // Req A
      const p1 = adapter.write({theme: 'light', volume: 1}, {}, {dataVersion: 1, schemaVersion: 1});
      mock.timers.tick(150);
      await new Promise((r) => setImmediate(r));

      // Req B
      const p2 = adapter.write({theme: 'light', volume: 2}, {}, {dataVersion: 2, schemaVersion: 1});
      mock.timers.tick(100);
      await new Promise((r) => setImmediate(r));

      // Check Req A Metadata
      const call1 = slowMock.mock.calls[0];
      assert.ok(call1);

      const args1 = call1.arguments as unknown as WriteArgs;
      assert.deepStrictEqual(args1[2], {dataVersion: 1, schemaVersion: 1});

      if (resolveFirst) resolveFirst();
      await p1;
      await p2;

      // Check Req B Metadata
      const call2 = slowMock.mock.calls[1];
      assert.ok(call2);

      const args2 = call2.arguments as unknown as WriteArgs;
      assert.deepStrictEqual(args2[2], {dataVersion: 2, schemaVersion: 1});
    });
  });

  describe('write() — Concurrency: "optimistic"', () => {
    it('fires both requests immediately with their respective metadata', async () => {
      const slowMock = mock.fn(async () => Promise.resolve());

      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
        debounceMs: 10,
        concurrency: 'optimistic',
      });

      const p1 = adapter.write({theme: 'light', volume: 1}, {}, {dataVersion: 1, schemaVersion: 1});
      mock.timers.tick(20);

      const p2 = adapter.write({theme: 'light', volume: 2}, {}, {dataVersion: 2, schemaVersion: 1});
      mock.timers.tick(20);

      await Promise.all([p1, p2]);

      m = 'Both requests should fire';
      assert.strictEqual(slowMock.mock.callCount(), 2, m);

      const args1 = slowMock.mock.calls[0]?.arguments as unknown as WriteArgs;
      assert.deepStrictEqual(args1[2], {dataVersion: 1, schemaVersion: 1});

      const args2 = slowMock.mock.calls[1]?.arguments as unknown as WriteArgs;
      assert.deepStrictEqual(args2[2], {dataVersion: 2, schemaVersion: 1});
    });
  });

  describe('Error Handling', () => {
    it('calls onWriteError when write fails', async () => {
      const error = new Error('Save failed');
      const failMock = mock.fn(async () => {
        throw error;
      });
      const onErrorMock = mock.fn();

      adapter = new AsyncAdapter({
        read: readMock,
        write: failMock,
        onWriteError: onErrorMock,
        debounceMs: 10,
      });

      const p = adapter.write({theme: 'light', volume: 1}, {}, {dataVersion: 1, schemaVersion: 1});
      mock.timers.tick(10);

      await assert.rejects(p, error);
      assert.strictEqual(onErrorMock.mock.callCount(), 1);
    });
  });
});
