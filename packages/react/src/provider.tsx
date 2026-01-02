import React, {type ReactNode} from 'react';
import type {ConfigManager} from '@config-store/core';
import {ConfigContext} from './context.js';

export interface ConfigProviderProps<T> {
  /** The initialized ConfigManager instance. */
  value: ConfigManager<T>;
  /** The React application or component tree to wrap. */
  children: ReactNode;
}

/**
 * Provides the ConfigManager to the application tree via React Context.
 * Required for `useConfig`, `useUpdateConfig` and `useUpdateConfigReducer` hooks to work.
 */
export function ConfigProvider<T>({value, children}: ConfigProviderProps<T>) {
  return (
    <ConfigContext.Provider value={value as ConfigManager<unknown>}>
      {children}
    </ConfigContext.Provider>
  );
}
