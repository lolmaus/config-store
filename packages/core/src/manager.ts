import z, {type ZodType} from 'zod';
import type {BaseAdapter} from './adapters/base.js';
import type {AdapterEnvelope, Meta, VersionDef} from './types.js';
import {createStore, type StoreApi} from 'zustand/vanilla';

export class ConfigManager<TCurrent = undefined> {
  // ------------------------
  // Properties
  // ------------------------

  protected adapter: BaseAdapter;
  protected versions: VersionDef<any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected schema?: z.ZodType<TCurrent>;
  protected store: StoreApi<TCurrent>;
  protected metadata: Meta;

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

  async load(): Promise<void> {
    const incomingEnvelope: AdapterEnvelope | void = await this.adapter.read();
    const migratedEnvelope: AdapterEnvelope = this.migrate(incomingEnvelope);

    this.metadata = migratedEnvelope.metadata;
    this.store.setState(migratedEnvelope.config as TCurrent);
  }

  get(): TCurrent {
    return this.store.getState();
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
