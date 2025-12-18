import {ZodType} from 'zod';
import type {ConfigManager} from './manager.js';

/**
 * Base type for metadata
 */
export interface Meta {
  dataVersion: number;
  schemaVersion: number;
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
