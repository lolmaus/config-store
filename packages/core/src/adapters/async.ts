/**
 * Purpose:
 * Implements the asynchronous persistence adapter for remote or delayed storage,
 * including concurrency handling for overlapping writes.
 *
 * Read with:
 * - ./base.ts
 * - ../types.ts
 * - ../errors.ts
 * - ./async.test.ts
 *
 * Main responsibilities:
 * - delegate async read/write to user-provided adapter callbacks
 * - preserve the adapter envelope and metadata contract
 * - enforce supported concurrency behavior for overlapping saves
 *
 * Concurrency surface:
 * - abort: cancel a previous in-flight write
 * - sequential: queue writes and process them in order
 *
 * When changing this file:
 * - treat concurrency semantics as externally meaningful behavior
 * - update async adapter tests
 * - review manager tests if reconciliation or conflict behavior changes
 * - sync docs/examples if observable behavior changes
 */

import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

/**
 * Strategy for handling multiple concurrent write requests.
 * - `'abort'`: Cancels the previous pending request using AbortController (Best for modern APIs).
 * - `'sequential'`: Queues requests to ensure they run one after another (Best for legacy backends).
 */
export type ConcurrencyStrategy = 'abort' | 'sequential';

/**
 * Configuration options for the `AsyncAdapter`.
 */
export interface AsyncAdapterOptions {
  /**
   * Function to retrieve data from the remote source.
   *
   * @returns Should return {@link AdapterEnvelope} if the backend responds with data.
   * When the backend has no config stored for the user, return `null` or `undefined`.
   */
  read: () => Promise<AdapterEnvelope | null | undefined | void>;

  /**
   * Function to persist data to the remote source.
   *
   * @param nextConfig The new configuration object.
   * @param lastCommittedConfig The last known confirmed configuration from the server (useful for PATCH/Diffing).
   * @param metadata The versioning metadata.
   * @param signal An AbortSignal (if concurrency is set to 'abort').
   * @returns Should return {@link AdapterEnvelope} if the backend responds with updated data.
   * Otherwise, may return `null` or `undefined`.
   */
  write: (
    nextConfig: unknown,
    lastCommittedConfig: unknown | undefined,
    metadata: ManagerMetadata,
    signal?: AbortSignal
  ) => Promise<AdapterEnvelope | null | undefined | void>;

  /** The concurrency strategy to use. Defaults to `'abort'`. */
  concurrency?: ConcurrencyStrategy;
}

/**
 * An adapter designed for asynchronous persistence, such as REST APIs.
 * Includes built-in support for concurrency control (AbortController or Sequential Queue)
 * and error handling.
 *
 * It is not intended to be subclassed (though you can if you know what you're doing).
 * Instead, it's supposed to be instantiated with `new AsyncAdapter(options)`, passing
 * {@link AsyncAdapterOptions} for customization.
 *
 * See [documentation](https://config-store.lolma.us/guides/adapters/async/) for usage guide.
 */
export class AsyncAdapter extends BaseAdapter {
  protected options: AsyncAdapterOptions;

  // State Tracking
  protected lastCommitted: unknown | undefined;

  // Concurrency State
  protected abortController: AbortController | null = null;
  protected writeQueue: Promise<void> = Promise.resolve();

  constructor(options: AsyncAdapterOptions) {
    super();
    this.options = options;
  }

  async read(): Promise<AdapterEnvelope | null | undefined | void> {
    const envelope: AdapterEnvelope | null | undefined | void = await this.options.read();

    // Initialize our anchor point from the server's truth
    this.lastCommitted = envelope?.config;

    return envelope;
  }

  async write(
    nextConfig: unknown,
    metadata: ManagerMetadata
  ): Promise<AdapterEnvelope | null | undefined | void> {
    const {concurrency = 'abort'} = this.options;

    try {
      // Pass the 'nextConfig' to be saved, but ignore the optimistic prev.
      // executeWrite will inject 'this.lastCommitted' instead.
      return await this.executeWrite(nextConfig, metadata, concurrency);
    } catch (err) {
      // Swallow AbortErrors to prevent unhandled promise rejections in the UI
      if (err instanceof Error && err.name === 'AbortError') return;

      throw err;
    }
  }

  protected async executeWrite(
    nextConfig: unknown,
    metadata: ManagerMetadata,
    strategy: ConcurrencyStrategy
  ): Promise<AdapterEnvelope | null | undefined | void> {
    // Strategy: Abort (Default)
    if (strategy === 'abort') {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
      return this._executeWriteInternal(nextConfig, metadata, this.abortController.signal);
    }

    // Strategy: Queue
    if (strategy === 'sequential') {
      // We wrap runWrite in a closure so it accesses 'this.lastCommitted'
      // lazily, only when the queue actually executes this task.
      const queuedTask = this.writeQueue.then(() =>
        this._executeWriteInternal(nextConfig, metadata)
      );

      // Catch errors to ensure queue continues
      this.writeQueue = queuedTask.then(() => undefined).catch(() => undefined);
      return queuedTask;
    }

    throw new Error(`[@config-store] Invalid strategy: ${strategy}`);
  }

  protected async _executeWriteInternal(
    nextConfig: unknown,
    metadata: ManagerMetadata,
    signal?: AbortSignal
  ) {
    const result = await this.options.write(nextConfig, this.lastCommitted, metadata, signal);

    // If the request was aborted, the server likely didn't process it (or we can't be sure).
    // We must NOT update 'lastCommitted', thus indicating that the backend data may still be outdated.
    if (signal?.aborted) return;

    // Update anchor on success
    if (result && result.config !== undefined) {
      // Use data from backend response if available
      this.lastCommitted = result.config;
    } else {
      // Otherwise use data from the request
      this.lastCommitted = nextConfig;
    }

    return result;
  }
}
