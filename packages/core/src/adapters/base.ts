// packages/core/src/adapters/base.ts
import type {AdapterEnvelope, AdapterWriteResult} from '../types.js';

export abstract class BaseAdapter<TData = unknown, TMeta = unknown> {
  /**
   * Retrieves the current settings and optional metadata.
   */
  abstract read(): Promise<AdapterEnvelope<TData, TMeta>>;

  /**
   * Persists changes.
   * @param settings - The full settings object.
   * @param changes - The partial changes triggering this update.
   * @param metadata - The opaque metadata (e.g. dataVersion) from the Manager.
   */
  abstract write(
    settings: TData,
    changes: Partial<TData>,
    metadata?: TMeta
  ): Promise<AdapterWriteResult<TData, TMeta>>;

  /**
   * Optional hook for handling errors (logging, toasts, etc).
   */
  onWriteError(error: unknown): void {
    console.error('[SettingsManager] Write failed:', error);
  }
}
