import type {AdapterEnvelope} from './types.js';

/**
 * Error class to handle confilcts
 */
export class ConfigConflictError extends Error {
  public readonly serverEnvelope: AdapterEnvelope;

  constructor(serverEnvelope: AdapterEnvelope) {
    super('Config Conflict');
    this.name = 'ConfigConflictError';
    this.serverEnvelope = serverEnvelope;

    // Maintain V8 stack trace
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ConfigConflictError);
    }

    // Fix prototype chain for instanceof checks (ES5 support)
    Object.setPrototypeOf(this, ConfigConflictError.prototype);
  }
}

/**
 * Error class to saved schemaVersion being higher than current latest schema
 */
export class ConfigSchemaOutdatedError extends Error {
  constructor(
    public incomingVersion: number,
    public currentVersion: number
  ) {
    super(
      `Client outdated. Server schema version ${incomingVersion} > Client version ${currentVersion}`
    );
    this.name = 'ClientOutdatedError';

    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ConfigSchemaOutdatedError);
    }
    Object.setPrototypeOf(this, ConfigSchemaOutdatedError.prototype);
  }
}
