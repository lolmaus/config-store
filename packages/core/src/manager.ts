import z, {type ZodType} from 'zod';
import type {BaseAdapter} from './adapters/base.js';
import {type AdapterEnvelope, type Meta, type VersionDef} from './types.js';
import {createStore, type StoreApi} from 'zustand/vanilla';
import {ConfigSchemaOutdatedError, ConfigConflictError} from './errors.js';

export class ConfigManager<TCurrent = undefined> {
  // ------------------------
  // Properties
  // ------------------------

  protected adapter: BaseAdapter;
  protected versions: VersionDef<any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected schema?: z.ZodType<TCurrent>;
  protected store: StoreApi<TCurrent>;
  public metadata: Meta;

  // ------------------------
  // Constructor
  // ------------------------

  protected constructor(
    adapter: BaseAdapter,
    versions: VersionDef<any, any>[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
    schema: z.ZodType<TCurrent> | undefined
  ) {
    this.adapter = adapter;
    this.versions = versions;
    this.schema = schema;
    this.store = createStore<TCurrent>(() => undefined as TCurrent);

    this.metadata = {
      dataVersion: 0,
      schemaVersion: versions.at(-1)?.version ?? 0,
    };
  }

  // ------------------------
  // Static methods
  // ------------------------

  static create(adapter: BaseAdapter): ConfigManager<undefined> {
    return new ConfigManager(adapter, undefined, undefined);
  }

  // ------------------------
  // Public methods
  // ------------------------

  addVersion<TNext>(
    // We use a conditional type to differentiate the First Version from Updates
    args: {
      version: number;
      schema: z.ZodType<TNext>;
    } & ([TCurrent] extends [undefined]
      ? {migration?: never} // First version: No migration allowed
      : {migration: (prev: TCurrent) => TNext}) // Update: Migration required
  ): ConfigManager<TNext> {
    if (args.version <= this.metadata.schemaVersion) {
      throw new Error(
        `[@config-manager] Version numbers must be incremental, but after ${this.metadata.schemaVersion} received ${args.version}`
      );
    }

    // 1. Create the new definition object
    const newVersion: VersionDef<TCurrent, TNext> = {
      version: args.version,
      schema: args.schema,
      migration: args.migration,
    };

    // Returning a NEW instance with the updated generic type <TNext>.
    // We pass the accumulated history (previous versions + new version).
    return new ConfigManager<TNext>(this.adapter, [...this.versions, newVersion], args.schema);
  }

  get(): TCurrent {
    return this.store.getState();
  }

  async load(): Promise<void> {
    const incomingEnvelope: AdapterEnvelope | void = await this.adapter.read();
    const migratedEnvelope: AdapterEnvelope = this.migrate(incomingEnvelope);

    this.metadata = migratedEnvelope.metadata;
    this.store.setState(migratedEnvelope.config as TCurrent);
  }

  async save(config: TCurrent): Promise<TCurrent> {
    // 1. Snapshot previous state for potential rollback
    const previousConfig = this.store.getState();
    const previousMetadata = {...this.metadata};

    // 2. Optimistic Update
    // We increment the version locally and update the store immediately
    this.metadata = {
      ...this.metadata,
      dataVersion: this.metadata.dataVersion + 1,
    };
    const optimisticMetadata = {...this.metadata};

    this.store.setState(config);

    try {
      // 3. Attempt Persistence
      const responseEnvelope: AdapterEnvelope | void = await this.adapter.write(
        config,
        optimisticMetadata
      );

      // 4. Handle Success Response
      // If adapter returns a body, we accept it as the new truth (e.g. server sanitization)
      if (responseEnvelope) {
        if (responseEnvelope.metadata.schemaVersion > this.metadata.schemaVersion) {
          throw new ConfigSchemaOutdatedError(
            responseEnvelope.metadata.schemaVersion,
            this.metadata.schemaVersion
          );
        }

        const migratedEnvelope: AdapterEnvelope = this.migrate(responseEnvelope);
        this.metadata.dataVersion = responseEnvelope.metadata.dataVersion;
        this.store.setState(migratedEnvelope.config as TCurrent);
        return migratedEnvelope.config as TCurrent;
      } else {
        return config;
      }
    } catch (error) {
      // 5. Handle Errors

      // Check for Stale Request:
      // If the manager's dataVersion is HIGHER than what we sent in this request,
      // it means a newer save() has already started/completed.
      // We should ignore this error to avoid reverting the newer state.
      if (this.metadata.dataVersion > optimisticMetadata.dataVersion) {
        return this.store.getState();
      }

      // Handle Conflict (Server has newer data)
      if (error instanceof ConfigConflictError) {
        // Heal: We accept the server's data
        const migratedEnvelope = this.migrate(error.serverEnvelope);
        this.metadata = migratedEnvelope.metadata;
        this.store.setState(migratedEnvelope.config as TCurrent);
        return migratedEnvelope.config as TCurrent;
      }

      // Cannot recorver from outdated schema
      if (error instanceof ConfigSchemaOutdatedError) {
        throw error;
      }

      // Handle Generic Error (Network, etc)
      // Rollback: Revert to the state before this request started
      this.metadata = previousMetadata;
      this.store.setState(previousConfig);

      // Return the restored config (swallowing the error)
      return previousConfig;
    }
  }

  // ------------------------
  // Private methods
  // ------------------------

  protected parse<T extends ZodType>(config: unknown, schema: T): z.infer<T> {
    const zodResult = schema.safeParse(config);

    if (zodResult.error) {
      // Parse failed, retrieving the default
      const zodResult2 = schema.safeParse(undefined);

      if (zodResult2.error) {
        throw new Error(
          '[@config-store] Failed to revert to defaults. Schema must be defined with `.prefault()` on the outer object and `.default()` on every property.'
        );
      }

      return zodResult2.data;
    }

    return zodResult.data;
  }

  protected migrate(initialEnvelope: AdapterEnvelope | void): AdapterEnvelope {
    if (!this.schema) {
      throw new Error(
        '[@config-store] Failed to revert to defaults. Schema must be defined with `.prefault()` on the outer object and `.default()` on every property.'
      );
    }

    if (!initialEnvelope) return this.getDefaultEnvelope();

    let currentEnvelope: AdapterEnvelope = initialEnvelope;

    // Repeat until we get to current schema version
    while (currentEnvelope.metadata.schemaVersion < this.metadata.schemaVersion) {
      const currentVersionDef = this.versions.find(
        (v) => v.version === currentEnvelope.metadata.schemaVersion
      );

      if (!currentVersionDef) {
        // Current schema has unknown version number, reverting to defaults
        currentEnvelope = this.getDefaultEnvelope();
        break;
      }

      const currentConfigParsed: unknown = this.parse(
        currentEnvelope.config,
        currentVersionDef.schema
      );

      const nextVersionDef = this.versions.find(
        (v) => v.version > currentEnvelope.metadata.schemaVersion
      );

      if (!nextVersionDef) {
        // Next schema not found, this should never happen. Reverting to defaults.
        currentEnvelope = this.getDefaultEnvelope();
        break;
      }

      if (!nextVersionDef.migration) {
        // Next schema has no migration, assuming it's not necessary
        currentEnvelope = {
          config: currentConfigParsed,
          metadata: {
            dataVersion: initialEnvelope.metadata.dataVersion,
            schemaVersion: nextVersionDef.version,
          },
        };

        continue;
      }

      try {
        const nextConfig = nextVersionDef.migration(currentEnvelope.config);

        currentEnvelope = {
          config: nextConfig,
          metadata: {
            dataVersion: initialEnvelope.metadata.dataVersion,
            schemaVersion: nextVersionDef.version,
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Migration failed, reverting to defaults
        currentEnvelope = this.getDefaultEnvelope();
        break;
      }
    }

    const finalConfig: TCurrent = this.parse(currentEnvelope.config, this.schema);

    return {
      config: finalConfig,
      metadata: currentEnvelope.metadata,
    };
  }

  protected getDefaultEnvelope(): AdapterEnvelope {
    if (!this.schema) {
      throw new Error(
        '[@config-store] Failed to revert to defaults. Schema must be defined with `.prefault()` on the outer object and `.default()` on every property.'
      );
    }

    const config: TCurrent = this.parse(undefined, this.schema);
    return {config, metadata: this.metadata};
  }
}
