import {describe, it, mock, beforeEach, afterEach, type Mock} from 'node:test';
import assert from 'node:assert/strict';
import {LocalStorageAdapter} from './local-storage.js';

interface TestSettings {
  theme: 'light' | 'dark';
}

interface TestMeta {
  version: number;
}

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter<TestSettings, TestMeta>;
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
    it('returns undefined settings if storage is empty', async () => {
      // getItemMock returns null by default

      const result = await adapter.read();

      m = 'Should return undefined settings for null storage';
      assert.deepStrictEqual(result, {settings: undefined}, m);
    });

    it('parses a valid envelope (Settings + Metadata)', async () => {
      const storedData = JSON.stringify({
        settings: {theme: 'dark'},
        metadata: {version: 5},
      });
      getItemMock.mock.mockImplementation(() => storedData);

      const result = await adapter.read();

      m = 'Should correctly parse the envelope structure';
      assert.deepStrictEqual(
        result,
        {
          settings: {theme: 'dark'},
          metadata: {version: 5},
        },
        m
      );
    });

    it('handles "Legacy" data (Raw Settings without Envelope)', async () => {
      // Simulate data saved by an older version of the lib (or a different tool)
      const rawSettings = JSON.stringify({theme: 'light'});
      getItemMock.mock.mockImplementation(() => rawSettings);

      const result = await adapter.read();

      m = 'Should treat raw JSON as settings and metadata as undefined';
      assert.deepStrictEqual(
        result,
        {
          settings: {theme: 'light'},
          metadata: undefined,
        },
        m
      );
    });

    it('returns undefined if JSON parsing fails', async () => {
      getItemMock.mock.mockImplementation(() => '{ invalid json }');

      const result = await adapter.read();

      m = 'Should gracefully handle parse errors';
      assert.deepStrictEqual(result, {settings: undefined}, m);
    });
  });

  describe('write()', () => {
    it('wraps settings and metadata in an envelope before saving', async () => {
      const settings: TestSettings = {theme: 'dark'};
      const metadata: TestMeta = {version: 2};

      await adapter.write(settings, {}, metadata);

      m = 'setItem should be called once';
      assert.strictEqual(setItemMock.mock.callCount(), 1, m);

      const [key, value] = setItemMock.mock.calls?.[0]?.arguments ?? [];

      m = 'Should use the configured key';
      assert.strictEqual(key, 'app-settings', m);

      m = 'Value should be a JSON string';
      assert.strictEqual(typeof value, 'string', m);

      const parsed = JSON.parse(value as string);

      m = 'Saved JSON should be the full envelope';
      assert.deepStrictEqual(parsed, {settings, metadata}, m);
    });

    it('handles writes without metadata', async () => {
      const settings: TestSettings = {theme: 'light'};

      await adapter.write(settings, {}, undefined);

      const value = setItemMock.mock.calls[0]?.arguments?.[1] as string;
      const parsed = JSON.parse(value);

      m =
        'Envelope should contain only settings (metadata undefined is stripped by JSON.stringify)';
      assert.deepStrictEqual(parsed, {settings}, m);
    });
  });
});
