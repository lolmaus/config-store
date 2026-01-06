import {teardown} from './test-setup.js'; // Must be the first import

import {describe, it, mock, beforeEach, afterEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {type ReactNode} from 'react';
import {z} from 'zod';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';

import {ConfigManager, BaseAdapter} from '@config-store/core';
import {ConfigProvider} from './provider.js';
import {createHooks} from './hooks.js';
import type {AdapterEnvelope, ManagerMetadata} from '@config-store/core';
import type {UseUpdateConfigResult, UseUpdateConfigReducerResult} from './types.js';

describe('React Hooks', () => {
  let manager: ConfigManager<Config>;
  let m: string;

  // --- Mock Setup ---
  class TestAdapter extends BaseAdapter {
    state: AdapterEnvelope<Config> | undefined = undefined;

    read() {
      return this.state;
    }
    write(config: Config, metadata: ManagerMetadata) {
      return (this.state = {config, metadata});
    }
  }

  const adapter = new TestAdapter();

  const ConfigSchema = z
    .object({
      theme: z.literal(['light', 'dark']).default('light'),
      nested: z
        .object({
          setting: z.boolean().default(false),
        })
        .prefault({}),
    })
    .prefault({});

  type Config = z.infer<typeof ConfigSchema>;

  // We now pull useUpdateConfigReducer as well
  const {useConfig, useUpdateConfig, useUpdateConfigReducer} = createHooks<Config>();

  function Wrapper({children}: {children: ReactNode}) {
    return <ConfigProvider value={manager}>{children}</ConfigProvider>;
  }

  beforeEach(async () => {
    // Reset DOM state before each test
    document.body.innerHTML = '';

    manager = ConfigManager.create(
      {adapter},
      {
        version: 1,
        schema: ConfigSchema,
      }
    );
  });

  afterEach(() => {
    mock.reset();
    cleanup(); // Clean up React trees
  });

  after(() => {
    teardown();
  });

  describe('useConfig', () => {
    it('initial value, full config', () => {
      const {result} = renderHook(() => useConfig(), {wrapper: Wrapper});

      m = 'result';
      assert.deepEqual(result.current, {theme: 'light', nested: {setting: false}}, m);
    });

    it('loaded value, full config', async () => {
      adapter.state = {
        config: {theme: 'dark', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      await manager.load();

      const {result} = renderHook(() => useConfig(), {wrapper: Wrapper});

      m = 'result';
      assert.deepEqual(result.current, {theme: 'dark', nested: {setting: false}}, m);
    });

    it('initial value, selector', () => {
      // Now we use useConfig with a selector
      const {result} = renderHook(() => useConfig((c) => c.theme), {wrapper: Wrapper});

      m = 'result';
      assert.deepEqual(result.current, 'light', m);
    });

    it('loaded value, selector', async () => {
      adapter.state = {
        config: {theme: 'dark', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      await manager.load();

      const {result} = renderHook(() => useConfig((s) => s.theme), {wrapper: Wrapper});

      m = 'result';
      assert.deepEqual(result.current, 'dark', m);
    });
  });

  describe('useUpdateConfig', () => {
    it('success, no initial load, passing full config object', async () => {
      let resolveWrite: (value: unknown) => void;

      const writePromise = new Promise((resolve) => {
        resolveWrite = resolve;
      });

      const originalWrite = adapter.write;

      mock.method(
        adapter,
        'write',
        async function (this: typeof adapter, ...args: Parameters<typeof originalWrite>) {
          await writePromise;
          return originalWrite.apply(this, args);
        }
      );

      adapter.state = {
        config: {theme: 'light', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      const {result} = renderHook(() => useUpdateConfig(), {wrapper: Wrapper});

      await act(async () => {
        // Direct object replacement
        result.current.update({theme: 'dark', nested: {setting: false}});
      });

      m = 'result.current immediately after triggering the update';
      await waitFor(() => {
        assert.partialDeepStrictEqual(
          result.current,
          {
            status: 'pending',
            isInitial: false,
            isPending: true,
            isSuccess: false,
            isError: false,
            error: null,
          } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
          m
        );
      });

      await act(async () => {
        resolveWrite({
          config: {theme: 'dark'},
          metadata: {schemaVersion: 1, dataVersion: 2},
        });
        await writePromise;
      });

      m = 'Manager store should be updated to dark';
      assert.equal(manager.config.theme, 'dark', m);

      m = 'result.current final';
      assert.partialDeepStrictEqual(
        result.current,
        {
          status: 'success',
          isInitial: false,
          isPending: false,
          isSuccess: true,
          isError: false,
          error: null,
        } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
        m
      );
    });

    it('success, no initial load, passing ConfigMutator callback', async () => {
      let resolveWrite: (value: unknown) => void;

      const writePromise = new Promise((resolve) => {
        resolveWrite = resolve;
      });

      const originalWrite = adapter.write;

      mock.method(
        adapter,
        'write',
        async function (this: typeof adapter, ...args: Parameters<typeof originalWrite>) {
          await writePromise;
          return originalWrite.apply(this, args);
        }
      );

      adapter.state = {
        config: {theme: 'light', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      const {result} = renderHook(() => useUpdateConfig(), {wrapper: Wrapper});

      await act(async () => {
        // Inline Mutator function
        result.current.update((config) => ({...config, theme: 'dark'}));
      });

      m = 'result.current immediately after triggering the update';
      await waitFor(() => {
        assert.partialDeepStrictEqual(
          result.current,
          {
            status: 'pending',
            isInitial: false,
            isPending: true,
            isSuccess: false,
            isError: false,
            error: null,
          } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
          m
        );
      });

      await act(async () => {
        resolveWrite({
          config: {theme: 'dark'},
          metadata: {schemaVersion: 1, dataVersion: 2},
        });
        await writePromise;
      });

      m = 'Manager store should be updated to dark';
      assert.equal(manager.config.theme, 'dark', m);

      m = 'result.current final';
      assert.partialDeepStrictEqual(
        result.current,
        {
          status: 'success',
          isInitial: false,
          isPending: false,
          isSuccess: true,
          isError: false,
          error: null,
        } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
        m
      );
    });

    it('Error on update', async () => {
      let rejectWrite: (value: unknown) => void;

      const writePromise = new Promise((_resolve, reject) => {
        rejectWrite = reject;
      });

      const originalWrite = adapter.write;

      mock.method(
        adapter,
        'write',
        async function (this: typeof adapter, ...args: Parameters<typeof originalWrite>) {
          await writePromise;
          return originalWrite.apply(this, args);
        }
      );

      adapter.state = {
        config: {theme: 'light', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      const {result} = renderHook(() => useUpdateConfig(), {wrapper: Wrapper});

      let updatePromise: Promise<Config>;

      await act(async () => {
        updatePromise = result.current.update({theme: 'dark', nested: {setting: false}});
        updatePromise.catch(() => {});
      });

      m = 'result.current immediately after triggering the update';
      await waitFor(() => {
        assert.partialDeepStrictEqual(
          result.current,
          {
            status: 'pending',
            isInitial: false,
            isPending: true,
            isSuccess: false,
            isError: false,
            error: null,
          } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
          m
        );
      });

      await act(async () => {
        rejectWrite({message: 'No fate but what we make'});
        m = 'The promise returned by update should have rejected';
        await assert.rejects(
          updatePromise,
          (e) =>
            !!e &&
            typeof e === 'object' &&
            'message' in e &&
            e.message === 'No fate but what we make',
          m
        );
      });

      m = 'Manager store should be updated to dark (optimistically/internally)';
      assert.equal(manager.config.theme, 'dark', m);

      m = 'result.current final';
      assert.partialDeepStrictEqual(
        result.current,
        {
          status: 'error',
          isInitial: false,
          isPending: false,
          isSuccess: false,
          isError: true,
          error: {message: 'No fate but what we make'},
        } satisfies Omit<UseUpdateConfigResult<Config>, 'update'>,
        m
      );
    });
  });

  describe('useUpdateConfigReducer', () => {
    it('success, with Reducer definition (Action style)', async () => {
      let resolveWrite: (value: unknown) => void;

      const writePromise = new Promise((resolve) => {
        resolveWrite = resolve;
      });

      const originalWrite = adapter.write;

      mock.method(
        adapter,
        'write',
        async function (this: typeof adapter, ...args: Parameters<typeof originalWrite>) {
          await writePromise;
          return originalWrite.apply(this, args);
        }
      );

      adapter.state = {
        config: {theme: 'light', nested: {setting: false}},
        metadata: {schemaVersion: 1, dataVersion: 1},
      } satisfies AdapterEnvelope<Config>;

      const {result} = renderHook(
        () =>
          // Use the reducer hook here
          useUpdateConfigReducer((config, setting: boolean) => ({
            ...config,
            nested: {setting},
          })),
        {
          wrapper: Wrapper,
        }
      );

      m = 'Manager store initial setting value';
      assert.equal(manager.config.nested.setting, false, m);

      await act(async () => {
        // Update now takes strictly the Payload (boolean)
        result.current.update(true);
      });

      m = 'result.current immediately after triggering the update';
      await waitFor(() => {
        assert.partialDeepStrictEqual(
          result.current,
          {
            status: 'pending',
            isInitial: false,
            isPending: true,
            isSuccess: false,
            isError: false,
            error: null,
          } satisfies Omit<UseUpdateConfigReducerResult<Config, boolean>, 'update'>,
          m
        );
      });

      await act(async () => {
        resolveWrite({
          config: {theme: 'dark'},
          metadata: {schemaVersion: 1, dataVersion: 2},
        });
        await writePromise;
      });

      m = 'Manager store should be updated to true';
      assert.equal(manager.config.nested.setting, true, m);

      m = 'result.current final';
      assert.partialDeepStrictEqual(
        result.current,
        {
          status: 'success',
          isInitial: false,
          isPending: false,
          isSuccess: true,
          isError: false,
          error: null,
        } satisfies Omit<UseUpdateConfigReducerResult<Config, boolean>, 'update'>,
        m
      );
    });
  });
});
