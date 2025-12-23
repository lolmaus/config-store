import {BaseAdapter} from './base.js';
import {AdapterEnvelopeSchema, type AdapterEnvelope, type ManagerMetadata} from '../types.js';
import {AdapterPayloadError} from '../errors.js';

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

    const rawStrOrNull: string | null = localStorage.getItem(this.options.key);

    if (rawStrOrNull === null) return;

    let rawJuson;

    try {
      rawJuson = JSON.parse(rawStrOrNull);
      return AdapterEnvelopeSchema.parse(rawJuson);
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
      localStorage.setItem(this.options.key, JSON.stringify(payload));
    } catch (e) {
      this.onWriteError(e);
      throw e;
    }

    return {config: nextConfig, metadata};
  }
}
