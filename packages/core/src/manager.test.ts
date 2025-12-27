import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js'; // The class to be implemented
import type {AdapterEnvelope, ManagerState} from './types.js';
import {BaseAdapter} from './adapters/base.js';
import {createStore} from 'zustand/vanilla';

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

      const manager = ConfigManager.create(adapter, {
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
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
          hasBeenHydrated: false,

          loadStatus: 'initial',
          loadError: null,
        },
        m
      );

      const promise = manager.load();

      m = 'manager.state loading';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
          hasBeenHydrated: false,

          loadStatus: 'pending',
          loadError: null,
        },
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
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
          hasBeenHydrated: true,
          loadStatus: 'success',
          loadError: null,
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

      const manager = ConfigManager.create(adapter, {
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

      const manager = ConfigManager.create(adapter, {
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

      const manager = ConfigManager.create(adapter, {
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

      m = 'addVersion should throw with an error';
      await assert.throws(
        () => {
          ConfigManager.create(adapter, {
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

      const manager = ConfigManager.create(adapter, {
        version: 1,
        schema: z.object({darkTheme: z.boolean().default(false)}).prefault({}),
      }).addVersion({
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

      const manager = ConfigManager.create(adapter, {
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
          ConfigManager.create(adapter, {
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
      const manager = ConfigManager.create(adapter, {
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
          config: {
            theme: 'dark',
          },
          metadata: {
            dataVersion: 1,
            schemaVersion: 1,
          },
          hasBeenHydrated: true,

          // Load state
          loadStatus: 'initial',
          isLoadError: false,
          isLoadInitial: true,
          isLoadPending: false,
          isLoadSuccess: false,
          loadError: null,

          // Save state
          saveStatus: 'success',
          saveError: null,
          isSaveInitial: false,
          isSavePending: false,
          isSaveSuccess: true,
          isSaveError: false,
        },
        m
      );

      m = 'Adapter store';
      assert.deepStrictEqual(adapter.state?.config, {theme: 'dark'}, m);
    });

    it('updates the state and persists via the adapter that returns the exact config and meta, with prior loading', async () => {
      const manager = ConfigManager.create(adapter, {
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
          config: {
            theme: 'dark',
          },
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 1,
            schemaVersion: 1,
          },

          // Load state
          loadStatus: 'success',
          isLoadError: false,
          isLoadInitial: false,
          isLoadPending: false,
          isLoadSuccess: true,
          loadError: null,

          // Save state
          saveStatus: 'success',
          saveError: null,
          isSaveInitial: false,
          isSavePending: false,
          isSaveSuccess: true,
          isSaveError: false,
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

      const manager = ConfigManager.create(adapter, {
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

      const manager = ConfigManager.create(adapter, {
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

  describe('unit: Getters', () => {
    it('config', () => {
      const manager = ConfigManager.create(adapter, {
        version: 1,
        schema: z.string().default('foo'),
      });

      Object.defineProperty(manager, 'store', {
        value: createStore(() => ({config: 'foo'})),
      });

      m = 'manager.config';
      assert.equal(manager.config, 'foo', m);
    });

    describe('state-based getters', () => {
      it('state: initial, not hydrated', () => {
        const manager = ConfigManager.create(adapter, {
          version: 1,
          schema: z.string().default('foo'),
        });

        Object.defineProperty(manager, 'store', {
          value: createStore<ManagerState<undefined>>(() => ({
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: false,

            // Load state
            loadStatus: 'initial',
            isLoadError: false,
            isLoadInitial: true,
            isLoadPending: false,
            isLoadSuccess: false,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: false,

            // Load state
            loadStatus: 'initial',
            isLoadError: false,
            isLoadInitial: true,
            isLoadPending: false,
            isLoadSuccess: false,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          },
          m
        );

        m = 'manager.loadStatus';
        assert.equal(manager.loadStatus, 'initial', m);

        m = 'manager.loadError';
        assert.equal(manager.loadError, null, m);

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

        m = 'manager.isLoadInitial';
        assert.equal(manager.isLoadInitial, true, m);

        m = 'manager.isLoadPending';
        assert.equal(manager.isLoadPending, false, m);

        m = 'manager.isLoadSuccess';
        assert.equal(manager.isLoadSuccess, false, m);

        m = 'manager.isLoadError';
        assert.equal(manager.isLoadError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, false, m);
      });

      it('state: loading, not hydrated', () => {
        const manager = ConfigManager.create(adapter, {
          version: 1,
          schema: z.string().default('foo'),
        });

        Object.defineProperty(manager, 'store', {
          value: createStore<ManagerState<undefined>>(() => ({
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: false,

            // Load state
            loadStatus: 'pending',
            isLoadError: false,
            isLoadInitial: false,
            isLoadPending: true,
            isLoadSuccess: false,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: false,

            // Load state
            loadStatus: 'pending',
            isLoadError: false,
            isLoadInitial: false,
            isLoadPending: true,
            isLoadSuccess: false,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          },
          m
        );

        m = 'manager.loadStatus';
        assert.equal(manager.loadStatus, 'pending', m);

        m = 'manager.loadError';
        assert.equal(manager.loadError, null, m);

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

        m = 'manager.isLoadInitial';
        assert.equal(manager.isLoadInitial, false, m);

        m = 'manager.isLoadPending';
        assert.equal(manager.isLoadPending, true, m);

        m = 'manager.isLoadSuccess';
        assert.equal(manager.isLoadSuccess, false, m);

        m = 'manager.isLoadError';
        assert.equal(manager.isLoadError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, false, m);
      });

      it('state: success, hydrated', () => {
        const manager = ConfigManager.create(adapter, {
          version: 1,
          schema: z.string().default('foo'),
        });

        Object.defineProperty(manager, 'store', {
          value: createStore<ManagerState<undefined>>(() => ({
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: true,

            // Load state
            loadStatus: 'success',
            isLoadError: false,
            isLoadInitial: false,
            isLoadPending: false,
            isLoadSuccess: true,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: true,

            // Load state
            loadStatus: 'success',
            isLoadError: false,
            isLoadInitial: false,
            isLoadPending: false,
            isLoadSuccess: true,
            loadError: null,

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          },
          m
        );

        m = 'manager.loadStatus';
        assert.equal(manager.loadStatus, 'success', m);

        m = 'manager.loadError';
        assert.equal(manager.loadError, null, m);

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

        m = 'manager.isLoadInitial';
        assert.equal(manager.isLoadInitial, false, m);

        m = 'manager.isLoadPending';
        assert.equal(manager.isLoadPending, false, m);

        m = 'manager.isLoadSuccess';
        assert.equal(manager.isLoadSuccess, true, m);

        m = 'manager.isLoadError';
        assert.equal(manager.isLoadError, false, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, true, m);
      });

      it('state: error, hydrated', () => {
        const manager = ConfigManager.create(adapter, {
          version: 1,
          schema: z.string().default('foo'),
        });

        Object.defineProperty(manager, 'store', {
          value: createStore<ManagerState<undefined>>(() => ({
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: true,

            // Load state
            loadStatus: 'error',
            isLoadError: true,
            isLoadInitial: false,
            isLoadPending: false,
            isLoadSuccess: false,
            loadError: "I'm afraid I can't do that, Dave.",

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          })),
        });

        m = 'manager.state';
        assert.deepEqual(
          manager.state,
          {
            config: undefined,
            metadata: {
              dataVersion: 123,
              schemaVersion: 321,
            },
            hasBeenHydrated: true,

            // Load state
            loadStatus: 'error',
            isLoadError: true,
            isLoadInitial: false,
            isLoadPending: false,
            isLoadSuccess: false,
            loadError: "I'm afraid I can't do that, Dave.",

            // Save state
            saveStatus: 'initial',
            saveError: null,
            isSaveInitial: true,
            isSavePending: false,
            isSaveSuccess: false,
            isSaveError: false,
          },
          m
        );

        m = 'manager.loadStatus';
        assert.equal(manager.loadStatus, 'error', m);

        m = 'manager.loadError';
        assert.equal(manager.loadError, "I'm afraid I can't do that, Dave.", m);

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

        m = 'manager.isLoadInitial';
        assert.equal(manager.isLoadInitial, false, m);

        m = 'manager.isLoadPending';
        assert.equal(manager.isLoadPending, false, m);

        m = 'manager.isLoadSuccess';
        assert.equal(manager.isLoadSuccess, false, m);

        m = 'manager.isLoadError';
        assert.equal(manager.isLoadError, true, m);

        m = 'manager.hasBeenHydrated';
        assert.equal(manager.hasBeenHydrated, true, m);
      });
    });
  });
});
