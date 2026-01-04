import {ZodError} from 'zod';
import type {AdapterEnvelope} from './types.js';

interface V8ErrorConstructor extends ErrorConstructor {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  captureStackTrace(target: object, constructorOpt?: Function): void;
}

/**
 * Abstract Base Error to centralize stack trace and prototype logic.
 */
export abstract class BaseError extends Error {
  /* Holds upstream error */
  public readonly cause?: unknown;

  constructor(message: string, options: {cause?: unknown} = {}) {
    super(`[@config-store] ${message}`);

    this.cause = options?.cause;

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
  constructor(error: unknown) {
    let message =
      'Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.';

    if (error instanceof ZodError) {
      message += `\n\nZodError: ${error.message}`;
    }

    super(message, {cause: error});
  }
}

export class AdapterPayloadError extends BaseError {
  constructor(error: unknown) {
    let message = 'Adapter payload failed to parse';

    if (error instanceof ZodError) {
      message += `\n\nZodError: ${error.message}`;
    }

    super(message, {cause: error});
  }
}
