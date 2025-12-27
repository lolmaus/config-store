// ConfigManager
export {ConfigManager} from './manager.js';

// Types
export type {
  ManagerRequestStatus as ManagerStatus,
  ManagerState,
  ManagerMetadata,
  AdapterEnvelope,
  VersionDef,
  InferConfig,
} from './types.js';
export {MetadataSchema, AdapterEnvelopeSchema} from './types.js';

// Adapters
export {BaseAdapter} from './adapters/base.js';
export {
  AsyncAdapter,
  type AsyncAdapterOptions,
  type ConcurrencyStrategy,
} from './adapters/async.js';

export {LocalStorageAdapter, type LocalStorageAdapterOptions} from './adapters/local-storage.js';

// Errors
export {
  BaseError,
  ConfigConflictError,
  ConfigSchemaOutdatedError,
  AdapterPayloadError,
} from './errors.js';
