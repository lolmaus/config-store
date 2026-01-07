import {expect, type Page} from '@playwright/test';
import {test} from '../fixtures';
import {BASE_URL} from '../playwright.config';
import {presetStateToLocalStorage} from '../utils';

let m;
const LS_KEY = '@lolmaus/config-store';
const URL = `${BASE_URL}/local-storage-successful-migration`;

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

  test('upgrading schema', async ({page}) => {
    await page.goto(URL);

    m = 'checkbox should NOT be checked based on migrated state';
    await test.step(m, async () => {
      const checkbox = page.locator('input[type="checkbox"]');
      await expect(checkbox).not.toBeChecked();
    });

    m = 'state snapshot in memory';
    await test.step(m, async () => {
      const pre = page.locator('pre').first();
      await expect(pre).toHaveText(
        `{
  "config": {
    "menuCollapsed": true,
    "theme": "dark"
  },
  "metadata": {
    "dataVersion": 5,
    "schemaVersion": 2
  },
  "hasBeenHydrated": true,
  "loadStatus": "success",
  "loadError": null,
  "isLoadInitial": false,
  "isLoadPending": false,
  "isLoadSuccess": true,
  "isLoadError": false,
  "saveStatus": "initial",
  "saveError": null,
  "isSaveInitial": true,
  "isSavePending": false,
  "isSaveSuccess": false,
  "isSaveError": false
}`
      );
    });

    m = 'should NOT display toast';
    await test.step(m, async () => {
      const toast = page.locator('[role="status"]');
      await expect(toast).toHaveCount(0);
    });
  });
});
