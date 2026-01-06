import type {Page} from '@playwright/test';
import {test} from './fixtures';
import {BASE_URL} from './playwright.config';

export function getStateFromLocalStorage(page: Page, key: string): Promise<unknown | undefined> {
  // No closures inside page.evaluate!!!
  return page.evaluate<unknown | undefined, string>((key) => {
    const resultStr = window.localStorage.getItem(key);

    return resultStr?.length ? JSON.parse(resultStr) : undefined;
  }, key);
}

export function presetStateToLocalStorage(state: unknown, key: string): void {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            {
              name: key,
              value: JSON.stringify(state),
            },
          ],
        },
      ],
    },
  });
}
