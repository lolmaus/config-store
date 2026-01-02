import {useContext, useCallback} from 'react';
// We use the 'useStore' hook from zustand to subscribe to the vanilla store exposed by core.
// This handles useSyncExternalStore + Selectors automatically.
import {useStore} from 'zustand';
import {useShallow} from 'zustand/shallow';
import {ConfigContext} from './context.js';
import type {ManagerState, ConfigManager} from '@config-store/core';
import type {
  UseUpdateConfigResult,
  ConfigMutator,
  ConfigReducer,
  UseUpdateConfigReducerResult,
  ConfigSelector,
} from './types.js';

/**
 * Example:
 *
 * ```ts *
 * const mySettings: MySettings = useConfig<MySettings>();
 * ```
 *
 * ⭐ Use with `createHooks` to avoid passing the `TConfig` generic explicitly:
 *
 * ```ts
 * export const {useConfig} = createHooks<MySettings>();
 *
 * const mySettings: MySettings = useConfig();
 * ```
 *
 * @template TConfig The type of the configuration.
 * @returns The entire configuration object.
 */
export function useConfig<TConfig>(): TConfig;
/**
 *
 * Pass a {@link ConfigSelector} function to access a specific property:
 *
 * ```ts
 * const theme: string = useConfig<MySettings, string>((c) => c.theme);
 * ```
 *
 * ⭐ Use with `createHooks` to avoid passing the `TConfig` generic explicitly:
 *
 * ```ts
 * export const {useConfig} = createHooks<MySettings>();
 *
 * const theme: string = useConfig<string>((c) => c.theme);
 * ```
 *
 * @template TConfig The type of the configuration.
 * @template TSelected The selected value.
 * @param selector - A function that selects a value from the config.
 * @returns The selected value.
 */
export function useConfig<TConfig, TSelected>(
  selector: ConfigSelector<TConfig, TSelected>
): TSelected;
/**
 * Hook to read the config.
 *
 * - If no selector is passed, it returns the entire config object.
 * - If a selector is passed, it returns a given property and prevents unnecessary rerenders.
 */
export function useConfig<TConfig, TSelected>(
  selector?: ConfigSelector<TConfig, TSelected>
): TConfig | TSelected {
  const manager = useContext(ConfigContext) as ConfigManager<TConfig>;

  if (!manager) {
    throw new Error('[@config-store/react] useConfig must be used within a <ConfigProvider>');
  }

  if (!manager.store) {
    throw new Error(
      '[@config-store/react] The ConfigManager must have a version defined before using useConfig'
    );
  }

  return useStore(manager.store, (state) => {
    if (selector) {
      return selector(state.config, state);
    }
    // If no selector is provided, we return the whole config.
    // We cast to TSelected (which acts as the return type union) to satisfy the implementation signature.
    return state.config as unknown as TSelected;
  });
}

/**
 * Hook to update the configuration.
 *
 * Supports direct replacement or inline mutation function.
 *
 * @template TConfig The type of the configuration.
 * @returns An object containing the `update` function and status flags.
 */
export function useUpdateConfig<TConfig>(): UseUpdateConfigResult<TConfig> {
  const manager = useContext(ConfigContext) as ConfigManager<TConfig>;

  if (!manager) {
    throw new Error('[@config-store/react] useUpdateConfig must be used within a <ConfigProvider>');
  }

  const update = useCallback(
    async (configOrMutator: TConfig | ConfigMutator<TConfig>) => {
      let newConfig: TConfig;

      if (typeof configOrMutator === 'function') {
        const state = manager.store.getState();
        // We assume TConfig is not a function type based on library constraints
        const mutator = configOrMutator as ConfigMutator<TConfig>;
        newConfig = mutator(state.config, state);
      } else {
        newConfig = configOrMutator;
      }

      return await manager.save(newConfig);
    },
    [manager]
  );

  const state = useStore(
    manager.store,
    useShallow((state) => ({
      isInitial: state.isSaveInitial,
      isPending: state.isSavePending,
      isSuccess: state.isSaveSuccess,
      isError: state.isSaveError,
      status: state.saveStatus,
      error: state.saveError,
    }))
  );

  return {update, ...state};
}

/**
 * Hook to update the configuration using a Reducer pattern.
 * Best for complex logic or reusable actions.
 *
 * @template TConfig The type of the configuration.
 * @template TPayload The type of the action payload accepted by the reducer.
 * @param reducer A function that takes current config and a payload, returning the new config.
 * @returns An object containing the `update(payload)` function and status flags.
 */
export function useUpdateConfigReducer<TConfig, TPayload>(
  reducer: ConfigReducer<TConfig, TPayload>
): UseUpdateConfigReducerResult<TConfig, TPayload> {
  const manager = useContext(ConfigContext) as ConfigManager<TConfig>;

  if (!manager) {
    throw new Error(
      '[@config-store/react] useUpdateConfigReducer must be used within a <ConfigProvider>'
    );
  }

  const update = useCallback(
    async (payload: TPayload) => {
      const state = manager.store.getState();
      const newConfig = reducer(state.config, payload, state);
      return await manager.save(newConfig);
    },
    [manager, reducer]
  );

  const state = useStore(
    manager.store,
    useShallow((state) => ({
      isInitial: state.isSaveInitial,
      isPending: state.isSavePending,
      isSuccess: state.isSaveSuccess,
      isError: state.isSaveError,
      status: state.saveStatus,
      error: state.saveError,
    }))
  );

  return {update, ...state};
}

/**
 * Creates a set of typed hooks bound to your specific Config type.
 * Use this to avoid passing the generic type `<MyConfig>` to every hook usage.
 *
 * @template TConfig The type of the configuration.
 */
export function createHooks<TConfig>() {
  return {
    useConfig: <TSelected = TConfig>(
      selector?: (config: TConfig, state: ManagerState<TConfig>) => TSelected
    ): TSelected => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return useConfig<TConfig, TSelected>(selector as any);
    },

    useUpdateConfig: () => useUpdateConfig<TConfig>(),

    useUpdateConfigReducer: <TPayload>(reducer: ConfigReducer<TConfig, TPayload>) =>
      useUpdateConfigReducer<TConfig, TPayload>(reducer),
  };
}
