import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {AdapterPayloadError, ConfigSchemaParseError} from './errors.js';

// Make assertion error message more visible.
let m;

describe('ConfigSchemaParseError', () => {
  test('ConfigSchemaParseError includes Zod validation details in message', () => {
    // 1. Define a schema designed to fail
    const schema = z.object({
      server: z.object({
        port: z.number(),
        host: z.string(),
      }),
    });

    const result = schema.safeParse(undefined);

    if (result.success) {
      // This should never happen
      assert.fail('Test setup failed: Schema should have rejected the input.');
    }

    // 3. Create the custom error
    const configError = new ConfigSchemaParseError(result.error);

    // 4. Assertions

    // Ensure the cause is preserved (standard browser inspectability)
    assert.strictEqual(configError.cause, result.error);

    m = 'configError.message';
    assert.equal(
      configError.message,
      `[@config-store] Failed to revert to defaults. Schema must be defined with \`.optional()\`, \`.nullable()\`, \`.nullish()\` or \`.prefault({})\` on the outer object and \`.default()\` on every property.

ZodError: [
  {
    "expected": "object",
    "code": "invalid_type",
    "path": [],
    "message": "Invalid input: expected object, received undefined"
  }
]`,
      m
    );
  });

  test('ConfigSchemaParseError handles non-Zod errors gracefully', () => {
    const genericError = new Error('Something random failed');
    const configError = new ConfigSchemaParseError(genericError);

    m = 'configError.cause';
    assert.equal(configError.cause, genericError, m);

    m = 'configError.message';
    assert.equal(
      configError.message,
      '[@config-store] Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.',
      m
    );
  });
});

describe('AdapterPayloadError', () => {
  test('AdapterPayloadError includes Zod validation details in message', () => {
    // 1. Define a schema designed to fail
    const schema = z.object({
      server: z.object({
        port: z.number(),
        host: z.string(),
      }),
    });

    const result = schema.safeParse(undefined);

    if (result.success) {
      // This should never happen
      assert.fail('Test setup failed: Schema should have rejected the input.');
    }

    // 3. Create the custom error
    const configError = new AdapterPayloadError(result.error);

    // 4. Assertions

    // Ensure the cause is preserved (standard browser inspectability)
    assert.strictEqual(configError.cause, result.error);

    m = 'configError.message';
    assert.equal(
      configError.message,
      `[@config-store] Adapter payload failed to parse

ZodError: [
  {
    "expected": "object",
    "code": "invalid_type",
    "path": [],
    "message": "Invalid input: expected object, received undefined"
  }
]`,
      m
    );
  });

  test('AdapterPayloadError handles non-Zod errors gracefully', () => {
    const genericError = new Error('Something random failed');
    const configError = new AdapterPayloadError(genericError);

    m = 'configError.cause';
    assert.equal(configError.cause, genericError, m);

    m = 'configError.message';
    assert.equal(configError.message, '[@config-store] Adapter payload failed to parse', m);
  });
});
