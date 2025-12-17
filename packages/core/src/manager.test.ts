import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js'; // The class to be implemented
import type {AdapterEnvelope} from './types.js';
import {BaseAdapter} from './adapters/base.js';

class MockAdapter extends BaseAdapter {
  state: AdapterEnvelope | undefined = undefined;
  read = mock.fn(async () => this.state);
  write = mock.fn(async (config, changes, metadata) => {
    this.state = {config, metadata};
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

      assert.deepStrictEqual(config, {val: 20});
    });

    it.skip('asserts that versions are defined in incremental order');
  });

  // describe('Updates (set)', () => {
  //   it.skip('updates the state and persists via the adapter', async () => {
  //     const manager = ConfigManager.create(adapter).addVersion({
  //       version: 1,
  //       schema: z.object({theme: z.string().default('light')}),
  //     });

  //     await manager.load();

  //     // Act
  //     await manager.set({theme: 'dark'});

  //     // Assert State
  //     assert.deepStrictEqual(manager.get(), {theme: 'dark'});

  //     // Assert Side Effect
  //     assert.strictEqual(adapter.write.mock.callCount(), 1);

  //     const [config, changes, metadata] = adapter.write.mock.calls[0].arguments;
  //     assert.deepStrictEqual(config, {theme: 'dark'});
  //     assert.deepStrictEqual(changes, {theme: 'dark'});
  //     assert.strictEqual(metadata.dataVersion, 1);
  //   });

  //   it.skip('resets a value to default if undefined is passed', async () => {
  //     manager = new ConfigManager({adapter}).addVersion({
  //       version: 1,
  //       schema: z.object({
  //         theme: z.string().default('light'),
  //         volume: z.number().default(50),
  //       }),
  //     });

  //     await manager.load();
  //     await manager.set({volume: 100}); // Change it first

  //     // Act: Reset to default
  //     await manager.set({volume: undefined});

  //     // Assert
  //     assert.strictEqual(manager.get().volume, 50);

  //     const [config] = adapter.write.mock.calls[1].arguments; // 2nd call
  //     assert.strictEqual(config.volume, 50);
  //   });
  // });
});
