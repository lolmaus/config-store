import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js'; // The class to be implemented
import type {AdapterEnvelope} from './types.js';
import {BaseAdapter} from './adapters/base.js';

class MockAdapter extends BaseAdapter {
  state: AdapterEnvelope | undefined = undefined;
  read = mock.fn(() => this.state);
  write = mock.fn((nextConfig, metadata): AdapterEnvelope | void => {
    this.state = {config: nextConfig, metadata};
    return this.state;
  });
}

describe('ConfigManager', () => {
  let adapter: MockAdapter;
  let m: string; // Assertion message for better readability

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('Initialization & Defaults', () => {
    it('initializes with default values when adapter returns undefined (empty storage)', async () => {
      // Setup: Adapter returns undefined by default (see MockAdapter)

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z
          .object({
            theme: z.enum(['light', 'dark']).default('light'),
            notifications: z.boolean().default(true),
          })
          .prefault({}),
      });

      await manager.load();

      const config = manager.get();

      m = 'config deep equality';
      assert.deepStrictEqual(
        config,
        {
          theme: 'light',
          notifications: true,
        },
        m
      );
    });

    it('loads existing valid data from the adapter', async () => {
      // Setup: Adapter has data
      adapter.state = {
        config: {theme: 'dark', notifications: false},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z
          .object({
            theme: z.enum(['light', 'dark']).default('light'),
            notifications: z.boolean().default(true),
          })
          .prefault({}),
      });

      await manager.load();

      const config = manager.get();

      m = 'config deep equality';
      assert.deepStrictEqual(
        config,
        {
          theme: 'dark',
          notifications: false,
        },
        m
      );
    });
  });

  describe('Validation & Fallback', () => {
    it('falls back to defaults if stored data does not match schema (and cannot be repaired)', async () => {
      // Setup: Adapter returns garbage data
      adapter.state = {
        config: {theme: 12345}, // Invalid type
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z
          .object({
            theme: z.enum(['light', 'dark']).default('light'),
          })
          .prefault({}),
      });

      await manager.load();

      const {theme} = manager.get();

      m = 'theme should fall back to default';
      assert.strictEqual(theme, 'light', m);
    });

    it('triggers a write-back (healing) when falling back to defaults', async () => {
      adapter.state = {
        config: {theme: 'invalid-value'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.literal(['foo', 'bar']).default('foo')}).prefault({}),
      });

      await manager.load();

      const config = manager.get();

      // Should be default
      assert.strictEqual(config.theme, 'foo');
    });

    it('throws when the schema does not have a prefault', async () => {
      adapter.state = {
        config: {theme: 'invalid-value'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.literal(['foo', 'bar']).default('foo')}),
      });

      m = 'should reject with an error';
      await assert.rejects(
        manager.load(),
        (err: Error) =>
          err.message ===
          '[@config-store] Failed to revert to defaults. Schema must be defined with `.prefault()` on the outer object and `.default()` on every property.',
        m
      );
    });
  });

  describe('Migrations', () => {
    it('migrates data from v1 to v2 using the provided migration function', async () => {
      // Setup: Storage has V1 data
      adapter.state = {
        config: {darkTheme: true}, // Old schema
        metadata: {dataVersion: 1, schemaVersion: 1}, // Old version
      };

      const manager = ConfigManager.create(adapter)
        // Version 1 definition (needed for type inference/validation of old data)
        .addVersion({
          version: 1,
          schema: z.object({darkTheme: z.boolean().default(false)}).prefault({}),
        })
        // Version 2 definition
        .addVersion({
          version: 2,
          schema: z.object({theme: z.literal(['light', 'dark']).default('light')}).prefault({}),
          migration: (prev) => ({
            theme: prev.darkTheme ? 'dark' : 'light',
          }),
        });

      await manager.load();

      const config = manager.get();

      m = 'config should be migrated';
      assert.deepStrictEqual(config, {theme: 'dark'}, m);
    });

    it('runs multiple migrations sequentially (v1 -> v2 -> v3)', async () => {
      // Setup: Storage has V1
      adapter.state = {
        config: {val: 1},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter)
        .addVersion({
          version: 1,
          schema: z.object({val: z.number()}),
        })
        .addVersion({
          version: 2,
          schema: z.object({val: z.number()}),
          migration: (prev) => ({val: prev.val + 1}), // 1 -> 2
        })
        .addVersion({
          version: 3,
          schema: z.object({val: z.number()}),
          migration: (prev) => ({val: prev.val * 10}), // 2 -> 20
        });

      await manager.load();

      const config = manager.get();

      m = 'config should be migrated';
      assert.deepStrictEqual(config, {val: 20}, m);
    });

    it('errors on non-incremental version numbers (v1 -> v3 -> v2)', async () => {
      // Setup: Storage has V1
      adapter.state = {
        config: {val: 1},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      m = 'should throw, disallowing a lower version number';
      assert.throws(
        () => {
          ConfigManager.create(adapter)
            .addVersion({
              version: 1,
              schema: z.object({val: z.number().default(0)}).prefault({}),
            })
            .addVersion({
              version: 3,
              schema: z.object({val: z.number().default(1)}).prefault({}),
              migration: (prev) => ({val: prev.val + 1}), // 1 -> 2
            })
            .addVersion({
              version: 2,
              schema: z.object({val: z.number().default(10)}).prefault({}),
              migration: (prev) => ({val: prev.val * 10}), // 2 -> 20
            });
        },
        /\[@config-manager\] Version numbers must be incremental, but after 3 received 2/,
        m
      );
    });
  });

  describe('Updates (save)', () => {
    it('updates the state and persists via the adapter that returns the exact config and meta', async () => {
      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.string().default('light')}).prefault({}),
      });

      await manager.load();
      await manager.save({theme: 'dark'});

      m = 'Manager store';
      assert.deepStrictEqual(manager.get(), {theme: 'dark'}, m);

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'dark'}, m);
    });

    it('updates the state and persists via the adapter that returns void', async () => {
      adapter.write = mock.fn(function (this: typeof adapter, nextConfig, metadata) {
        this.state = {config: nextConfig, metadata};
      });

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.string().default('light')}).prefault({}),
      });

      await manager.load();
      await manager.save({theme: 'dark'});

      m = 'Manager store';
      assert.deepStrictEqual(manager.get(), {theme: 'dark'}, m);

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'dark'}, m);
    });

    it('updates the state and persists via the adapter that returns an updated config and meta', async () => {
      adapter.write = mock.fn(function (this: typeof adapter, nextConfig, metadata) {
        this.state = {
          config: {theme: nextConfig.theme.toUpperCase()},
          metadata: {...metadata, dataVersion: metadata.dataVersion + 10},
        };
        return this.state;
      });

      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.string().default('light')}).prefault({}),
      });

      await manager.load();
      await manager.save({theme: 'dark'});

      m = 'Manager store';
      assert.deepStrictEqual(manager.get(), {theme: 'DARK'}, m);

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'DARK'}, m);

      m = 'Manager metadata.dataVersion';
      assert.deepStrictEqual(manager.metadata.dataVersion, 11, m);

      m = 'Adapter metadata.dataVersion';
      assert.deepStrictEqual(adapter.state?.metadata.dataVersion, 11, m);
    });
  });
});
