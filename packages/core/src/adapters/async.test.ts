import {describe, it, mock, beforeEach, afterEach, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncAdapter, type AsyncAdapterOptions} from './async.js';

// 1. Concrete interface for testing
interface TestSettings {
  theme: 'light' | 'dark';
  volume: number;
}

describe('AsyncAdapter', () => {
  let m: string; // Assertion message holder for readability.
  let adapter: AsyncAdapter<TestSettings>;

  // 2. Strict Mock Types
  // We use the exact function signatures from AsyncAdapterOptions
  let readMock: Mock<AsyncAdapterOptions<TestSettings>['read']>;
  let writeMock: Mock<AsyncAdapterOptions<TestSettings>['write']>;

  beforeEach(() => {
    // FIX: Remove 'clearTimeout'. Enabling 'setTimeout' handles clearing automatically.
    mock.timers.enable({apis: ['setTimeout']});

    // 3. Initialize Mocks
    // 'mock.fn' infers types, but we can verify conformity by assigning to typed variables
    readMock = mock.fn(async () => ({theme: 'light', volume: 50}));
    writeMock = mock.fn(async () => {});

    adapter = new AsyncAdapter({
      read: readMock,
      write: writeMock,
      debounceMs: 100, // Shortened for tests
    });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  describe('read()', () => {
    it('calls the user-provided read function', async () => {
      await adapter.read();

      m = 'Read callback call count';
      assert.strictEqual(readMock.mock.callCount(), 1, m);
    });

    it('returns the data resolved by the read function', async () => {
      const result = await adapter.read();

      m = 'Result matches the mocked read return value';
      assert.deepStrictEqual(result, {theme: 'light', volume: 50}, m);
    });

    it('propagates errors from the read function', async () => {
      const error = new Error('Network error');

      const failMock = mock.fn(async () => {
        throw error;
      });

      // Re-initialize adapter with failMock
      adapter = new AsyncAdapter({read: failMock, write: writeMock});

      m = 'Adapter should reject with the mock error';
      await assert.rejects(() => adapter.read(), error, m);
    });
  });

  describe('write() — Debouncing', () => {
    it('does not execute write immediately', async () => {
      const settings: TestSettings = {theme: 'dark', volume: 50};

      // Trigger write (returns void synchronously in this step)
      adapter.write(settings, {theme: 'dark'});

      // Assert writeMock hasn't been called yet
      m = 'Write mock should not be called immediately (0 count)';
      assert.strictEqual(writeMock.mock.callCount(), 0, m);
    });

    it('executes write after the debounce delay', async () => {
      const settings: TestSettings = {theme: 'dark', volume: 50};
      const promise = adapter.write(settings, {theme: 'dark'});

      mock.timers.tick(150);

      await promise;

      m = 'Write mock should be called once after debounce';
      assert.strictEqual(writeMock.mock.callCount(), 1, m);

      const args = writeMock.mock.calls[0]?.arguments;

      m = 'First argument should be the full settings object';
      assert.deepStrictEqual(args?.[0], settings, m);

      m = 'Second argument should be the changes object';
      assert.deepStrictEqual(args?.[1], {theme: 'dark'}, m);
    });

    it('cancels the previous timer and restarts if called twice rapidly', async () => {
      const settingsA: TestSettings = {theme: 'dark', volume: 50};
      const settingsB: TestSettings = {theme: 'dark', volume: 60};

      // 1. First write
      const promiseA = adapter.write(settingsA, {theme: 'dark'});

      // 2. Advance time partially (50ms of 100ms)
      mock.timers.tick(50);

      // 3. Second write (should cancel the first)
      const promiseB = adapter.write(settingsB, {volume: 60});

      // 4. Advance time to total 150ms complete the second debounce (at 100ms)
      mock.timers.tick(100);

      await promiseA; // This should resolve (it just didn't fire the network request)
      await promiseB;

      // Assert only 1 write happened (for the second call)
      m = 'Write mock should only be called once (debounced)';
      assert.strictEqual(writeMock.mock.callCount(), 1, m);

      const args = writeMock.mock.calls[0]?.arguments;

      m = 'First argument should be the latest settings (settingsB)';
      assert.deepStrictEqual(args?.[0], settingsB, m);
    });
  });

  describe('write() — Concurrency: "abort" (default)', () => {
    it('passes a valid AbortSignal to the write function', async () => {
      const settings: TestSettings = {theme: 'dark', volume: 50};
      const promise = adapter.write(settings, {theme: 'dark'});

      // Fast-forward debounce
      mock.timers.tick(150);
      await promise;

      // Check the 3rd argument (signal)
      // mock.calls is typed as generic arrays, so we validate safely
      const args = writeMock.mock.calls[0]?.arguments;
      const signal = args?.[2];

      m = 'Third argument should be an AbortSignal';
      assert.ok(signal instanceof AbortSignal, m);

      m = 'Signal should not be aborted initially';
      assert.strictEqual(signal.aborted, false, m);
    });

    it('aborts the previous pending request signal', async () => {
      // 1. Setup a variable to hold the "resolve" function of our hanging promise
      let resolveFirstRequest: (() => void) | undefined;

      // 2. Create a "slow" mock strictly typed to our Adapter Options
      const slowMock: Mock<AsyncAdapterOptions<TestSettings>['write']> = mock.fn(
        async (/* _settings, _changes, _signal */) => {
          // If we haven't captured a resolver yet, hang this request
          if (!resolveFirstRequest) {
            return new Promise<void>((resolve) => {
              resolveFirstRequest = resolve;
            });
          }
          return Promise.resolve();
        }
      );

      // Re-init adapter with the slow mock
      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
        debounceMs: 100,
      });

      // 3. Start Request A
      const promiseA = adapter.write({theme: 'light', volume: 1}, {volume: 1});

      mock.timers.tick(150); // Debounce finishes, Request A starts (and hangs)

      // Capture signal A from the first call safely
      const callA = slowMock.mock.calls[0];

      m = 'Request A should have been called';
      assert.ok(callA, m);

      const signalA = callA.arguments[2];

      // Note: signalA is technically (AbortSignal | undefined) in the type definition,
      // so we assert it exists before checking properties.
      m = 'Signal A should be an instance of AbortSignal';
      assert.ok(signalA instanceof AbortSignal, m);

      m = 'Signal A should not be aborted yet';
      assert.strictEqual(signalA.aborted, false, m);

      // 4. Start Request B
      const promiseB = adapter.write({theme: 'light', volume: 2}, {volume: 2});

      mock.timers.tick(100); // Debounce finishes, Request B starts

      // 5. ASSERTION: Request A's signal should now be aborted by the adapter
      m = 'Signal A should be aborted after Request B starts';
      assert.strictEqual(signalA.aborted, true, m);

      // Cleanup: resolve the hanging promise so tests finish cleanly
      if (resolveFirstRequest) {
        resolveFirstRequest();
      }

      await promiseA;
      await promiseB;
    });

    it('suppresses AbortErrors (does not treat cancellation as a failure)', async () => {
      // 1. Create a mock that simulates a fetch abortion
      const abortMock = mock.fn(async () => {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError'; // Fetch throws this specific error name
        throw err;
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: abortMock,
        debounceMs: 100,
      });

      const promise = adapter.write({theme: 'light', volume: 1}, {volume: 1});
      mock.timers.tick(150);

      // 2. Should resolve successfully (void) instead of rejecting
      m = 'Promise should not reject on AbortError';
      await assert.doesNotReject(promise, m);
    });
  });

  describe('write() — Concurrency: "queue"', () => {
    it('waits for the first request to finish before starting the second', async () => {
      // 1. Setup a manual resolver
      let resolveFirstRequest: (() => void) | undefined;

      const slowMock: Mock<AsyncAdapterOptions<TestSettings>['write']> = mock.fn(async () => {
        if (!resolveFirstRequest) {
          return new Promise<void>((res) => {
            resolveFirstRequest = res;
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

      // 2. Start Request A
      const promiseA = adapter.write({theme: 'light', volume: 1}, {volume: 1});
      mock.timers.tick(150);

      // Flush Microtasks so the queue chain executes
      await new Promise((r) => setImmediate(r));

      m = 'Request A should have started';
      assert.strictEqual(slowMock.mock.callCount(), 1, m);

      // 3. Start Request B
      const promiseB = adapter.write({theme: 'light', volume: 2}, {volume: 2});
      mock.timers.tick(100);

      // Flush Microtasks again for B
      await new Promise((r) => setImmediate(r));

      // 4. ASSERT: Request B should wait
      m = 'Request B should wait in the queue';
      assert.strictEqual(slowMock.mock.callCount(), 1, m);

      // 5. Finish Request A
      if (resolveFirstRequest) resolveFirstRequest();

      // Awaiting promiseA ensures A is fully done
      await promiseA;

      // Now we wait for B to finish naturally
      await promiseB;

      // 6. ASSERT: Request B should have executed now
      m = 'Request B should run after A finishes';
      assert.strictEqual(slowMock.mock.callCount(), 2, m);
    });

    it('processes all updates sequentially', async () => {
      const executionOrder: number[] = [];

      const trackingMock = mock.fn(async (settings: TestSettings) => {
        executionOrder.push(settings.volume);
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: trackingMock,
        debounceMs: 100,
        concurrency: 'queue',
      });

      // Fire 3 requests rapidly
      const p1 = adapter.write({theme: 'dark', volume: 1}, {volume: 1});
      mock.timers.tick(200);

      const p2 = adapter.write({theme: 'dark', volume: 2}, {volume: 2});
      mock.timers.tick(200);

      const p3 = adapter.write({theme: 'dark', volume: 3}, {volume: 3});
      mock.timers.tick(200);

      await Promise.all([p1, p2, p3]);

      // Verify they ran in order: 1 -> 2 -> 3
      m = 'Execution order should be sequential [1, 2, 3]';
      assert.deepStrictEqual(executionOrder, [1, 2, 3], m);
    });
  });

  describe('write() — Concurrency: "optimistic"', () => {
    it('fires requests immediately in parallel without waiting', async () => {
      // 1. Setup mocks that hang until we manually resolve them
      let resolveA: (() => void) | undefined;

      const slowMock = mock.fn(async (settings: TestSettings) => {
        if (settings.volume === 1) {
          return new Promise<void>((r) => {
            resolveA = r;
          });
        }
        return Promise.resolve();
      });

      adapter = new AsyncAdapter({
        read: readMock,
        write: slowMock,
        debounceMs: 100, // Fast debounce
        concurrency: 'optimistic',
      });

      // 2. Start Request A
      const promiseA = adapter.write({theme: 'light', volume: 1}, {volume: 1});
      mock.timers.tick(150);

      // 3. Start Request B immediately
      const promiseB = adapter.write({theme: 'light', volume: 2}, {volume: 2});
      mock.timers.tick(100);

      // 4. ASSERT: Both should be running (call count 2)
      // Unlike 'queue' (which would be 1) or 'abort' (which cancels A),
      // optimistic sends both to the server immediately.
      m = 'Both requests should be sent immediately (count 2)';
      assert.strictEqual(slowMock.mock.callCount(), 2, m);

      // Cleanup
      if (resolveA) resolveA();
      await Promise.all([promiseA, promiseB]);
    });
  });

  describe('Error Handling', () => {
    it('calls onWriteError when the write function fails', async () => {
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

      const p = adapter.write({theme: 'light', volume: 1}, {});
      mock.timers.tick(10);

      // Verify the promise rejects...
      m = 'Write promise should reject with the error';
      await assert.rejects(p, error, m);

      // ...AND our custom handler was called
      m = 'onWriteError handler should be called once';
      assert.strictEqual(onErrorMock.mock.callCount(), 1, m);

      m = 'onWriteError should receive the error object';
      assert.strictEqual(onErrorMock.mock.calls[0]?.arguments[0], error, m);
    });

    it('uses console.error as a fallback if onWriteError is not provided', async (t) => {
      const error = new Error('Save failed');
      const failMock = mock.fn(async () => {
        throw error;
      });

      // Spy on console.error to ensure we don't pollute the test output
      const consoleSpy = t.mock.method(console, 'error', () => {});

      adapter = new AsyncAdapter({
        read: readMock,
        write: failMock,
        debounceMs: 10,
        // No onWriteError provided
      });

      const p = adapter.write({theme: 'light', volume: 1}, {});
      mock.timers.tick(10);

      m = 'Write promise should reject with the error';
      await assert.rejects(p, error, m);

      // Verify fallback behavior
      m = 'console.error should be called as fallback';
      assert.strictEqual(consoleSpy.mock.callCount(), 1, m);

      // The BaseAdapter logs two arguments: string prefix + error object
      m = 'console.error 2nd arg should be the error object';
      assert.strictEqual(consoleSpy.mock.calls[0]?.arguments[1], error, m);
    });
  });
});
