import {BaseAdapter} from './base.js';
import type {AdapterWriteResult, AdapterEnvelope, Meta} from '../types.js';

export type ConcurrencyStrategy = 'abort' | 'optimistic' | 'queue';

/**
 * Configuration options for the {@link AsyncAdapter}.
 */
export interface AsyncAdapterOptions<TMeta extends Meta = Meta> {
  /**
   * Retrieves settings and metadata.
   */
  read: () => Promise<AdapterEnvelope<TMeta>>;

  /**
   * Persists settings.
   *
   * @returns A Promise resolving to an AdapterWriteResult (new settings/meta) or void.
   */
  write: (
    config: unknown,
    changes: unknown,
    metadata: TMeta | undefined,
    signal?: AbortSignal
  ) => Promise<AdapterWriteResult<TMeta> | void>;

  onWriteError?: (error: unknown) => void;
  debounceMs?: number;
  concurrency?: ConcurrencyStrategy;
}

export class AsyncAdapter<TConfig = unknown, TMeta extends Meta = Meta> extends BaseAdapter<TMeta> {
  protected options: AsyncAdapterOptions<TMeta>;
  protected debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected pendingResolve: ((value?: AdapterWriteResult<TMeta>) => void) | null = null;

  protected abortController: AbortController | null = null;
  protected writeQueue: Promise<void> = Promise.resolve();

  constructor(options: AsyncAdapterOptions<TMeta>) {
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

  read(): Promise<AdapterEnvelope<TMeta>> {
    return this.options.read();
  }

  write(
    config: TConfig,
    changes: Partial<TConfig>,
    metadata?: TMeta
  ): Promise<AdapterWriteResult<TMeta> | void> {
    const {debounceMs = 500, concurrency = 'abort'} = this.options;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.pendingResolve) {
      this.pendingResolve();
      this.pendingResolve = null;
    }

    return new Promise<AdapterWriteResult<TMeta> | void>((resolve, reject) => {
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
    config: TConfig,
    changes: Partial<TConfig>,
    metadata: TMeta | undefined,
    strategy: ConcurrencyStrategy
  ): Promise<AdapterWriteResult<TMeta> | void> {
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
