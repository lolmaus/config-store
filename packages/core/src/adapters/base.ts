// packages/core/src/adapters/base.ts
import type {AdapterEnvelope, AdapterWriteResult, Meta} from '../types.js';

export abstract class BaseAdapter {
  /**
   * Retrieves the current settings and optional metadata.
   */
  abstract read(): AdapterEnvelope | void | Promise<AdapterEnvelope | void>;

  /**
   * Persists changes.
   * @param settings - The full settings object.
   * @param changes - The partial changes triggering this update.
   * @param metadata - The opaque metadata (e.g. dataVersion) from the Manager.
   */
  abstract write(
    config: unknown,
    changes: unknown,
    metadata: Meta
  ): AdapterWriteResult | void | Promise<AdapterWriteResult | void>;

  /**
   * Optional hook for handling errors (logging, toasts, etc).
   */
  onWriteError(error: unknown): void {
    console.error('[ConfigManager] Write failed:', error);
  }
}
