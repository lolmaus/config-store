import type {
  ManagerRequestStatus,
  ManagerState,
} from 'node_modules/@config-store/core/src/types.js';

/**
 * A pure function that selects a value from the current config.
 * Used to optimize re-renders by only triggering updates when the selected value changes.
 *
 * Example:
 *
 * ```ts "(config) => config.theme"
 * useConfig<MySettings, string>((config) => config.theme);
 * ```
 *
 * @template TConfig The type of the configuration
 * @template TSelected The selected value
 * @param config The entire config
 * @param state The state of {@link ConfigManager}, typically not needed
 * @returns The selected value
 */
export type ConfigSelector<TConfig, TSelected> = (
  config: TConfig,
  state: ManagerState<TConfig>
) => TSelected;

/**
 * A pure function that transforms the current config.
 *
 * ⚠️ Despite, the name, you should not actually mutate the config. Instead, return a new config instance.
 *
 * Optionally used in the `update` function returned by `useUpdateConfig()`.
 * Allows deriving the new state from the previous state.
 *
 * Example:
 *
 * ```ts {4-7}
 * const {update} = useUpdateConfig();
 *
 * update(
 *  (config) => ({
 *     ...config,
 *     theme: userInput,
 *   })
 * );
 * ```
 *
 * @template TConfig The type of the config
 * @param config The entire config
 * @param state The state of {@link ConfigManager}, typically not needed
 * @returns The entire modified config
 */
export type ConfigMutator<TConfig> = (config: TConfig, state: ManagerState<TConfig>) => TConfig;

/**
 * A reducer that applies a given payload to the current config.
 *
 * Passed into `useUpdateConfigReducer()` to produce a simplified `update` function
 * that only requires the payload.
 *
 * Example:
 *
 * @template TConfig The type of the config
 * @template TPayload The type of the value passed into the update function that the reducer must apply to the config
 * @param config The entire config
 * @param payload The value passed into the update function that the reducer must apply to the config
 * @param state The state of {@link ConfigManager}, typically not needed
 * @returns The entire modified config
 */
export type ConfigReducer<TConfig, TPayload> = (
  config: TConfig,
  payload: TPayload,
  state: ManagerState<TConfig>
) => TConfig;

/**
 * Return value of the `useUpdateConfig` hook.
 * Contains the update function and the current status of the save operation.
 *
 * @template TConfig The type of the config
 */
export interface UseUpdateConfigResult<TConfig> {
  /**
   * Replaces the entire config with the provided value.
   *
   * @param config The entire config
   * @returns The entire modified config
   */
  update(config: TConfig): Promise<TConfig>;
  /**
   * Updates the config using a mutator function.
   *
   * @param mutator The function that updates the config
   * @returns The entire modified config
   */
  update(mutator: ConfigMutator<TConfig>): Promise<TConfig>;

  /** True if save status is 'initial'. */
  isInitial: boolean;
  /** True if save status is 'pending'. */
  isPending: boolean;
  /** True if save status is 'success'. */
  isSuccess: boolean;
  /** True if save status is 'error'. */
  isError: boolean;
  /** The specific status of the save operation. */
  status: ManagerRequestStatus;
  /** The error object if the save operation failed, null if no error. */
  error: unknown | null;
}

/**
 * Return value of the `useUpdateConfigReducer` hook.
 * Contains the dispatched update function and the current status of the save operation.
 */
export interface UseUpdateConfigReducerResult<TConfig, TPayload> {
  /**
   * Updates the config by dispatching a payload to the defined reducer.
   *
   * @param payload The value passed into the update function that the reducer must apply to the config
   * @returns The entire modified config
   */
  update(payload: TPayload): Promise<TConfig>;

  /** True if save status is 'initial'. */
  isInitial: boolean;
  /** True if save status is 'pending'. */
  isPending: boolean;
  /** True if save status is 'success'. */
  isSuccess: boolean;
  /** True if save status is 'error'. */
  isError: boolean;
  /** The specific status of the save operation. */
  status: ManagerRequestStatus;
  /** The error object if the save operation failed. */
  error: unknown;
}
