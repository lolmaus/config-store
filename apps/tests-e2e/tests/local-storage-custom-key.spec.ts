import {expect, type Page} from '@playwright/test';
import {test} from '../fixtures';
import {BASE_URL} from '../playwright.config';
import {getStateFromLocalStorage, presetStateToLocalStorage} from '../utils';

let m;
const LS_KEY = 'my-app-settings';
const URL = `${BASE_URL}/local-storage-custom-key`;

test('starting with empty localStorage, should display default value', async ({page}) => {
  await page.goto(URL);

  const stateStr = await getStateFromLocalStorage(page, LS_KEY);

  m = 'state in localStorage should be empty';
  await expect(stateStr, m).toBeFalsy();

  const checkbox = page.locator('input[type="checkbox"]');

  m = 'checkbox should be checked by default';
  await expect(checkbox, m).toBeChecked();

  m = 'should NOT display toast';
  await test.step(m, async () => {
    const toast = page.locator('[role="status"]');
    await expect(toast).toHaveCount(0);
  });
});

test('toggling the checkbox should update localStorage and persist after reload', async ({
  page,
}) => {
  await page.goto(URL);

  const checkbox = page.locator('input[type="checkbox"]');

  await checkbox.click();

  m = 'checkbox should be unchecked after click';
  await expect(checkbox, m).not.toBeChecked();

  const state = await getStateFromLocalStorage(page, LS_KEY);

  m = 'state in localStorage should reflect unchecked state';
  await expect(state, m).toEqual({
    config: {
      menuExpanded: false,
      darkTheme: false,
    },
    metadata: {
      schemaVersion: 1,
      dataVersion: 1,
    },
  });

  // Reload the page
  await page.reload();

  m = 'checkbox should remain unchecked after reload';
  await expect(checkbox, m).not.toBeChecked();

  m = 'should NOT display toast';
  await test.step(m, async () => {
    const toast = page.locator('[role="status"]');
    await expect(toast).toHaveCount(0);
  });
});

test.describe(() => {
  presetStateToLocalStorage(
    {
      config: {
        menuExpanded: false,
        darkTheme: true,
      },
      metadata: {
        schemaVersion: 1,
        dataVersion: 5,
      },
    },
    LS_KEY
  );

  test('pre-filling localStorage should reflect in UI on load', async ({page}) => {
    await page.goto(URL);

    const checkbox = page.locator('input[type="checkbox"]');

    m = 'checkbox should be unchecked based on pre-filled localStorage';
    await expect(checkbox, m).not.toBeChecked();

    m = 'should NOT display toast';
    await test.step(m, async () => {
      const toast = page.locator('[role="status"]');
      await expect(toast).toHaveCount(0);
    });
  });
});

test.describe('recovering from corrupt data', () => {
  test.describe(() => {
    presetStateToLocalStorage(
      {
        config: 'lol', // corrupt config
        metadata: {
          schemaVersion: 1,
          dataVersion: 5,
        },
      },
      LS_KEY
    );

    test('recovering from corrupt config', async ({page}) => {
      await page.goto(URL);

      const checkbox = page.locator('input[type="checkbox"]');

      m = 'checkbox should be checked based on recovered default localStorage';
      await expect(checkbox, m).toBeChecked();

      await checkbox.click();

      m = 'checkbox should be unchecked after click';
      await expect(checkbox, m).not.toBeChecked();

      const state = await getStateFromLocalStorage(page, LS_KEY);

      m = 'state in localStorage after click';
      await expect(state, m).toEqual({
        config: {
          menuExpanded: false,
          darkTheme: false,
        },
        metadata: {
          schemaVersion: 1,
          dataVersion: 6,
        },
      });

      m = 'should NOT display toast';
      await test.step(m, async () => {
        const toast = page.locator('[role="status"]');
        await expect(toast).toHaveCount(0);
      });
    });
  });

  test.describe(() => {
    presetStateToLocalStorage('lol', LS_KEY); // completely corrupt envelope

    test('recovering from corrupt envelope', async ({page}) => {
      await page.goto(URL);

      m = 'Should display TanStack Router error';
      await test.step(m, async () => {
        const error = page.locator('pre');
        await expect(error).toHaveText(`[@config-store] Adapter payload failed to parse

ZodError: [
  {
    "expected": "object",
    "code": "invalid_type",
    "path": [],
    "message": "Invalid input: expected object, received string"
  }
]`);
      });

      m = 'checkbox should NOT exist';
      await test.step(m, async () => {
        const checkbox = page.locator('input[type="checkbox"]');
        await expect(checkbox).toHaveCount(0);
      });

      m = 'should NOT display toast';
      await test.step(m, async () => {
        const toast = page.locator('[role="status"]');
        await expect(toast).toHaveCount(0);
      });
    });
  });
});

test('localStorage unavailable, should keep working with default settings', async ({page}) => {
  // Mock localStorage being unavailable
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        return undefined;
      },
      configurable: true,
    });
  });

  await page.goto(URL);

  const checkbox = page.locator('input[type="checkbox"]');

  let m = 'checkbox should fallback to default (checked) when storage is disabled';
  await expect(checkbox, m).toBeChecked();

  await checkbox.click();

  m = 'checkbox should be unchecked after click even without persistent storage';
  await expect(checkbox, m).not.toBeChecked();

  m = 'should NOT display toast';
  await test.step(m, async () => {
    const toast = page.locator('[role="status"]');
    await expect(toast).toHaveCount(0);
  });
});
