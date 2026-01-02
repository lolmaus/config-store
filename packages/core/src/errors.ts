import type {AdapterEnvelope} from './types.js';

/**
 * Abstract Base Error to centralize stack trace and prototype logic.
 * Ensures `instanceof` checks work correctly even when transpiled to ES5.
 */
export abstract class BaseError extends Error {
  constructor(message: string) {
    super(`[@config-store] ${message}`);

    // Automatically set the name to the class name
    this.name = this.constructor.name;

    // Fix prototype chain for instanceof checks (ES5 support)
    Object.setPrototypeOf(this, new.target.prototype);

    // Maintain V8 stack trace
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * Error thrown when a `ConfigConflictError` occurs (HTTP 409 or logical mismatch).
 * Contains the server's version of the envelope to allow for "healing" strategies.
 */
export class ConfigConflictError extends BaseError {
  constructor(public readonly serverEnvelope: AdapterEnvelope) {
    super('Config Conflict');
  }
}

/**
 * Error thrown when the server responds with a schema version higher than what
 * the current client understands.
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

/**
 * Error thrown when the Zod schema fails to parse a value (usually during default value resolution).
 * Indicates a misconfiguration in the schema definition (e.g., missing `.prefault({})`).
 */
export class ConfigSchemaParseError extends BaseError {
  public readonly parseError: unknown;

  constructor(error: unknown) {
    super(
      'Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.'
    );
    this.parseError = error;
  }
}

/**
 * Error thrown when an adapter retrieves data that is not valid JSON or does not match
 * the expected Envelope structure.
 */
export class AdapterPayloadError extends BaseError {
  public readonly parseError: unknown;

  constructor(error: unknown) {
    super('Adapter payload failed to parse');
    this.parseError = error;
  }
}
