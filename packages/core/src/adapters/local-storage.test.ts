import {teardown} from '../test-setup.js';
import {describe, it, mock, beforeEach, after, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStorageAdapter} from './local-storage.js';
import type {ManagerMetadata} from '../types.js';
import {AdapterPayloadError} from '../errors.js';
import {ZodError} from 'zod';

interface TestConfig {
  theme: 'light' | 'dark';
}

describe('LocalStorageAdapter', () => {
  after(() => {
    teardown();
  });

  describe('Unit Tests (Mocked)', () => {
    let adapter: LocalStorageAdapter;
    let m: string;

    // We use the ReturnType utility to safely infer the mock type without 'any'
    let getItemMock: Mock<Storage['getItem']>;
    let setItemMock: Mock<Storage['setItem']>;

    beforeEach(() => {
      // 1. CLEAR: Ensure storage is empty before starting
      window.localStorage.clear();

      // 2. MOCK: Use mock.method to actually spy on/replace the real object methods
      getItemMock = mock.method(window.localStorage, 'getItem', () => null);
      setItemMock = mock.method(window.localStorage, 'setItem', () => {});

      adapter = new LocalStorageAdapter({key: 'app-settings'});
    });

    after(() => {
      mock.restoreAll();
    });

    describe('read()', () => {
      it('uses the default key "@lolmaus/config-store" when initialized without options', () => {
        const defaultAdapter = new LocalStorageAdapter();
        defaultAdapter.read();

        m = 'Should call localStorage.getItem with the default key';
        const args = getItemMock.mock.calls[0]?.arguments;

        if (!args) {
          assert.fail('getItemMock was not called');
        }

        assert.strictEqual(args[0], '@lolmaus/config-store', m);
      });

      it('uses the configured custom key', () => {
        // adapter is initialized with { key: 'app-settings' } in beforeEach
        adapter.read();

        m = 'Should call localStorage.getItem with the custom key';
        const args = getItemMock.mock.calls[0]?.arguments;

        if (!args) {
          assert.fail('getItemMock was not called');
        }

        assert.strictEqual(args[0], 'app-settings', m);
      });

      it('returns undefined settings if storage is empty', () => {
        // The default implementation defined in beforeEach returns null
        const result = adapter.read();

        m = 'Should return undefined settings for null storage';
        assert.deepStrictEqual(result, undefined, m);

        m = 'Should have called localStorage.getItem';
        assert.strictEqual(getItemMock.mock.callCount(), 1, m);
      });

      it('parses a valid envelope (Settings + Metadata)', () => {
        const storedData = JSON.stringify({
          config: {theme: 'dark'},
          metadata: {dataVersion: 5, schemaVersion: 1},
        });

        // Update the implementation of the *existing* spy
        getItemMock.mock.mockImplementation(() => storedData);

        const result = adapter.read();

        m = 'Should correctly parse the envelope structure';
        assert.deepStrictEqual(
          result,
          {
            config: {theme: 'dark'},
            metadata: {dataVersion: 5, schemaVersion: 1},
          },
          m
        );
      });

      it('Should throw SyntaxError on invalid JSON', () => {
        // Mock console.warn to keep test output clean
        const readMock = mock.method(adapter, 'onReadError', () => {});

        getItemMock.mock.mockImplementation(() => 'wtf');

        m = 'Read error';
        assert.throws(
          () => adapter.read(),
          (e) => {
            m = 'thrown error instanceof AdapterPayloadError';
            assert.ok(e instanceof AdapterPayloadError, m);

            m = 'thrown error.cause instanceof SyntaxError';
            assert.ok(e.cause instanceof SyntaxError, m);

            return true;
          },
          m
        );

        m = 'onReadError error instanceof AdapterPayloadError';
        assert.ok(readMock.mock.calls[0]?.arguments[0] instanceof AdapterPayloadError, m);

        m = 'onReadError error.cause instanceof SyntaxError';
        assert.ok(readMock.mock.calls[0]?.arguments[0].cause instanceof SyntaxError, m);
      });

      it('Should throw ValidationError on schema mismatch', () => {
        // Mock console.warn to keep test output clean
        const readMock = mock.method(adapter, 'onReadError', () => {});

        getItemMock.mock.mockImplementation(() => '{"theme": "main"}');

        m = 'Read error';
        assert.throws(
          () => adapter.read(),
          (e) => {
            m = 'thrown error instanceof AdapterPayloadError';
            assert.ok(e instanceof AdapterPayloadError, m);

            m = 'thrown error.cause instanceof ZodError';
            assert.ok(e.cause instanceof ZodError, m);

            return true;
          },
          m
        );

        m = 'onReadError error instanceof AdapterPayloadError';
        assert.ok(readMock.mock.calls[0]?.arguments[0] instanceof AdapterPayloadError, m);

        m = 'onReadError error.cause instanceof ZodError';
        assert.ok(readMock.mock.calls[0]?.arguments[0].cause instanceof ZodError, m);
      });
    });

    describe('write()', () => {
      it('wraps settings and metadata in an envelope before saving', () => {
        const config: TestConfig = {theme: 'dark'};
        const metadata: ManagerMetadata = {dataVersion: 2, schemaVersion: 1};

        adapter.write(config, metadata);

        m = 'setItem should be called once';
        assert.strictEqual(setItemMock.mock.callCount(), 1, m);

        const args = setItemMock.mock.calls[0]?.arguments;

        if (!args) {
          assert.fail('setItem was called without arguments');
        }

        const [key, value] = args;

        m = 'Should use the configured key';
        assert.strictEqual(key, 'app-settings', m);

        m = 'Value should be a JSON string';
        assert.strictEqual(typeof value, 'string', m);

        const parsed = JSON.parse(value);

        m = 'Saved JSON should be the full envelope';
        assert.deepStrictEqual(parsed, {config, metadata}, m);
      });
    });

    it('re-throws error and calls onWriteError when storage fails', () => {
      const config: TestConfig = {theme: 'dark'};
      const metadata: ManagerMetadata = {dataVersion: 2, schemaVersion: 1};
      const expectedError = new Error('QuotaExceededError');

      // 1. Simulate the failure
      setItemMock.mock.mockImplementation(() => {
        throw expectedError;
      });

      // 2. Spy on onWriteError and silence it
      const onWriteErrorMock = mock.method(adapter, 'onWriteError', () => {});

      m = 'Should re-throw the underlying error synchronously';
      assert.throws(() => adapter.write(config, metadata), expectedError, m);

      m = 'Should delegate to onWriteError handler';
      assert.strictEqual(onWriteErrorMock.mock.callCount(), 1, m);

      // 3. Verify onWriteError received the correct error
      const args = onWriteErrorMock.mock.calls[0]?.arguments;

      m = 'Should pass the error object to handler';
      assert.strictEqual(args?.[0], expectedError, m);
    });
  });

  describe('Integration Tests (Real LocalStorage)', () => {
    let m: string;

    beforeEach(() => {
      // Ensure we are working with a clean, real (HappyDOM) localStorage
      window.localStorage.clear();
    });

    it('read() successfully retrieves data from the default key', () => {
      const defaultKey = '@lolmaus/config-store';
      const envelope = {
        config: {theme: 'light'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      // 1. Arrange: Pre-fill localStorage using the public API
      window.localStorage.setItem(defaultKey, JSON.stringify(envelope));
      const adapter = new LocalStorageAdapter(); // Should default to '@lolmaus/config-store'

      // 2. Act
      const result = adapter.read();

      // 3. Assert
      m = 'Should return the data stored under the default key';
      assert.deepStrictEqual(result, envelope, m);
    });

    it('read() successfully retrieves data from a custom key', () => {
      const customKey = 'my-custom-key';
      const envelope = {
        config: {theme: 'dark'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      // 1. Arrange: Pre-fill localStorage using the public API
      window.localStorage.setItem(customKey, JSON.stringify(envelope));
      const adapter = new LocalStorageAdapter({key: customKey});

      // 2. Act
      const result = adapter.read();

      // 3. Assert
      m = 'Should return the data stored under the custom key';
      assert.deepStrictEqual(result, envelope, m);
    });

    it('write() successfully persists data to the real storage', () => {
      const customKey = 'write-test-key';
      const config: TestConfig = {theme: 'dark'};
      const metadata: ManagerMetadata = {dataVersion: 3, schemaVersion: 1};

      // 1. Arrange
      const adapter = new LocalStorageAdapter({key: customKey});

      // 2. Act
      adapter.write(config, metadata);

      // 3. Assert: Read directly from the "browser" (happy-dom) storage
      const storedRaw = window.localStorage.getItem(customKey);

      m = 'Data should be present in localStorage';
      assert.notEqual(storedRaw, null, m);

      // We know storedRaw is string here due to assertion above
      if (typeof storedRaw !== 'string') {
        assert.fail('storedRaw should be a string');
      }

      const storedJson = JSON.parse(storedRaw);

      m = 'Stored data should match the written envelope';
      assert.deepStrictEqual(
        storedJson,
        {
          config,
          metadata,
        },
        m
      );
    });
  });
});
