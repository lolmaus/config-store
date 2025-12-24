import type {AdapterEnvelope} from './types.js';

interface V8ErrorConstructor extends ErrorConstructor {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  captureStackTrace(target: object, constructorOpt?: Function): void;
}

/**
 * Abstract Base Error to centralize stack trace and prototype logic.
 */
export abstract class BaseError extends Error {
  constructor(message: string) {
    super(`[@config-store] ${message}`);

    // Automatically set the name to the class name
    this.name = this.constructor.name;

    // Fix prototype chain for instanceof checks (ES5 support)
    Object.setPrototypeOf(this, new.target.prototype);

    // Maintain V8 stack trace
    const v8Error = Error as V8ErrorConstructor;
    if ('captureStackTrace' in v8Error && typeof v8Error.captureStackTrace === 'function') {
      v8Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * Error class to handle confilcts
 */
export class ConfigConflictError extends BaseError {
  constructor(public readonly serverEnvelope: AdapterEnvelope) {
    super('Config Conflict');
    // Name is automatically 'ConfigConflictError' via BaseError
  }
}

/**
 * Error class to saved schemaVersion being higher than current latest schema
 */
export class ConfigSchemaOutdatedError extends BaseError {
  constructor(
    public readonly incomingVersion: number,
    public readonly currentVersion: number
  ) {
    super(
      `Client outdated. Server schema version ${incomingVersion} > Client version ${currentVersion}`
    );
  }
}

export class ConfigSchemaParseError extends BaseError {
  public readonly parseError: unknown;

  constructor(error: unknown) {
    super(
      'Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.'
    );
    this.parseError = error;
  }
}

export class AdapterPayloadError extends BaseError {
  public readonly parseError: unknown;

  constructor(error: unknown) {
    super('Adapter payload failed to parse');
    this.parseError = error;
  }
}
