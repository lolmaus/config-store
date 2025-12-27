import z, {ZodType} from 'zod';
import type {ConfigManager} from './manager.js';

/**
 * Lets you track the loading state of the ConfigManager
 */
export type ManagerRequestStatus = 'initial' | 'pending' | 'success' | 'error';

/**
 * Shape of the state object, exposed as a Zustand store for reactivity
 */
export interface ManagerState<TConfig> {
  readonly config: TConfig;
  readonly metadata: ManagerMetadata;
  readonly hasBeenHydrated: boolean;

  // Load state
  readonly loadStatus: ManagerRequestStatus;
  readonly loadError: unknown | null;
  readonly isLoadInitial: boolean;
  readonly isLoadPending: boolean;
  readonly isLoadSuccess: boolean;
  readonly isLoadError: boolean;

  // Save state
  readonly saveStatus: ManagerRequestStatus;
  readonly saveError: unknown | null;
  readonly isSaveInitial: boolean;
  readonly isSavePending: boolean;
  readonly isSaveSuccess: boolean;
  readonly isSaveError: boolean;
}

/**
 * Base type for metadata
 */
export interface ManagerMetadata {
  dataVersion: number;
  schemaVersion: number;
}

export interface AdapterEnvelope<TCurrent = unknown> {
  config: TCurrent;
  metadata: ManagerMetadata;
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

export const MetadataSchema = z.object({
  dataVersion: z.number(),
  schemaVersion: z.number(),
}) satisfies z.ZodType<ManagerMetadata>;

export const AdapterEnvelopeSchema = z.object({
  config: z.unknown(),
  metadata: MetadataSchema,
}) satisfies z.ZodType<AdapterEnvelope>;
