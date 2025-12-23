// packages/core/src/adapters/base.ts
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

export abstract class BaseAdapter {
  /**
   * Retrieves the current settings and optional metadata.
   */
  abstract read(): AdapterEnvelope | void | Promise<AdapterEnvelope | void>;

  /**
   * Persists changes.
   * @param nextConfig - The full settings object.
   * @param lastSavedConfig - The previus saved state of the settings. Useful to compute a diff for PATCH requests.
   * @param metadata - The opaque metadata (e.g. dataVersion) from the Manager.
   */
  abstract write(
    nextConfig: unknown,
    metadata: ManagerMetadata
  ): AdapterEnvelope | void | Promise<AdapterEnvelope | void>;

  /**
   * Optional hook for handling errors (logging, toasts, etc).
   */
  onReadError(error: unknown): void {
    console.error('[ConfigManager] Read failed:', error);
  }

  /**
   * Optional hook for handling errors (logging, toasts, etc).
   */
  onWriteError(error: unknown): void {
    console.error('[ConfigManager] Write failed:', error);
  }
}
