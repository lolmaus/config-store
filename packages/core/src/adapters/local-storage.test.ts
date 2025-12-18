import {describe, it, mock, beforeEach, afterEach, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStorageAdapter} from './local-storage.js';
import type {Meta} from '../types.js';

interface TestConfig {
  theme: 'light' | 'dark';
}

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let m: string;

  // Mock storage methods
  let getItemMock: Mock<Storage['getItem']>;
  let setItemMock: Mock<Storage['setItem']>;

  beforeEach(() => {
    // 1. Mock the global localStorage object
    getItemMock = mock.fn(() => null);
    setItemMock = mock.fn(() => {});

    global.localStorage = {
      getItem: getItemMock,
      setItem: setItemMock,
      length: 0,
      clear: () => {},
      key: () => null,
      removeItem: () => {},
    } as unknown as Storage;

    adapter = new LocalStorageAdapter({key: 'app-settings'});
  });

  afterEach(() => {
    // Cleanup global pollution
    // @ts-expect-error - Cleaning up global mock
    delete global.localStorage;
  });

  describe('read()', () => {
    it('returns undefined settings if storage is empty', () => {
      // getItemMock returns null by default

      const result = adapter.read();

      m = 'Should return undefined settings for null storage';
      assert.deepStrictEqual(result, undefined, m);
    });

    it('parses a valid envelope (Settings + Metadata)', () => {
      const storedData = JSON.stringify({
        config: {theme: 'dark'},
        metadata: {dataVersion: 5, schemaVersion: 1},
      });
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

    it('returns undefined if JSON parsing fails', async () => {
      const warnMock = mock.method(console, 'warn', () => {});

      getItemMock.mock.mockImplementation(() => '{ invalid json }');

      const result = await adapter.read();

      m = 'Should gracefully handle parse errors';
      assert.deepStrictEqual(result, undefined, m);

      m = 'Should log a warning to the console';
      assert.strictEqual(warnMock.mock.callCount(), 1, m);

      const args = warnMock.mock.calls[0]?.arguments;
      assert.match(args?.[0], /Failed to parse/, 'Should mention parsing failure');

      warnMock.mock.restore();
    });
  });

  describe('write()', () => {
    it('wraps settings and metadata in an envelope before saving', async () => {
      const config: TestConfig = {theme: 'dark'};
      const metadata: Meta = {dataVersion: 2, schemaVersion: 1};

      await adapter.write(config, metadata);

      m = 'setItem should be called once';
      assert.strictEqual(setItemMock.mock.callCount(), 1, m);

      const [key, value] = setItemMock.mock.calls?.[0]?.arguments ?? [];

      m = 'Should use the configured key';
      assert.strictEqual(key, 'app-settings', m);

      m = 'Value should be a JSON string';
      assert.strictEqual(typeof value, 'string', m);

      const parsed = JSON.parse(value as string);

      m = 'Saved JSON should be the full envelope';
      assert.deepStrictEqual(parsed, {config, metadata}, m);
    });
  });
});
