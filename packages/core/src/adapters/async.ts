import {BaseAdapter} from './base.js';
import type {AdapterWriteResult, AdapterEnvelope} from '../types.js';

export type ConcurrencyStrategy = 'abort' | 'optimistic' | 'queue';

/**
 * Configuration options for the {@link AsyncAdapter}.
 */
export interface AsyncAdapterOptions<TData, TMeta = unknown> {
  /**
   * Retrieves settings and metadata.
   */
  read: () => Promise<AdapterEnvelope<TData, TMeta>>;

  /**
   * Persists settings.
   *
   * @returns A Promise resolving to an AdapterWriteResult (new settings/meta) or void.
   */
  write: (
    settings: TData,
    changes: Partial<TData>,
    metadata: TMeta | undefined,
    signal?: AbortSignal
  ) => Promise<AdapterWriteResult<TData, TMeta>>; // <--- FIXED: Match BaseAdapter

  onWriteError?: (error: unknown) => void;
  debounceMs?: number;
  concurrency?: ConcurrencyStrategy;
}

export class AsyncAdapter<TData = unknown, TMeta = unknown> extends BaseAdapter<TData, TMeta> {
  protected options: AsyncAdapterOptions<TData, TMeta>;
  protected debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected pendingResolve: ((value: AdapterWriteResult<TData, TMeta>) => void) | null = null;

  protected abortController: AbortController | null = null;
  protected writeQueue: Promise<void> = Promise.resolve();

  constructor(options: AsyncAdapterOptions<TData, TMeta>) {
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

  read(): Promise<AdapterEnvelope<TData, TMeta>> {
    return this.options.read();
  }

  write(
    settings: TData,
    changes: Partial<TData>,
    metadata?: TMeta
  ): Promise<AdapterWriteResult<TData, TMeta>> {
    const {debounceMs = 500, concurrency = 'abort'} = this.options;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.pendingResolve) {
      this.pendingResolve();
      this.pendingResolve = null;
    }

    return new Promise<AdapterWriteResult<TData, TMeta>>((resolve, reject) => {
      this.pendingResolve = resolve;

      this.debounceTimer = setTimeout(() => {
        this.executeWrite(settings, changes, metadata, concurrency)
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

  private async executeWrite(
    settings: TData,
    changes: Partial<TData>,
    metadata: TMeta | undefined,
    strategy: ConcurrencyStrategy
  ): Promise<AdapterWriteResult<TData, TMeta>> {
    if (strategy === 'abort') {
      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();
      return this.options.write(settings, changes, metadata, this.abortController.signal);
    }

    if (strategy === 'queue') {
      const queuedTask = this.writeQueue.then(() =>
        this.options.write(settings, changes, metadata)
      );
      this.writeQueue = queuedTask.then(() => undefined).catch(() => undefined);
      return queuedTask;
    }

    // Optimistic
    return this.options.write(settings, changes, metadata);
  }
}
