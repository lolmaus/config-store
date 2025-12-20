import {createContext} from 'react';
import type {ConfigManager} from '@config-store/core';

/**
 * The Context holds the Manager instance.
 * We must use `unknown` here because React Context cannot preserve
 * the Generic type of the Manager created by the user.
 *
 * The `useConfig` hook will cast this back to the user's specific Generic type.
 */
export const ConfigContext = createContext<ConfigManager<unknown> | null>(null);
