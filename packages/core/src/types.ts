import {ZodType} from 'zod';
import type {ConfigManager} from './manager.js';

/**
 * Lets you track the loading state of the ConfigManager
 */
export type ManagerStatus = 'initial' | 'loading' | 'success' | 'error';

/**
 * Shape of the state object, exposed as a Zustand store for reactivity
 */
export interface ManagerState {
  readonly status: ManagerStatus;
  readonly error: unknown | null;
  readonly hasBeenHydrated: boolean;
  readonly metadata: Meta;
}

/**
 * Base type for metadata
 */
export interface Meta {
  readonly dataVersion: number;
  readonly schemaVersion: number;
}

/**
 * The Strict Contract for adapter read
 */
export interface AdapterEnvelope {
  config: unknown;
  metadata: Meta;
}

/**
 * Descriptor of a schema version
 */
export interface VersionDef<TPrev, TNext> {
  version: number;
  schema: ZodType<TNext>;
  migration?: (prev: TPrev) => TNext;
}

/**
 * Helper to infer the Config type from the Manager instance
 */
export type InferConfig<T> = T extends ConfigManager<infer C> ? C : never;
