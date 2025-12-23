import {teardown} from '../test-setup.js'; // Setup runs here
import {describe, it, mock, beforeEach, after, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStorageAdapter} from './local-storage.js';
import type {Meta} from '../types.js';
import {AdapterPayloadError} from '../errors.js';
import {ZodError} from 'zod';

interface TestConfig {
  theme: 'light' | 'dark';
}

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let m: string;

  // We use the ReturnType utility to safely infer the mock type without 'any'
  let getItemMock: Mock<Storage['getItem']>;
  let setItemMock: Mock<Storage['setItem']>;

  beforeEach(() => {
    // 1. CLEAR: Ensure storage is empty before starting
    // Use window.localStorage to avoid ReferenceError in strict ESM
    window.localStorage.clear();

    // 2. MOCK: Use mock.method to actually spy on/replace the real object methods
    // We attach to window.localStorage to be explicit
    getItemMock = mock.method(window.localStorage, 'getItem', () => null);
    setItemMock = mock.method(window.localStorage, 'setItem', () => {});

    adapter = new LocalStorageAdapter({key: 'app-settings'});
  });

  after(() => {
    // Restoration is handled automatically by mock.method contexts in many cases,
    // but explicit restoration ensures clean state for other test files.
    mock.restoreAll();
    teardown();
  });

  describe('read()', () => {
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

          m = 'thrown error.parseError instanceof SyntaxError';
          assert.ok(e.parseError instanceof SyntaxError, m);

          return true;
        },
        m
      );

      m = 'onReadError error instanceof AdapterPayloadError';
      assert.ok(readMock.mock.calls[0]?.arguments[0] instanceof AdapterPayloadError, m);

      m = 'onReadError error.parseError instanceof SyntaxError';
      assert.ok(readMock.mock.calls[0]?.arguments[0].parseError instanceof SyntaxError, m);
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

          m = 'thrown error.parseError instanceof ZodError';
          assert.ok(e.parseError instanceof ZodError, m);

          return true;
        },
        m
      );

      m = 'onReadError error instanceof AdapterPayloadError';
      assert.ok(readMock.mock.calls[0]?.arguments[0] instanceof AdapterPayloadError, m);

      m = 'onReadError error.parseError instanceof ZodError';
      assert.ok(readMock.mock.calls[0]?.arguments[0].parseError instanceof ZodError, m);
    });
  });

  describe('write()', () => {
    it('wraps settings and metadata in an envelope before saving', () => {
      const config: TestConfig = {theme: 'dark'};
      const metadata: Meta = {dataVersion: 2, schemaVersion: 1};

      adapter.write(config, metadata);

      m = 'setItem should be called once';
      assert.strictEqual(setItemMock.mock.callCount(), 1, m);

      const args = setItemMock.mock.calls[0]?.arguments;

      // Strict null check before accessing array indices
      if (!args) {
        assert.fail('setItem was called without arguments');
      }

      const [key, value] = args;

      m = 'Should use the configured key';
      assert.strictEqual(key, 'app-settings', m);

      m = 'Value should be a JSON string';
      assert.strictEqual(typeof value, 'string', m);

      // We know value is a string here due to the assertion above
      const parsed = JSON.parse(value);

      m = 'Saved JSON should be the full envelope';
      assert.deepStrictEqual(parsed, {config, metadata}, m);
    });
  });

  describe('error handling', () => {
    it('re-throws error and calls onWriteError when storage fails', () => {
      const config: TestConfig = {theme: 'dark'};
      const metadata: Meta = {dataVersion: 2, schemaVersion: 1};
      const expectedError = new Error('QuotaExceededError');

      // 1. Simulate the failure
      // Override the generic mock from beforeEach to throw an error
      setItemMock.mock.mockImplementation(() => {
        throw expectedError;
      });

      // 2. Spy on onWriteError and silence it
      // By providing an empty function () => {}, we prevent the real BaseAdapter
      // implementation from logging to the console ("Swallowing" the log output)
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
});
