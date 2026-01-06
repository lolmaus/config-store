import {test as base} from '@playwright/test';
import {BASE_URL} from './playwright.config.js';

type MyOptions = {
  baseURLz: string;
};

export const test = base.extend<MyOptions>({
  baseURLz: [BASE_URL, {option: true}],
});

test.use({
  baseURL: BASE_URL,
});
