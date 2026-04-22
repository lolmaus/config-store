/**
 * Purpose:
 * Defines the public type contract for the core package, including manager state,
 * metadata, version definitions, adapter envelopes, and runtime schemas.
 *
 * Read with:
 * - ./manager.ts
 * - ./errors.ts
 * - ./adapters/base.ts
 * - ../index.ts
 *
 * What this file owns:
 * - manager status and manager state types
 * - metadata and adapter envelope types
 * - version registration and manager options types
 * - public helper schemas and utility types
 *
 * When changing this file:
 * - treat changes as public contract changes
 * - review manager logic, React bindings, tests, and docs/examples
 */

import z, {ZodType} from 'zod';
import type {ConfigManager} from './manager.js';
import type {BaseAdapter} from './adapters/base.js';

/**
 * Represents the current status of an asynchronous operation within the Manager.
 * - `initial`: No operation has been attempted yet.
 * - `pending`: An operation is currently in progress.
 * - `success`: The last operation completed successfully.
 * - `error`: The last operation failed.
 */
export type ManagerRequestStatus = 'initial' | 'pending' | 'success' | 'error';

/**
 * The internal state of the ConfigManager, exposed via a Zustand store.
 * This interface contains the stored config, metadata, and granular loading/saving status flags.
 *
 * @template TConfig The shape of the configuration object.
 */
export interface ManagerState<TConfig> {
  /** The current configuration object. */
  readonly config: TConfig;
  /** Metadata regarding data versions and schema versions. */
  readonly metadata: ManagerMetadata;
  /** Indicates if the store has been populated with data from the adapter at least once. */
  readonly hasBeenHydrated: boolean;

  // Load state
  /** The specific status of the load operation. */
  readonly loadStatus: ManagerRequestStatus;
  /** The error object if the load operation failed. `null` if successful, idle or pending. */
  readonly loadError: unknown | null;
  /** True if load status is 'initial'. */
  readonly isLoadInitial: boolean;
  /** True if load status is 'pending'. */
  readonly isLoadPending: boolean;
  /** True if load status is 'success'. */
  readonly isLoadSuccess: boolean;
  /** True if load status is 'error'. */
  readonly isLoadError: boolean;

  // Save state
  /** The specific status of the save operation. */
  readonly saveStatus: ManagerRequestStatus;
  /** The error object if the save operation failed. `null` if successful, idle or pending. */
  readonly saveError: unknown | null;
  /** True if save status is 'initial'. */
  readonly isSaveInitial: boolean;
  /** True if save status is 'pending'. */
  readonly isSavePending: boolean;
  /** True if save status is 'success'. */
  readonly isSaveSuccess: boolean;
  /** True if save status is 'error'. */
  readonly isSaveError: boolean;
}

/**
 * Metadata used for Optimistic Concurrency Control and schema validation.
 */
export interface ManagerMetadata {
  /**
   * Monotonically increasing number representing the version of the data.
   * Used to detect write conflicts in async adapters.
   */
  dataVersion: number;
  /**
   * The version of the schema that the data adheres to.
   * Used to trigger migrations.
   */
  schemaVersion: number;
}

/**
 * The data structure exchanged between the Manager and the Adapter.
 * Wraps the actual config with metadata to ensure data integrity and versioning.
 *
 * @template TCurrent The type of the configuration.
 */
export interface AdapterEnvelope<TCurrent = unknown> {
  config: TCurrent;
  metadata: ManagerMetadata;
}

/**
 * Defines a specific version of the configuration schema and how to migrate to it.
 *
 * @template TPrev The type of the configuration in the previous version.
 * @template TNextSchema The Zod schema defining the shape of the configuration in this version.
 */
export interface VersionDef<TPrev, TNextSchema extends ZodType = ZodType> {
  /** The schema version number (must be incremental). */
  version: number;
  /** The Zod schema defining the shape and defaults of this version. */
  schema: TNextSchema;
  /**
   * A function that transforms the configuration from the previous version (`TPrev`)
   * to the input of this version's schema.
   */
  migration?: (prev: TPrev) => z.input<TNextSchema>;
}

export interface VersionDefInternal {
  version: number;
  schema: ZodType;
  migration?: (prev: unknown) => unknown;
}

/**
 * Utility type to infer the configuration shape from a `ConfigManager` instance.
 *
 * @template T The ConfigManager instance type.
 */
export type InferConfig<T> = T extends ConfigManager<infer C> ? C : never;

/**
 * Runtime Zod schema for validating `ManagerMetadata`.
 */
export const MetadataSchema = z.object({
  dataVersion: z.number(),
  schemaVersion: z.number(),
}) satisfies z.ZodType<ManagerMetadata>;

/**
 * Runtime Zod schema for validating `AdapterEnvelope`.
 */
export const AdapterEnvelopeSchema = z.object({
  config: z.unknown(),
  metadata: MetadataSchema,
}) satisfies z.ZodType<AdapterEnvelope>;

export type OnLoadError = (error: unknown) => void;
export type OnSaveError = (error: unknown) => void;
export type OnMigrationError = (arg: {
  error: unknown;
  currentEnvelope: AdapterEnvelope;
  versionDef: VersionDefInternal;
}) => void;

/**
 * Options for configuring the behavior of the ConfigManager.
 */
export interface ConfigManagerOptions {
  /** The adapter instance to use for persistence. */
  adapter: BaseAdapter;

  onLoadError?: OnLoadError;
  onSaveError?: OnSaveError;
  onMigrationError?: OnMigrationError;
}
