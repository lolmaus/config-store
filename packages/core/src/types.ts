import z, {ZodType} from 'zod';
import type {ConfigManager} from './manager.js';

/**
 * Lets you track the loading state of the ConfigManager
 */
export type ManagerLoadStatus = 'initial' | 'loading' | 'success' | 'error';

/**
 * Shape of the state object, exposed as a Zustand store for reactivity
 */
export interface ManagerState<TConfig> {
  readonly config: TConfig;
  readonly metadata: ManagerMetadata;
  readonly hasBeenHydrated: boolean;

  // Load state
  readonly loadStatus: ManagerLoadStatus;
  readonly loadError: unknown | null;
  readonly isLoadInitial: boolean;
  readonly isLoadLoading: boolean;
  readonly isLoadSuccess: boolean;
  readonly isLoadError: boolean;
}

/**
 * Base type for metadata
 */
export const MetadataSchema = z.object({
  dataVersion: z.number(),
  schemaVersion: z.number(),
});

/**
 * The Strict Contract for adapter read
 */
export type ManagerMetadata = z.infer<typeof MetadataSchema>;

export const AdapterEnvelopeSchema = z.object({
  config: z.unknown(),
  metadata: MetadataSchema,
});

export type AdapterEnvelope<TCurrent = unknown> = z.infer<typeof AdapterEnvelopeSchema> & {
  config: TCurrent;
};

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
