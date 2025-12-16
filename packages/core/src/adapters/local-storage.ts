import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, AdapterWriteResult} from '../types.js';

export interface LocalStorageAdapterOptions {
  key: string;
}

/**
 * A synchronous adapter for persistence to the browser's LocalStorage.
 * It wraps the data in an envelope `{ settings: ..., metadata: ... }`
 * to support versioning and other metadata.
 */
export class LocalStorageAdapter<TData = unknown, TMeta = unknown> extends BaseAdapter<
  TData,
  TMeta
> {
  constructor(private options: LocalStorageAdapterOptions) {
    super();
  }

  async read(): Promise<AdapterEnvelope<TData, TMeta>> {
    if (typeof localStorage === 'undefined') {
      // In SSR environments, return empty/undefined effectively
      return {settings: undefined as unknown as TData};
    }

    const raw = localStorage.getItem(this.options.key);

    if (raw === null) {
      return {settings: undefined as unknown as TData};
    }

    try {
      const parsed = JSON.parse(raw);

      // Check if this is a valid envelope (has 'settings' key).
      // If your settings object CAN have a 'settings' key at the root,
      // this heuristic might need a specific flag like `__isEnvelope: true`.
      // For now, we assume the standard library format.
      if (parsed && typeof parsed === 'object' && 'settings' in parsed) {
        return parsed as AdapterEnvelope<TData, TMeta>;
      }

      // Legacy fallback: If we found data but no envelope structure,
      // assume it is raw settings data from a previous version of the lib.
      return {settings: parsed as TData, metadata: undefined};
    } catch (e) {
      console.warn('[SettingsManager] Failed to parse LocalStorage value', e);
      return {settings: undefined as unknown as TData};
    }
  }

  async write(
    settings: TData,
    _changes: Partial<TData>,
    metadata?: TMeta
  ): Promise<AdapterWriteResult<TData, TMeta>> {
    if (typeof localStorage === 'undefined') return;

    const payload: AdapterEnvelope<TData, TMeta> = {
      settings,
      metadata,
    };

    try {
      localStorage.setItem(this.options.key, JSON.stringify(payload));
    } catch (e) {
      this.onWriteError(e);
    }

    // We strictly mimic the AsyncAdapter return type
    return {settings, metadata};
  }
}
