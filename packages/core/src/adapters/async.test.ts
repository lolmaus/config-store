import {describe, it, mock, beforeEach, afterEach, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncAdapter, type AsyncAdapterOptions} from './async.js';
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

interface TestConfig {
  theme: 'light' | 'dark';
  volume: number;
}

describe('AsyncAdapter', () => {
  let m: string;
  let adapter: AsyncAdapter;

  // Mock Definitions
  let readMock: Mock<AsyncAdapterOptions['read']>;
  let writeMock: Mock<AsyncAdapterOptions['write']>;

  // In-Memory Store State (Closure)
  let storedConfig: TestConfig;
  let storedMeta: ManagerMetadata;

  beforeEach(() => {
    // 1. Initialize State
    storedConfig = {theme: 'light', volume: 50};
    storedMeta = {dataVersion: 1, schemaVersion: 1};

    // 2. Mock Read: Returns the current closure state
    readMock = mock.fn(async () => ({
      config: storedConfig,
      metadata: storedMeta,
    }));

    // 3. Mock Write: Updates the closure state
    // We use ...args to capture all arguments while allowing us to destructure the first ones
    writeMock = mock.fn(async (next) => {
      // Simulate server persistence
      storedConfig = next as TestConfig;

      // Simulate version bump
      storedMeta = {
        ...storedMeta,
        dataVersion: storedMeta.dataVersion + 1,
      };

      return {config: next, metadata: storedMeta};
    });

    adapter = new AsyncAdapter({
      read: readMock,
      write: writeMock,
    });
  });

  afterEach(() => {
    mock.reset();
  });

  describe('read()', () => {
    it('calls the user-provided read function', async () => {
      await adapter.read();

      m = 'Should call the read implementation exactly once';
      assert.strictEqual(readMock.mock.callCount(), 1, m);
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

      m = 'Should reject with the error thrown by the read implementation';
      await assert.rejects(() => adapter.read(), error, m);
    });
  });

  describe('write() — Metadata', () => {
    it('passes metadata to the write function as the 3rd argument', async () => {
      const config: TestConfig = {theme: 'dark', volume: 50};
      const metadata: ManagerMetadata = {dataVersion: 1, schemaVersion: 1};

      await adapter.write(config, metadata);

      m = 'Write mock should be called once';
      assert.strictEqual(writeMock.mock.callCount(), 1, m);

      const args = writeMock.mock.calls[0]?.arguments;

      m = '3rd argument should be the metadata object';
      assert.deepStrictEqual(args?.[2], metadata, m);
    });

    it('returns the WriteResult from the user function', async () => {
      // Logic:
      // Initial version = 1.
      // write() is called.
      // Mock increments version to 2.
      // Mock returns { metadata: { dataVersion: 2 ... } }

      const result = await adapter.write(
        {theme: 'dark', volume: 50},
        {dataVersion: 1, schemaVersion: 1}
      );

      m = 'Should return the exact object provided by writeMock';
      assert.deepStrictEqual(
        result,
        {
          config: {
            theme: 'dark',
            volume: 50,
          },
          metadata: {dataVersion: 2, schemaVersion: 1},
        },
        m
      );

      m = 'Closure state should have been updated';
      assert.deepStrictEqual(storedConfig, {theme: 'dark', volume: 50}, m);
    });
  });

  describe('write() — Concurrency: "abort" (default)', () => {
    it('passes a valid AbortSignal as the 4th argument', async () => {
      await adapter.write({theme: 'dark', volume: 50}, {dataVersion: 1, schemaVersion: 1});

      const args = writeMock.mock.calls[0]?.arguments;
      const signal = args?.[3];

      m = '4th argument should be an instance of AbortSignal';
      assert.ok(signal instanceof AbortSignal, m);

      m = 'Signal should not be aborted initially';
      assert.strictEqual(signal.aborted, false, m);
    });

    it('aborts the previous pending request signal', async () => {
      let resolveFirst: ((value: AdapterEnvelope) => void) | undefined;

      const slowMock: Mock<AsyncAdapterOptions['write']> = mock.fn(async () => {
        if (!resolveFirst) {
          return new Promise<AdapterEnvelope>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(undefined);
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
      });

      // Req A
      const p1 = adapter.write({theme: 'light', volume: 1}, {dataVersion: 1, schemaVersion: 1});

      const callA = slowMock.mock.calls[0];
      m = 'Request A should have been called';
      assert.ok(callA, m);

      const argsA = callA.arguments;
      const signalA = argsA[3];

      if (!signalA) {
        throw new Error('Signal A is undefined');
      }

      m = 'Signal A should not be aborted immediately';
      assert.strictEqual(signalA.aborted, false, m);

      // Req B
      const p2 = adapter.write({theme: 'light', volume: 2}, {dataVersion: 2, schemaVersion: 1});

      m = 'Signal A should be aborted after second write call';
      assert.strictEqual(signalA.aborted, true, m);

      if (resolveFirst)
        resolveFirst({
          config: {theme: 'light', volume: 1},
          metadata: {dataVersion: 2, schemaVersion: 1},
        });
      await p1;
      await p2;
    });

    it('suppresses AbortErrors', async () => {
      const abortMock: Mock<AsyncAdapterOptions['write']> = mock.fn(async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: abortMock,
      });

      const p = adapter.write({theme: 'light', volume: 1}, {dataVersion: 1, schemaVersion: 1});

      m = 'Should not reject the promise when AbortError occurs';
      await assert.doesNotReject(p, m);
    });
  });

  describe('write() — Concurrency: "sequential"', () => {
    it('queues requests and passes correct metadata to each', async () => {
      let resolveFirst: (() => void) | undefined;

      const slowMock: Mock<AsyncAdapterOptions['write']> = mock.fn(async () => {
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
        concurrency: 'sequential',
      });

      // Req A
      const p1 = adapter.write({theme: 'light', volume: 1}, {dataVersion: 1, schemaVersion: 1});
      await new Promise((r) => setImmediate(r));

      // Req B
      const p2 = adapter.write({theme: 'light', volume: 2}, {dataVersion: 2, schemaVersion: 1});
      await new Promise((r) => setImmediate(r));

      // Check Req A Metadata
      const call1 = slowMock.mock.calls[0];
      m = 'First request should be called';
      assert.ok(call1, m);

      const args1 = call1.arguments;
      m = 'First request should have correct metadata';
      assert.deepStrictEqual(args1[2], {dataVersion: 1, schemaVersion: 1}, m);

      if (resolveFirst) resolveFirst();
      await p1;
      await p2;

      // Check Req B Metadata
      const call2 = slowMock.mock.calls[1];
      m = 'Second request should be called';
      assert.ok(call2, m);

      const args2 = call2.arguments;
      m = 'Second request should have correct metadata';
      assert.deepStrictEqual(args2[2], {dataVersion: 2, schemaVersion: 1}, m);
    });
  });

  describe('Error Handling', () => {
    it('calls custom onReadError when read fails', async () => {
      const error = new Error('Read failed');
      const failMock = mock.fn(async () => {
        throw error;
      });
      const onErrorMock = mock.fn();

      adapter = new AsyncAdapter({
        read: failMock,
        write: writeMock,
        onReadError: onErrorMock,
      });

      const p = adapter.read();

      m = 'Should propagate the write error to the caller';
      await assert.rejects(p, error, m);

      m = 'Should call onReadError hook exactly once';
      assert.strictEqual(onErrorMock.mock.callCount(), 1, m);
    });

    it('calls custom onWriteError when write fails', async () => {
      const error = new Error('Save failed');
      const failMock = mock.fn(async () => {
        throw error;
      });
      const onErrorMock = mock.fn();

      adapter = new AsyncAdapter({
        read: readMock,
        write: failMock,
        onWriteError: onErrorMock,
      });

      const p = adapter.write({theme: 'light', volume: 1}, {dataVersion: 1, schemaVersion: 1});

      m = 'Should propagate the write error to the caller';
      await assert.rejects(p, error, m);

      m = 'Should call onWriteError hook exactly once';
      assert.strictEqual(onErrorMock.mock.callCount(), 1, m);
    });
  });

  describe('Data Integrity vs Diffing Strategies', () => {
    // Shared Server State for these tests
    let serverState: TestConfig;

    beforeEach(() => {
      serverState = {theme: 'light', volume: 50};
    });

    it('Scenario: "Abort" strategy corrupts data by dropping aborted changes', async () => {
      // 1. Setup a "User" write function that calculates DIFFS
      const diffPatchMock = mock.fn(
        async (next: unknown, prev: unknown, _m?: ManagerMetadata, signal?: AbortSignal) => {
          // Explicit typing for test logic
          const n = next as TestConfig;
          const p = prev as TestConfig;
          const patch: Partial<TestConfig> = {};

          // Calculate Diff
          if (n.theme !== p.theme) patch.theme = n.theme;
          if (n.volume !== p.volume) patch.volume = n.volume;

          // Simulate Network Latency to ensure Abort signal has time to fire
          await new Promise((resolve) => setTimeout(resolve, 20));

          if (signal?.aborted) return; // Respect the abort

          // Apply Patch to Server
          serverState = {...serverState, ...patch};
        }
      );

      adapter = new AsyncAdapter({
        read: readMock,
        write: diffPatchMock,
        concurrency: 'abort', // Default
      });

      // Initialize the adapter (Smart Adapter reads server state)
      await adapter.read();

      // 2. Action: Change Theme (Req A)
      const p1 = adapter.write({theme: 'dark', volume: 50}, {dataVersion: 1, schemaVersion: 1});

      // 3. Action: Change Volume (Req B) - Fired immediately after
      const p2 = adapter.write({theme: 'dark', volume: 100}, {dataVersion: 2, schemaVersion: 1});

      await Promise.allSettled([p1, p2]);

      // 4. Assertion
      m = 'Corruption: Theme change should persist even if Req A was aborted';
      assert.deepStrictEqual(serverState, {theme: 'dark', volume: 100}, m);
    });

    it('Scenario: "Queue" strategy corrupts data if a previous request fails', async () => {
      let callCount = 0;
      const errorSpy = mock.fn();

      const diffPatchMock = mock.fn(async (next: unknown, prev: unknown) => {
        callCount++;

        // First attempt fails (Network Error)
        if (callCount === 1) throw new Error('Network Glitch');

        const n = next as TestConfig;
        const p = prev as TestConfig;
        const patch: Partial<TestConfig> = {};

        if (n.theme !== p.theme) patch.theme = n.theme;
        if (n.volume !== p.volume) patch.volume = n.volume;

        serverState = {...serverState, ...patch};
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: diffPatchMock,
        concurrency: 'sequential',
        onWriteError: errorSpy,
      });

      await adapter.read();

      // 2. Action: Change Theme (Req A) -> Will Fail
      const p1 = adapter
        .write({theme: 'dark', volume: 50}, {dataVersion: 1, schemaVersion: 1})
        .catch(() => {}); // Swallow the expected error for the test flow

      // 3. Action: Change Volume (Req B) -> Will Succeed
      const p2 = adapter.write({theme: 'dark', volume: 100}, {dataVersion: 2, schemaVersion: 1});

      await Promise.all([p1, p2]);

      m = 'Corruption: Theme change should be picked up by Req B even if Req A failed';
      assert.deepStrictEqual(serverState, {theme: 'dark', volume: 100}, m);

      m = 'Should have caught exactly one write error (from Req A)';
      assert.strictEqual(errorSpy.mock.callCount(), 1, m);
    });
  });
});
