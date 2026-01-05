import {BaseAdapter} from './base.js';
import {AdapterEnvelopeSchema, type AdapterEnvelope, type ManagerMetadata} from '../types.js';
import {AdapterPayloadError} from '../errors.js';

/**
 * Options for the LocalStorageAdapter.
 */
export interface LocalStorageAdapterOptions {
  /**
   * The key under which the settings will be stored in localStorage.
   * Defaults to `'@lolmaus/config-store'`.
   */
  key?: string;
}

/**
 * A synchronous adapter for persistence to the browser's LocalStorage.
 * It wraps the data in an envelope `{ config: ..., metadata: ... }`
 * to support versioning and other metadata.
 */
export class LocalStorageAdapter extends BaseAdapter {
  key: string = '@lolmaus/config-store';

  constructor(options?: LocalStorageAdapterOptions) {
    super();

    if (options?.key) this.key = options.key;
  }

  read(): AdapterEnvelope | void {
    if (typeof localStorage === 'undefined') return;

    const rawStrOrNull: string | null = localStorage.getItem(this.key);

    if (rawStrOrNull === null) return;

    let rawJson;

    try {
      rawJson = JSON.parse(rawStrOrNull);
      return AdapterEnvelopeSchema.parse(rawJson);
    } catch (error) {
      const error2 = new AdapterPayloadError(error);
      this.onReadError(error2);
      throw error2;
    }
  }

  write(nextConfig: unknown, metadata: ManagerMetadata): AdapterEnvelope | void {
    if (typeof localStorage === 'undefined') return;

    const payload: AdapterEnvelope = {
      config: nextConfig,
      metadata,
    };

    try {
      localStorage.setItem(this.key, JSON.stringify(payload));
    } catch (e) {
      this.onWriteError(e);
      throw e;
    }

    return {config: nextConfig, metadata};
  }
}
