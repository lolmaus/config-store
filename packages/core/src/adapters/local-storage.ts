import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, Meta} from '../types.js';

export interface LocalStorageAdapterOptions {
  key: string;
}

/**
 * A synchronous adapter for persistence to the browser's LocalStorage.
 * It wraps the data in an envelope `{ config: ..., metadata: ... }`
 * to support versioning and other metadata.
 */
export class LocalStorageAdapter extends BaseAdapter {
  constructor(private options: LocalStorageAdapterOptions) {
    super();
  }

  read(): AdapterEnvelope | void {
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

  write(nextConfig: unknown, metadata: Meta): AdapterEnvelope | void {
    if (typeof localStorage === 'undefined') return;

    const payload: AdapterEnvelope = {
      config: nextConfig,
      metadata,
    };

    try {
      localStorage.setItem(this.options.key, JSON.stringify(payload));
    } catch (e) {
      this.onWriteError(e);
      return;
    }

    return {config: nextConfig, metadata};
  }
}
