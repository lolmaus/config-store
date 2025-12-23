import {useContext, useState, useCallback} from 'react';
// We use the 'useStore' hook from zustand to subscribe to the vanilla store exposed by core.
// This handles useSyncExternalStore + Selectors automatically.
import {useStore} from 'zustand';
import {ConfigContext} from './context.js';

/**
 * Hook to read the configuration.
 *
 * @example
 * // Get full config
 * const config = useConfig<AppConfig>();
 *
 * @example
 * // Select a specific value (renders optimized)
 * const theme = useConfig<AppConfig, string>((state) => state.theme);
 */
export function useConfig<T, TSlice = T>(selector?: (state: T) => TSlice): TSlice {
  const manager = useContext(ConfigContext);

  if (!manager) {
    throw new Error('[@config-store/react] useConfig must be used within a <ConfigProvider>');
  }

  if (!manager.configStore) {
    throw new Error(
      '[@config-store/react] The ConfigManager must have a version defined before using useConfig'
    );
  }

  // We cast the store to the generic T provided by the user.
  // This is safe because the user ensures the Manager<T> passed to Provider matches T here.
  return useStore(manager.configStore, selector as (state: unknown) => TSlice) as TSlice;
}

export interface UseUpdateConfigResult<T> {
  /**
   * Updates the configuration.
   * If the config is an object, the input is merged (shallowly).
   * If the config is a primitive, the input replaces the value.
   */
  update: (partial: Partial<T>) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

/**
 * Hook to update the configuration.
 */
export function useUpdateConfig<T>(): UseUpdateConfigResult<T> {
  const manager = useContext(ConfigContext);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (!manager) {
    throw new Error('[@config-store/react] useUpdateConfig must be used within a <ConfigProvider>');
  }

  const update = useCallback(
    async (partial: Partial<T>) => {
      setIsSaving(true);
      setError(null);

      try {
        const current = manager.config as T;

        let nextConfig: T;

        // Smart Merge:
        // If current state is an object (and not null), we treat 'partial' as a subset to merge.
        // Otherwise (primitives), we treat 'partial' as the new value.
        if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
          nextConfig = {
            ...current,
            ...partial,
          };
        } else {
          // It's a primitive or array, so we assume the partial is actually the full new value
          // We use 'as T' because Partial<Primitive> is just Primitive.
          nextConfig = partial as T;
        }

        await manager.save(nextConfig);
      } catch (err) {
        if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error('Unknown error during config update'));
        }
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [manager]
  );

  return {update, isSaving, error};
}

/**
 * Creates a set of typed hooks bound to your specific Config type.
 * This avoids the need to manually pass generic types to useConfig every time.
 *
 * @example
 * export const { useConfig, useUpdateConfig } = createHooks<MyConfig>();
 */
export function createHooks<T>() {
  return {
    useConfig: <TSlice = T>(selector?: (state: T) => TSlice) => useConfig<T, TSlice>(selector),
    useUpdateConfig: () => useUpdateConfig<T>(),
  };
}
