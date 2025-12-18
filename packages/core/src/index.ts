// ConfigManager
export {ConfigManager} from './manager.js';

// Types
export type {Meta, AdapterEnvelope, VersionDef, InferConfig} from './types.js';

// Adapters
export {BaseAdapter} from './adapters/base.js';
export {
  AsyncAdapter,
  type AsyncAdapterOptions,
  type ConcurrencyStrategy,
} from './adapters/async.js';

export {LocalStorageAdapter, type LocalStorageAdapterOptions} from './adapters/local-storage.js';

// Errors
export {ConfigConflictError, ConfigSchemaOutdatedError as ClientOutdatedError} from './errors.js';
