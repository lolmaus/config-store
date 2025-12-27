import type {
  ManagerRequestStatus,
  ManagerState,
} from 'node_modules/@config-store/core/src/types.js';

/**
 * A pure function that selects a value from the current config.
 */
export type ConfigSelector<TConfig, TSelected> = (
  config: TConfig,
  state: ManagerState<TConfig>
) => TSelected;

/**
 * A pure function that mutates/transforms the current config.
 *
 * Optionally used in the `update` function returned by `useUpdateConfig()`.
 *
 * @returns The entire config.
 */
export type ConfigMutator<TConfig> = (config: TConfig, state: ManagerState<TConfig>) => TConfig;

/**
 * A reducer that applies a given payload to the current config.
 * Passed into `useUpdateConfigReducer()` to produce a simplified `update` function..
 */
export type ConfigReducer<TConfig, TPayload> = (
  config: TConfig,
  payload: TPayload,
  state: ManagerState<TConfig>
) => TConfig;

/**
 * Return value of the `useUpdateConfig` hook.
 */
export interface UseUpdateConfigResult<TConfig> {
  /**
   * Replaces the entire config with the provided value.
   */
  update(config: TConfig): Promise<TConfig>;
  /**
   * Updates the config using a mutator function.
   */
  update(mutator: ConfigMutator<TConfig>): Promise<TConfig>;

  isInitial: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  status: ManagerRequestStatus;
  error: unknown;
}

/**
 * Return value of the `useUpdateConfigReducer` hook.
 */
export interface UseUpdateConfigReducerResult<TConfig, TPayload> {
  /**
   * Updates the config by dispatching a payload to the defined reducer.
   */
  update(payload: TPayload): Promise<TConfig>;

  isInitial: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  status: ManagerRequestStatus;
  error: unknown;
}
