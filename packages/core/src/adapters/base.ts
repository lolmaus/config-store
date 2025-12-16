/**
 * The abstract base class for all Settings Adapters.
 *
 * An adapter is responsible for the actual persistence of settings data,
 * whether it be to LocalStorage, a REST API, or the file system.
 *
 * @template TData - The shape of the settings object.
 */
export abstract class BaseAdapter<TData = unknown> {
  /**
   * Reads settings from the storage medium.
   *
   * @returns The settings object, or `undefined` if storage is empty/missing.
   * Returning `undefined` triggers the SettingsManager to use Zod defaults.
   */
  abstract read(): Promise<TData | undefined> | TData | undefined;

  /**
   * Writes settings to the storage medium.
   *
   * @param settings - The complete settings object to be saved.
   * @param changes - A partial object containing only the keys that have changed.
   * Useful for adapters that support PATCH operations.
   * @returns A Promise that resolves when the write is complete, or void if synchronous.
   * If the adapter returns a value, the SettingsManager will update the store with it.
   */
  abstract write(settings: TData, changes: Partial<TData>): Promise<TData | void> | void;

  /**
   * A lifecycle hook to handle write errors.
   *
   * By default, this logs the error to `console.error`.
   * Override this to integrate with error reporting services (e.g., Sentry).
   *
   * @param error - The error thrown during the write operation.
   */
  onWriteError(error: unknown): void {
    console.error('[SettingsManager] Write failed:', error);
  }
}
