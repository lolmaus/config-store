// 1. MUST BE THE FIRST IMPORT
import {teardown} from './test-setup.js';

import {describe, it, mock, beforeEach, afterEach, after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {z} from 'zod';
import {render, screen, waitFor, act, cleanup} from '@testing-library/react';

// Added BaseAdapter to imports
import {ConfigManager, LocalStorageAdapter, BaseAdapter} from '@config-store/core';
import {ConfigProvider} from './provider.js';
import {useConfig, useUpdateConfig, createHooks} from './hooks.js';

// --- Mock Setup ---
// Explicitly type as BaseAdapter to allow Async mock implementations later
const mockAdapter: BaseAdapter = new LocalStorageAdapter({key: 'test'});
mockAdapter.write = mock.fn((config, meta) => ({config, metadata: meta}));
mockAdapter.read = mock.fn(() => undefined);

const schema = z.object({theme: z.string().default('light')}).prefault({});
type Config = z.infer<typeof schema>;

const createTestManager = () => {
  return ConfigManager.create(mockAdapter).addVersion({
    version: 1,
    schema,
  });
};

describe('React Hooks', () => {
  let manager: ConfigManager<Config>;
  let m: string;

  beforeEach(async () => {
    // Reset DOM state before each test
    document.body.innerHTML = '';

    // Reset adapter behavior to "Success" for every test by default
    mockAdapter.write = mock.fn((config, meta) => ({config, metadata: meta}));

    manager = createTestManager();
    await manager.load();
  });

  afterEach(() => {
    mock.reset();
    cleanup(); // Clean up React trees
  });

  after(() => {
    teardown();
  });

  it('useConfig() reads from the store', () => {
    const TestComponent = () => {
      const config = useConfig<Config>();
      return <div data-testid="val">{config.theme}</div>;
    };

    render(
      <ConfigProvider value={manager}>
        <TestComponent />
      </ConfigProvider>
    );

    m = 'Component should render the initial theme "light" from the store';
    assert.strictEqual(screen.getByTestId('val').textContent, 'light', m);
  });

  it('useConfig(selector) selects specific data', () => {
    const TestComponent = () => {
      const theme = useConfig<Config, string>((s) => s.theme);
      return <div data-testid="val">{theme}</div>;
    };

    render(
      <ConfigProvider value={manager}>
        <TestComponent />
      </ConfigProvider>
    );

    m = 'Selector should extract and render only the theme "light"';
    assert.strictEqual(screen.getByTestId('val').textContent, 'light', m);
  });

  it('useUpdateConfig() updates the store', async () => {
    const TestComponent = () => {
      const config = useConfig<Config>();
      const {update} = useUpdateConfig<Config>();

      return (
        <div>
          <div data-testid="val">{config.theme}</div>
          <button onClick={() => update({theme: 'dark'})}>Update</button>
        </div>
      );
    };

    render(
      <ConfigProvider value={manager}>
        <TestComponent />
      </ConfigProvider>
    );

    const btn = screen.getByText('Update');

    await act(async () => {
      btn.click();
    });

    await waitFor(() => {
      m = 'UI should update to "dark" after click';
      assert.strictEqual(screen.getByTestId('val').textContent, 'dark', m);
    });

    m = 'Manager state should match the updated value "dark"';
    assert.strictEqual(manager.get().theme, 'dark', m);
  });

  it('useUpdateConfig() merges partial objects', async () => {
    const complexSchema = z
      .object({
        theme: z.string().default('light'),
        notifications: z.boolean().default(true),
      })
      .prefault({});
    type ComplexConfig = z.infer<typeof complexSchema>;

    const complexManager = ConfigManager.create(mockAdapter).addVersion({
      version: 1,
      schema: complexSchema,
    });
    await complexManager.load();

    const TestComponent = () => {
      const {update} = useUpdateConfig<ComplexConfig>();
      return <button onClick={() => update({theme: 'dark'})}>Update</button>;
    };

    render(
      <ConfigProvider value={complexManager}>
        <TestComponent />
      </ConfigProvider>
    );

    const btn = screen.getByText('Update');

    await act(async () => {
      btn.click();
    });

    const state = complexManager.get();

    m = 'Theme should be updated to "dark"';
    assert.strictEqual(state.theme, 'dark', m);

    m = 'Notifications should remain "true" (merged, not overwritten)';
    assert.strictEqual(state.notifications, true, m);
  });

  it('useUpdateConfig() reports isSaving state', async () => {
    // 1. Mock a slow adapter
    let resolveSave: (value: unknown) => void;

    // We overwrite the write mock for this specific test
    mockAdapter.write = mock.fn(async (config, meta) => {
      return new Promise((resolve) => {
        resolveSave = resolve;
      }).then(() => ({config, metadata: meta}));
    });

    const TestComponent = () => {
      const {update, isSaving} = useUpdateConfig<Config>();
      return (
        <div>
          <div data-testid="status">{isSaving ? 'Saving...' : 'Idle'}</div>
          <button onClick={() => update({theme: 'dark'})}>Update</button>
        </div>
      );
    };

    render(
      <ConfigProvider value={manager}>
        <TestComponent />
      </ConfigProvider>
    );

    m = 'Should be Idle initially';
    assert.strictEqual(screen.getByTestId('status').textContent, 'Idle', m);

    const btn = screen.getByText('Update');

    // 2. Click update
    await act(async () => {
      btn.click();
    });

    // 3. Assert loading state (promise is pending)
    m = 'Should be Saving... while promise is pending';
    assert.strictEqual(screen.getByTestId('status').textContent, 'Saving...', m);

    // 4. Resolve the promise
    await act(async () => {
      if (resolveSave) resolveSave(undefined);
    });

    // 5. Assert idle state
    m = 'Should return to Idle after resolution';
    assert.strictEqual(screen.getByTestId('status').textContent, 'Idle', m);
  });

  it('useUpdateConfig() reports errors', async () => {
    // 1. Mock a failing adapter
    mockAdapter.write = mock.fn(async () => {
      throw new Error('Network Error');
    });

    const TestComponent = () => {
      const {update, error, isSaving} = useUpdateConfig<Config>();
      return (
        <div>
          <div data-testid="status">{isSaving ? 'Saving...' : 'Idle'}</div>
          <div data-testid="error">{error ? error.message : 'No Error'}</div>
          {/* We catch the promise here to prevent UnhandledRejection in the test runner */}
          <button onClick={() => update({theme: 'dark'}).catch(() => {})}>Update</button>
        </div>
      );
    };

    render(
      <ConfigProvider value={manager}>
        <TestComponent />
      </ConfigProvider>
    );

    const btn = screen.getByText('Update');

    await act(async () => {
      btn.click();
    });

    // Use waitFor to allow the error state update to render
    await waitFor(() => {
      m = 'Should expose the error object';
      assert.strictEqual(screen.getByTestId('error').textContent, 'Network Error', m);
    });

    m = 'Should return to Idle state after error';
    assert.strictEqual(screen.getByTestId('status').textContent, 'Idle', m);
  });

  describe('createHooks() factory', () => {
    // Generate typed hooks once
    const {useConfig: useTypedConfig, useUpdateConfig: useTypedUpdate} = createHooks<Config>();

    it('infers types correctly without explicit generics', () => {
      const TestComponent = () => {
        // No <Config> needed here!
        // TypeScript infers 'theme' as string because 's' is inferred as Config
        const theme = useTypedConfig((s) => s.theme);
        return <div data-testid="val">{theme}</div>;
      };

      render(
        <ConfigProvider value={manager}>
          <TestComponent />
        </ConfigProvider>
      );

      m = 'Generated hook should work exactly like the raw hook';
      assert.strictEqual(screen.getByTestId('val').textContent, 'light', m);
    });

    it('generated update hook works correctly', async () => {
      const TestComponent = () => {
        const {update} = useTypedUpdate();
        return <button onClick={() => update({theme: 'dark'})}>Update</button>;
      };

      render(
        <ConfigProvider value={manager}>
          <TestComponent />
        </ConfigProvider>
      );

      const btn = screen.getByText('Update');
      await act(async () => {
        btn.click();
      });

      m = 'Generated update hook should update the store';
      assert.strictEqual(manager.get().theme, 'dark', m);
    });
  });
});
