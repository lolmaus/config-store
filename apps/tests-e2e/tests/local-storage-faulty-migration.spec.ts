import {expect, type Page} from '@playwright/test';
import {test} from '../fixtures';
import {BASE_URL} from '../playwright.config';
import {getStateFromLocalStorage, presetStateToLocalStorage} from '../utils';

let m;
const LS_KEY = '@lolmaus/config-store';
const URL = `${BASE_URL}/local-storage-faulty-migration`;

test.describe(() => {
  presetStateToLocalStorage(
    {
      config: {
        menuExpanded: false,
        darkTheme: true,
      }, // corrupt config
      metadata: {
        schemaVersion: 1,
        dataVersion: 5,
      },
    },
    LS_KEY
  );

  test('recovering from corrupt envelope', async ({page}) => {
    await page.goto(URL);

    m = 'should display migration error toast';
    await test.step(m, async () => {
      const toast = page.locator('[role="status"]');
      await expect(toast).toHaveText(/Migration Error: Simulated migration failure/);
    });

    m = 'checkbox should be checked based on recovered default localStorage';
    await test.step(m, async () => {
      const checkbox = page.locator('input[type="checkbox"]');
      await expect(checkbox).toBeChecked();
    });

    m = 'state snapshot in memory';
    await test.step(m, async () => {
      const pre = page.locator('pre').first();
      await expect(pre).toHaveText(
        `{
  "config": {
    "menuExpanded": true,
    "darkTheme": "light"
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
  });
});
