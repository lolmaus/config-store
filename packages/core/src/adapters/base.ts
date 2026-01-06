// packages/core/src/adapters/base.ts
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

/**
 * Abstract base class for all storage adapters.
 * Implementations must handle reading and writing the `AdapterEnvelope` to a persistence layer.
 */
export abstract class BaseAdapter {
  /**
   * Retrieves the current settings and optional metadata from the storage medium.
   *
   * @returns An `AdapterEnvelope` containing config and metadata,
   * or `null`/`undefined`/`void` if empty, depending on adapter implementation.
   */
  abstract read():
    | AdapterEnvelope
    | null
    | undefined
    | void
    | Promise<AdapterEnvelope | null | undefined | void>;

  /**
   * Persists changes to the storage medium.
   *
   * @param nextConfig - The full settings object to be saved.
   * @param metadata - The opaque metadata (e.g. dataVersion) from the Manager.
   * @returns The saved envelope (if the backend modifies it), or void/null/undefined.
   */
  abstract write(
    nextConfig: unknown,
    metadata: ManagerMetadata
  ): AdapterEnvelope | null | undefined | void | Promise<AdapterEnvelope | null | undefined | void>;
}
