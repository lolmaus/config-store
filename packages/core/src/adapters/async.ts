import {BaseAdapter} from './base.js';
import type {AdapterWriteResult, AdapterEnvelope, Meta} from '../types.js';

export type ConcurrencyStrategy = 'abort' | 'optimistic' | 'queue';

/**
 * Configuration options for the {@link AsyncAdapter}.
 */
export interface AsyncAdapterOptions {
  /**
   * Retrieves settings and metadata.
   */
  read: () => Promise<AdapterEnvelope>;

  /**
   * Persists settings.
   *
   * @returns A Promise resolving to an AdapterWriteResult (new settings/meta) or void.
   */
  write: (
    config: unknown,
    changes: unknown,
    metadata: Meta | undefined,
    signal?: AbortSignal
  ) => Promise<AdapterWriteResult | void>;

  onWriteError?: (error: unknown) => void;
  debounceMs?: number;
  concurrency?: ConcurrencyStrategy;
}

export class AsyncAdapter extends BaseAdapter {
  protected options: AsyncAdapterOptions;
  protected debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected pendingResolve: ((value?: AdapterWriteResult) => void) | null = null;

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

  read(): Promise<AdapterEnvelope> {
    return this.options.read();
  }

  write(
    config: unknown,
    changes: Partial<unknown>,
    metadata: Meta
  ): Promise<AdapterWriteResult | void> {
    const {debounceMs = 500, concurrency = 'abort'} = this.options;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.pendingResolve) {
      this.pendingResolve();
      this.pendingResolve = null;
    }

    return new Promise<AdapterWriteResult | void>((resolve, reject) => {
      this.pendingResolve = resolve;

      this.debounceTimer = setTimeout(() => {
        this.executeWrite(config, changes, metadata, concurrency)
          .then(resolve)
          .catch((err: unknown) => {
            if (err instanceof Error && err.name === 'AbortError') {
              resolve();
              return;
            }
            this.onWriteError(err);
            reject(err);
          });
      }, debounceMs);
    });
  }

  protected async executeWrite(
    config: unknown,
    changes: unknown,
    metadata: Meta | undefined,
    strategy: ConcurrencyStrategy
  ): Promise<AdapterWriteResult | void> {
    if (strategy === 'abort') {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
      return this.options.write(config, changes, metadata, this.abortController.signal);
    }

    if (strategy === 'queue') {
      const queuedTask = this.writeQueue.then(() => this.options.write(config, changes, metadata));
      this.writeQueue = queuedTask.then(() => undefined).catch(() => undefined);
      return queuedTask;
    }

    // Optimistic
    return this.options.write(config, changes, metadata);
  }
}
