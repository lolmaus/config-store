import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, AdapterWriteResult, Meta} from '../types.js';

export interface LocalStorageAdapterOptions {
  key: string;
}

/**
 * A synchronous adapter for persistence to the browser's LocalStorage.
 * It wraps the data in an envelope `{ config: ..., metadata: ... }`
 * to support versioning and other metadata.
 */
export class LocalStorageAdapter<
  TConfig = unknown,
  TMeta extends Meta = Meta,
> extends BaseAdapter<TMeta> {
  constructor(private options: LocalStorageAdapterOptions) {
    super();
  }

  read(): AdapterEnvelope<TMeta> | void {
    if (typeof localStorage === 'undefined') return;

    const raw: string | null = localStorage.getItem(this.options.key);

    if (raw === null) return;

    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[ConfigManager] Failed to parse LocalStorage value', e);
      return;
    }
  }

  write(
    config: TConfig,
    _changes: Partial<TConfig>,
    metadata?: TMeta
  ): AdapterWriteResult<TMeta> | void {
    if (typeof localStorage === 'undefined') return;

    const payload: AdapterEnvelope<TMeta> = {
      config,
      metadata,
    };

    try {
      localStorage.setItem(this.options.key, JSON.stringify(payload));
    } catch (e) {
      this.onWriteError(e);
      return;
    }

    return {config, metadata};
  }
}
