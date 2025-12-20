import React, {type ReactNode} from 'react';
import type {ConfigManager} from '@config-store/core';
import {ConfigContext} from './context.js';

export interface ConfigProviderProps<T> {
  value: ConfigManager<T>;
  children: ReactNode;
}

/**
 * Provides the ConfigManager to the application tree.
 */
export function ConfigProvider<T>({value, children}: ConfigProviderProps<T>) {
  return (
    <ConfigContext.Provider value={value as ConfigManager<unknown>}>
      {children}
    </ConfigContext.Provider>
  );
}
