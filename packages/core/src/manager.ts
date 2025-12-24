import z, {type ZodType} from 'zod';
import type {BaseAdapter} from './adapters/base.js';
import {
  type AdapterEnvelope,
  type ManagerState,
  type ManagerStatus,
  type ManagerMetadata,
  type VersionDef,
} from './types.js';
import {createStore, type StoreApi} from 'zustand/vanilla';
import {ConfigSchemaOutdatedError, ConfigConflictError, ConfigSchemaParseError} from './errors.js';

export class ConfigManager<TCurrent = undefined> {
  // ------------------------
  // Properties
  // ------------------------

  protected adapter: BaseAdapter;
  protected versions: VersionDef<any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected schema: z.ZodType<TCurrent> | undefined;
  public store: StoreApi<ManagerState<TCurrent>> | undefined;

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

    if (this.schema) {
      this.store = createStore<ManagerState<TCurrent>>(() => ({
        config: undefined,
        status: 'initial',
        error: null,
        hasBeenHydrated: false,
        metadata: {
          dataVersion: 0,
          schemaVersion: versions.at(-1)?.version ?? 0,
        },
        isInitial: true,
        isLoading: false,
        isSuccess: false,
        isError: false,
      }));

      const {config} = this.migrate();

      this.setConfig(config as TCurrent);
    }
  }

  // ------------------------
  // Static methods
  // ------------------------

  static create(adapter: BaseAdapter): ConfigManager<undefined> {
    return new ConfigManager(adapter, undefined, undefined);
  }

  // ------------------------
  // Public Getters
  // ------------------------

  get state(): ManagerState<TCurrent> {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to access current state before adding a version');
    }

    return this.store.getState();
  }

  get config(): TCurrent {
    if (!this.state.config) {
      throw new Error('[@config-store] Attempted to access current config before adding a version');
    }

    return this.state.config;
  }

  get status(): ManagerStatus {
    return this.state.status;
  }

  get error(): unknown {
    return this.state.error;
  }

  get metadata(): ManagerMetadata {
    return this.state.metadata;
  }

  get dataVersion(): number {
    return this.metadata.dataVersion;
  }

  get schemaVersion(): number {
    return this.metadata.schemaVersion;
  }

  get isInitial(): boolean {
    return this.state.isInitial;
  }

  get isLoading(): boolean {
    return this.state.isLoading;
  }

  get isSuccess(): boolean {
    return this.state.isSuccess;
  }

  get isError(): boolean {
    return this.state.isError;
  }

  get hasBeenHydrated(): boolean {
    return this.state.hasBeenHydrated;
  }

  // ------------------------
  // Public methods
  // ------------------------

  addVersion<TNext>(versionDef: VersionDef<TCurrent, TNext>): ConfigManager<TNext> {
    if (this.store && versionDef.version <= this.schemaVersion) {
      throw new Error(
        `[@config-manager] Version numbers must be incremental, but after ${this.schemaVersion} received ${versionDef.version}`
      );
    }

    // 1. Create the new definition object
    const newVersion: VersionDef<TCurrent, TNext> = {
      version: versionDef.version,
      schema: versionDef.schema,
      migration: versionDef.migration,
    };

    // Returning a NEW instance with the updated generic type <TNext>.
    // We pass the accumulated history (previous versions + new version).
    return new ConfigManager<TNext>(
      this.adapter,
      [...this.versions, newVersion],
      versionDef.schema
    );
  }

  async load(): Promise<void> {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to load config before adding a version');
    }

    this.setStatusLoading();

    let incomingEnvelope: AdapterEnvelope | void;

    try {
      incomingEnvelope = await this.adapter.read();
    } catch (e) {
      this.setStatusError(e);
      return;
    }

    this.setStatusSuccess();

    const migratedEnvelope: AdapterEnvelope = this.migrate(incomingEnvelope);

    this.setMetadata(migratedEnvelope.metadata);
    this.setConfig(migratedEnvelope.config as TCurrent);
  }

  async save(config: TCurrent): Promise<TCurrent> {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to save config before adding a version');
    }

    // 1. Snapshot previous state for potential rollback
    const previousConfig = this.store.getState();
    const previousMetadata = {...this.metadata};

    // 2. Optimistic Update
    // We increment the version locally and update the store immediately
    this.incrementDataVersion();
    const optimisticMetadata = {...this.metadata};

    this.setConfig(config);

    let responseEnvelope: AdapterEnvelope | void;

    try {
      // 3. Attempt Persistence
      responseEnvelope = await this.adapter.write(config, optimisticMetadata);
    } catch (error) {
      // 5. Handle Errors

      // Check for Stale Request:
      // If the manager's dataVersion is HIGHER than what we sent in this request,
      // it means a newer save() has already started/completed.
      // We should ignore this error to avoid reverting the newer state.
      if (this.dataVersion > optimisticMetadata.dataVersion) {
        return this.config;
      }

      // Handle Conflict (Server has newer data)
      if (error instanceof ConfigConflictError) {
        // Heal: We accept the server's data
        const migratedEnvelope = this.migrate(error.serverEnvelope);
        this.setStatusSuccess();
        this.setMetadata(migratedEnvelope.metadata);
        this.setConfig(migratedEnvelope.config as TCurrent);
        return migratedEnvelope.config as TCurrent;
      }

      // Handle Generic Error (Network, etc)
      // Rollback: Revert to the state before this request started
      this.setMetadata(previousMetadata);
      this.store.setState(previousConfig);

      throw error;
    }

    this.setStatusSuccess();

    // 4. Handle Success Response
    // If adapter returns a body, we accept it as the new truth (e.g. server sanitization)
    if (responseEnvelope) {
      if (responseEnvelope.metadata.schemaVersion > this.schemaVersion) {
        throw new ConfigSchemaOutdatedError(
          responseEnvelope.metadata.schemaVersion,
          this.schemaVersion
        );
      }

      const migratedEnvelope: AdapterEnvelope = this.migrate(responseEnvelope);
      this.setDataVersion(responseEnvelope.metadata.dataVersion);
      this.setConfig(migratedEnvelope.config as TCurrent);
      return migratedEnvelope.config as TCurrent;
    } else {
      return config;
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
        throw new ConfigSchemaParseError(
          zodResult2.error
        );
      }

      return zodResult2.data;
    }

    return zodResult.data;
  }

  protected migrate(initialEnvelope: AdapterEnvelope | void): AdapterEnvelope {
    if (!this.schema) {
      throw new Error(
        '[@config-store] Failed to revert to defaults. Schema must be defined with `.optional()`, `.nullable()`, `.nullish()` or `.prefault({})` on the outer object and `.default()` on every property.'
      );
    }

    if (!initialEnvelope) return this.getDefaultEnvelope();

    let currentEnvelope: AdapterEnvelope = initialEnvelope;

    // Repeat until we get to current schema version
    while (currentEnvelope.metadata.schemaVersion < this.schemaVersion) {
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
      throw new Error('[@config-store] Attempted to set metadata before adding a version');
    }

    let config: TCurrent;
    try {
      config = this.parse(undefined, this.schema);
    } catch (e) {
      throw new ConfigSchemaParseError(e);
    }

    return {config, metadata: this.metadata};
  }

  protected setStatusLoading() {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set metadata before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      status: 'loading',
      isInitial: false,
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: null,
    }));
  }

  protected setStatusSuccess() {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set metadata before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      status: 'success',
      isInitial: false,
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      hasBeenHydrated: true,
    }));
  }

  protected setStatusError(error: unknown) {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set metadata before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      status: 'error',
      isInitial: false,
      isLoading: false,
      isSuccess: false,
      isError: true,
      error,
    }));
  }

  protected setMetadata(metadata: ManagerMetadata) {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set metadata before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      metadata,
    }));
  }

  protected setDataVersion(dataVersion: number) {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set dataVersion before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        dataVersion,
      },
    }));
  }

  protected setConfig(config: TCurrent) {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to set config before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      config,
    }));
  }

  protected incrementDataVersion() {
    if (!this.store) {
      throw new Error('[@config-store] Attempted to increment dataVersion before adding a version');
    }

    this.store.setState((state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        dataVersion: state.metadata.dataVersion + 1,
      },
    }));
  }
}
