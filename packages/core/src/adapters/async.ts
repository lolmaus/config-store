import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, Meta} from '../types.js';

export type ConcurrencyStrategy = 'abort' | 'optimistic' | 'queue';

export interface AsyncAdapterOptions {
  read: () => Promise<AdapterEnvelope>;

  /**
   * Persists settings.
   */
  write: (
    nextConfig: unknown,
    lastCommittedConfig: unknown | undefined,
    metadata: Meta | undefined,
    signal?: AbortSignal
  ) => Promise<AdapterEnvelope | void>;

  onWriteError?: (error: unknown) => void;
  concurrency?: ConcurrencyStrategy;
}

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

  override onWriteError(error: unknown): void {
    if (this.options.onWriteError) {
      this.options.onWriteError(error);
    } else {
      super.onWriteError(error);
    }
  }

  async read(): Promise<AdapterEnvelope> {
    const envelope = await this.options.read();

    // Initialize our anchor point from the server's truth
    this.lastCommitted = envelope.config;

    return envelope;
  }

  async write(nextConfig: unknown, metadata: Meta): Promise<AdapterEnvelope | void> {
    const {concurrency = 'abort'} = this.options;

    try {
      // Pass the 'nextConfig' to be saved, but ignore the optimistic prev.
      // executeWrite will inject 'this.lastCommitted' instead.
      return await this.executeWrite(nextConfig, metadata, concurrency);
    } catch (err) {
      // Swallow AbortErrors to prevent unhandled promise rejections in the UI
      if (err instanceof Error && err.name === 'AbortError') return;

      this.onWriteError(err);
      throw err;
    }
  }

  protected async executeWrite(
    nextConfig: unknown,
    metadata: Meta | undefined,
    strategy: ConcurrencyStrategy
  ): Promise<AdapterEnvelope | void> {
    const runWrite = async (signal?: AbortSignal) => {
      // 1. Pass 'this.lastCommitted' (Server Truth) to the user
      const result = await this.options.write(nextConfig, this.lastCommitted, metadata, signal);

      // 2. CRITICAL SAFETY CHECK
      // If the request was aborted, the server likely didn't process it (or we can't be sure).
      // We must NOT update 'lastCommitted', or we will assume the server has data it doesn't.
      if (signal?.aborted) return;

      // 3. Update anchor on success
      if (result && result.config !== undefined) {
        this.lastCommitted = result.config;
      } else {
        this.lastCommitted = nextConfig;
      }

      return result;
    };

    // Strategy: Abort (Default)
    if (strategy === 'abort') {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
      return runWrite(this.abortController.signal);
    }

    // Strategy: Queue
    if (strategy === 'queue') {
      // We wrap runWrite in a closure so it accesses 'this.lastCommitted'
      // lazily, only when the queue actually executes this task.
      const queuedTask = this.writeQueue.then(() => runWrite());

      // Catch errors to ensure queue continues
      this.writeQueue = queuedTask.then(() => undefined).catch(() => undefined);
      return queuedTask;
    }

    // Strategy: Optimistic (Parallel)
    return runWrite();
  }
}
