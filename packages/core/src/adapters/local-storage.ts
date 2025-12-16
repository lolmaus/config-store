import { BaseAdapter } from "./base.js";

/**
 * Options for the {@link LocalStorageAdapter}.
 */
export interface LocalStorageAdapterOptions {
  /**
   * The key to use in `window.localStorage`.
   * Ensure this is unique to your application to avoid collisions.
   */
  key: string;
}

/**
 * A synchronous adapter for persistence to the browser's LocalStorage.
 *
 * It automatically handles JSON serialization/deserialization.
 *
 * @template TData - The shape of the settings object.
 */
export class LocalStorageAdapter<TData = unknown> extends BaseAdapter<TData> {
  constructor(private options: LocalStorageAdapterOptions) {
    super();
  }

  /**
   * Reads and parses data from LocalStorage.
   *
   * @returns The parsed data, or `undefined` if the key does not exist or JSON is invalid.
   */
  read(): TData | undefined {
    try {
      const item = localStorage.getItem(this.options.key);

      if (item) {
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn("[SettingsManager] LocalStorage access failed:", e);
    }

    return undefined;
  }

  /**
   * Serializes and writes data to LocalStorage.
   *
   * @param settings - The settings object to serialize.
   */
  write(settings: TData): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(this.options.key, JSON.stringify(settings));
    } catch (e) {
      console.warn("[SettingsManager] LocalStorage write failed:", e);
    }
  }
}
