import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js'; // The class to be implemented
import type {AdapterEnvelope, ManagerState} from './types.js';
import {BaseAdapter} from './adapters/base.js';
import {createStore} from 'zustand';

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
    it('initializes with default values when adapter returns undefined (empty storage) + test state', async () => {
      // Setup: Adapter returns undefined by default (see MockAdapter)

      const manager = ConfigManager.create(adapter)
        //
        .addVersion({
          version: 1,
          schema: z
            .object({
              theme: z.enum(['light', 'dark']).default('light'),
              notifications: z.boolean().default(true),
            })
            .prefault({}),
        });

      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          status: 'initial',
          error: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        } satisfies ManagerState,
        m
      );

      const promise = manager.load();

      m = 'manager.state loading';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          status: 'loading',
          error: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        } satisfies ManagerState,
        m
      );

      await promise;

      m = 'manager.config';
      assert.deepStrictEqual(
        manager.config,
        {
          theme: 'light',
          notifications: true,
        },
        m
      );

      m = 'manager.state final';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          status: 'success',
          error: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        } satisfies ManagerState,
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

      m = 'config deep equality';
      assert.deepStrictEqual(
        manager.config,
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

      const {theme} = manager.config;

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

      const {theme} = manager.config;

      // Should be default
      assert.strictEqual(theme, 'foo');
    });

    it('throws when the schema does not have a prefault', async () => {
      adapter.state = {
        config: {theme: 'invalid-value'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };

      const manager = ConfigManager.create(adapter);

      m = 'addVersion should throw with an error';
      await assert.throws(
        () => {
          manager.addVersion({
            version: 1,
            schema: z.object({theme: z.literal(['foo', 'bar']).default('foo')}),
          });
        },
        (e) =>
          e instanceof Error &&
          e.message ===
            '[@config-store] Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.',
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

      m = 'config should be migrated';
      assert.deepStrictEqual(manager.config, {theme: 'dark'}, m);
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
          schema: z.object({val: z.number().default(123)}).prefault({}),
        })
        .addVersion({
          version: 2,
          schema: z.object({val: z.number().default(123)}).prefault({}),
          migration: (prev) => ({val: prev.val + 1}), // 1 -> 2
        })
        .addVersion({
          version: 3,
          schema: z.object({val: z.number().default(123)}).prefault({}),
          migration: (prev) => ({val: prev.val * 10}), // 2 -> 20
        });

      await manager.load();

      m = 'config should be migrated';
      assert.deepStrictEqual(manager.config, {val: 20}, m);
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
    it('updates the state and persists via the adapter that returns the exact config and meta, without prior loading', async () => {
      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.string().default('light')}).prefault({}),
      });

      await manager.save({theme: 'dark'});

      m = 'Manager store';
      assert.deepStrictEqual(manager.config, {theme: 'dark'}, m);

      m = 'Manager state';
      assert.deepEqual(
        manager.state,
        {
          error: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 1,
            schemaVersion: 1,
          },
          status: 'success',
        },
        m
      );

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'dark'}, m);
    });

    it('updates the state and persists via the adapter that returns the exact config and meta, with prior loading', async () => {
      const manager = ConfigManager.create(adapter).addVersion({
        version: 1,
        schema: z.object({theme: z.string().default('light')}).prefault({}),
      });

      await manager.load();
      await manager.save({theme: 'dark'});

      m = 'Manager store';
      assert.deepStrictEqual(manager.config, {theme: 'dark'}, m);

      m = 'Manager state';
      assert.deepEqual(
        manager.state,
        {
          error: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 1,
            schemaVersion: 1,
          },
          status: 'success',
        },
        m
      );

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
      assert.deepStrictEqual(manager.config, {theme: 'dark'}, m);

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
      assert.deepStrictEqual(manager.config, {theme: 'DARK'}, m);

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'DARK'}, m);

      m = 'Manager metadata.dataVersion';
      assert.deepStrictEqual(manager.metadata.dataVersion, 11, m);

      m = 'Adapter metadata.dataVersion';
      assert.deepStrictEqual(adapter.state?.metadata.dataVersion, 11, m);
    });
  });

  describe('Getters', () => {
    it('config', () => {
      const manager = ConfigManager.create(adapter);

      Object.defineProperty(manager, 'configStore', {
        value: createStore<'foo'>(() => 'foo'),
      });

      m = 'manager.config';
      assert.equal(manager.config, 'foo', m);
    });

    describe('state-based getters', () => {
      it('state: initial, not hydrated', () => {
        const manager = ConfigManager.create(adapter);

        Object.defineProperty(manager, 'stateStore', {
          value: createStore<ManagerState>(() => ({
            status: 'initial',
            error: null,
            hasBeenHydrated: false,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            status: 'initial',
            error: null,
            hasBeenHydrated: false,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          } satisfies ManagerState,
          m
        );

        m = 'manager.status';
        assert.equal(manager.status, 'initial', m);

        m = 'manager.error';
        assert.equal(manager.error, null, m);

        m = 'manager.metadata';
        assert.deepEqual(
          manager.metadata,
          {
            dataVersion: 123,
            schemaVersion: 321,
          },
          m
        );

        m = 'manager.dataVersion';
        assert.equal(manager.dataVersion, 123, m);

        m = 'manager.schemaVersion';
        assert.equal(manager.schemaVersion, 321, m);

        m = 'manager.isInitial';
        assert.equal(manager.isInitial, true, m);

        m = 'manager.isLoading';
        assert.equal(manager.isLoading, false, m);

        m = 'manager.isSuccess';
        assert.equal(manager.isSuccess, false, m);

        m = 'manager.isError';
        assert.equal(manager.isError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, false, m);
      });

      it('state: loading, not hydrated', () => {
        const manager = ConfigManager.create(adapter);

        Object.defineProperty(manager, 'stateStore', {
          value: createStore<ManagerState>(() => ({
            status: 'loading',
            error: null,
            hasBeenHydrated: false,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            status: 'loading',
            error: null,
            hasBeenHydrated: false,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          } satisfies ManagerState,
          m
        );

        m = 'manager.status';
        assert.equal(manager.status, 'loading', m);

        m = 'manager.error';
        assert.equal(manager.error, null, m);

        m = 'manager.metadata';
        assert.deepEqual(
          manager.metadata,
          {
            dataVersion: 123,
            schemaVersion: 321,
          },
          m
        );

        m = 'manager.dataVersion';
        assert.equal(manager.dataVersion, 123, m);

        m = 'manager.schemaVersion';
        assert.equal(manager.schemaVersion, 321, m);

        m = 'manager.isInitial';
        assert.equal(manager.isInitial, false, m);

        m = 'manager.isLoading';
        assert.equal(manager.isLoading, true, m);

        m = 'manager.isSuccess';
        assert.equal(manager.isSuccess, false, m);

        m = 'manager.isError';
        assert.equal(manager.isError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, false, m);
      });

      it('state: success, hydrated', () => {
        const manager = ConfigManager.create(adapter);

        Object.defineProperty(manager, 'stateStore', {
          value: createStore<ManagerState>(() => ({
            status: 'success',
            error: null,
            hasBeenHydrated: true,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            status: 'success',
            error: null,
            hasBeenHydrated: true,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          } satisfies ManagerState,
          m
        );

        m = 'manager.status';
        assert.equal(manager.status, 'success', m);

        m = 'manager.error';
        assert.equal(manager.error, null, m);

        m = 'manager.metadata';
        assert.deepEqual(
          manager.metadata,
          {
            dataVersion: 123,
            schemaVersion: 321,
          },
          m
        );

        m = 'manager.dataVersion';
        assert.equal(manager.dataVersion, 123, m);

        m = 'manager.schemaVersion';
        assert.equal(manager.schemaVersion, 321, m);

        m = 'manager.isInitial';
        assert.equal(manager.isInitial, false, m);

        m = 'manager.isLoading';
        assert.equal(manager.isLoading, false, m);

        m = 'manager.isSuccess';
        assert.equal(manager.isSuccess, true, m);

        m = 'manager.isError';
        assert.equal(manager.isError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, true, m);
      });

      it('state: error, hydrated', () => {
        const manager = ConfigManager.create(adapter);

        Object.defineProperty(manager, 'stateStore', {
          value: createStore<ManagerState>(() => ({
            status: 'error',
            error: "I'm afraid I can't do that, Dave.",
            hasBeenHydrated: true,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            status: 'error',
            error: "I'm afraid I can't do that, Dave.",
            hasBeenHydrated: true,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
          } satisfies ManagerState,
          m
        );

        m = 'manager.status';
        assert.equal(manager.status, 'error', m);

        m = 'manager.error';
        assert.equal(manager.error, "I'm afraid I can't do that, Dave.", m);

        m = 'manager.metadata';
        assert.deepEqual(
          manager.metadata,
          {
            dataVersion: 123,
            schemaVersion: 321,
          },
          m
        );

        m = 'manager.dataVersion';
        assert.equal(manager.dataVersion, 123, m);

        m = 'manager.schemaVersion';
        assert.equal(manager.schemaVersion, 321, m);

        m = 'manager.isInitial';
        assert.equal(manager.isInitial, false, m);

        m = 'manager.isLoading';
        assert.equal(manager.isLoading, false, m);

        m = 'manager.isSuccess';
        assert.equal(manager.isSuccess, false, m);

        m = 'manager.isError';
        assert.equal(manager.isError, true, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, true, m);
      });
    });
  });
});
