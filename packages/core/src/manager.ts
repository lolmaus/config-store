import z, {type ZodType} from 'zod';
import type {BaseAdapter} from './adapters/base.js';
import {
  type AdapterEnvelope,
  type ManagerState,
  type ManagerRequestStatus,
  type ManagerMetadata,
  type VersionDef,
} from './types.js';
import {createStore, type StoreApi} from 'zustand/vanilla';
import {ConfigSchemaOutdatedError, ConfigConflictError, ConfigSchemaParseError} from './errors.js';
import type {ManagerStatus} from './index.js';

/**
 * The main class managing configuration state, persistence, validation, and version migration.
 * It uses a Zustand store internally to maintain reactivity.
 *
 * @template TCurrent The type of the current configuration schema.
 */
export class ConfigManager<TCurrent = undefined> {
  // ------------------------
  // Properties
  // ------------------------

  protected adapter: BaseAdapter;
  protected versions: VersionDef<any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected schema: z.ZodType<TCurrent>;

  /**
   * The underlying Zustand store instance.
   * Can be used to subscribe to state changes directly.
   */
  public store: StoreApi<ManagerState<TCurrent>>;

  // ------------------------
  // Constructor
  // ------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected constructor(adapter: BaseAdapter, versions: VersionDef<any, any>[] = []) {
    const currentVersion = versions.at(-1) as VersionDef<unknown, TCurrent>;

    if (!currentVersion)
      throw new Error('[@config-store] Initialized the ConfigManager without versions');

    this.adapter = adapter;
    this.versions = versions;
    this.schema = currentVersion.schema;

    const metadata: ManagerMetadata = {
      dataVersion: 0,
      schemaVersion: currentVersion.version ?? 0,
    };

    const {config} = this.migrate(undefined, metadata);

    this.store = createStore<ManagerState<TCurrent>>(() => ({
      config,
      metadata,
      hasBeenHydrated: false,

      // Load state
      loadStatus: 'initial',
      loadError: null,
      isLoadInitial: true,
      isLoadPending: false,
      isLoadSuccess: false,
      isLoadError: false,

      // Save state
      saveStatus: 'initial',
      saveError: null,
      isSaveInitial: true,
      isSavePending: false,
      isSaveSuccess: false,
      isSaveError: false,
    }));
  }

  // ------------------------
  // Static methods
  // ------------------------

  /**
   * Creates a new ConfigManager instance.
   *
   * @param adapter The storage adapter to use (i. e. LocalStorageAdapter, AsyncAdapter or custom).
   * @param initialVersion The definition of the initial schema version (Version 1).
   * @returns A ConfigManager instance typed with the initial schema.
   */
  static create<TConfig>(
    adapter: BaseAdapter,
    initialVersion: VersionDef<void, TConfig>
  ): ConfigManager<TConfig> {
    return new ConfigManager<TConfig>(adapter, [initialVersion]);
  }

  // ------------------------
  // Public Getters
  // ------------------------

  /** The entire state snapshot of the manager, including config, metadata and load/save state. */
  get state(): ManagerState<TCurrent> {
    return this.store.getState();
  }

  /** The current stored config. */
  get config(): TCurrent {
    return this.state.config;
  }

  /** The metadata (data version and schema version). */
  get metadata(): ManagerMetadata {
    return this.state.metadata;
  }

  /** The current data version number. */
  get dataVersion(): number {
    return this.metadata.dataVersion;
  }

  /** The current schema version number. */
  get schemaVersion(): number {
    return this.metadata.schemaVersion;
  }

  /** True if the store has successfully loaded or saved data at least once. */
  get hasBeenHydrated(): boolean {
    return this.state.hasBeenHydrated;
  }

  /** The status of the load operation. */
  get loadStatus(): ManagerRequestStatus {
    return this.state.loadStatus;
  }

  /** The error from the last load operation, if any. */
  get loadError(): unknown {
    return this.state.loadError;
  }

  /** True if load status is 'initial'. */
  get isLoadInitial(): boolean {
    return this.state.isLoadInitial;
  }

  /** True if load status is 'pending'. */
  get isLoadPending(): boolean {
    return this.state.isLoadPending;
  }

  /** True if load status is 'success'. */
  get isLoadSuccess(): boolean {
    return this.state.isLoadSuccess;
  }

  /** True if load status is 'error'. */
  get isLoadError(): boolean {
    return this.state.isLoadError;
  }

  // ------------------------
  // Public methods
  // ------------------------

  /**
   * Defines the next version of the configuration schema.
   * This method uses an immutable builder pattern and returns a *new* ConfigManager instance
   * typed with the new schema.
   *
   * @param versionDef The definition of the new version, including schema and migration function.
   * @returns A new ConfigManager instance.
   */
  addVersion<TNext>(versionDef: VersionDef<TCurrent, TNext>): ConfigManager<TNext> {
    if (this.store && versionDef.version <= this.schemaVersion) {
      throw new Error(
        `[@config-manager] Version numbers must be incremental, but after ${this.schemaVersion} received ${versionDef.version}`
      );
    }

    const newVersion: VersionDef<TCurrent, TNext> = {
      version: versionDef.version,
      schema: versionDef.schema,
      migration: versionDef.migration,
    };

    // Returning a new instance with the updated generic type <TNext>.
    // We pass the accumulated history (previous versions + new version).
    return new ConfigManager<TNext>(this.adapter, [...this.versions, newVersion]);
  }

  /**
   * Loads the configuration from the adapter.
   * Handles deserialization, validation, and migration of data.
   * Updates the store with the result.
   */
  async load(): Promise<void> {
    this.setLoadStatus('pending');

    let incomingEnvelope: AdapterEnvelope | null | undefined | void;

    try {
      incomingEnvelope = await this.adapter.read();
    } catch (e) {
      this.setLoadStatus('error', e);
      throw e;
    }

    this.setLoadStatus('success');

    const migratedEnvelope: AdapterEnvelope = this.migrate(incomingEnvelope, this.metadata);

    this.setMetadata(migratedEnvelope.metadata);
    this.setConfig(migratedEnvelope.config as TCurrent);
  }

  /**
   * Saves the configuration to the adapter.
   * Performs an optimistic update on the store immediately.
   * Handles race conditions and version conflicts.
   *
   * @param config The new configuration to save.
     @returns The resolved configuration (may differ from input if server modified it or if race condition occurred).
   */
  async save(config: TCurrent): Promise<TCurrent> {
    // Optimistic Update
    // We increment the version locally and update the store immediately
    this.incrementDataVersion();
    this.setSaveStatus('pending');

    const optimisticMetadata = {...this.metadata};

    this.setConfig(config);

    let responseEnvelope: AdapterEnvelope | null | undefined | void;

    try {
      // Attempt to persist the config
      responseEnvelope = await this.adapter.write(config, optimisticMetadata);
    } catch (error) {
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
        const migratedEnvelope = this.migrate(error.serverEnvelope, this.metadata);
        this.setSaveStatus('success');
        this.setMetadata(migratedEnvelope.metadata);
        this.setConfig(migratedEnvelope.config as TCurrent);
        return migratedEnvelope.config as TCurrent;
      }

      // Handle Generic Error (Network, etc)
      this.setSaveStatus('error', error);
      throw error;
    }

    if (optimisticMetadata.dataVersion < this.dataVersion) {
      // This request is outdated, ignore
      return config;
    }

    this.setSaveStatus('success');

    // Handle Success Response
    // If adapter returns a body, we accept it as the new truth (e.g. server sanitization)
    if (responseEnvelope) {
      if (responseEnvelope.metadata.schemaVersion > this.schemaVersion) {
        // ToDo: figure out how to recover from this case
        throw new ConfigSchemaOutdatedError(
          responseEnvelope.metadata.schemaVersion,
          this.schemaVersion
        );
      }

      const migratedEnvelope: AdapterEnvelope = this.migrate(responseEnvelope, this.metadata);
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
      // Parse failed, attempt retrieving a default config value
      const zodResult2 = schema.safeParse(undefined);

      if (zodResult2.error) {
        throw new ConfigSchemaParseError(zodResult2.error);
      }

      return zodResult2.data;
    }

    return zodResult.data;
  }

  protected migrate(
    initialEnvelope: AdapterEnvelope | null | undefined | void,
    metadata: ManagerMetadata
  ): AdapterEnvelope<TCurrent> {
    if (!initialEnvelope) return this.getDefaultEnvelope(metadata);

    let currentEnvelope: AdapterEnvelope = initialEnvelope;

    // Repeat until we get to current schema version
    while (currentEnvelope.metadata.schemaVersion < this.schemaVersion) {
      const currentVersionDef = this.versions.find(
        (v) => v.version === currentEnvelope.metadata.schemaVersion
      );

      if (!currentVersionDef) {
        // Current schema has unknown version number, reverting to defaults
        currentEnvelope = this.getDefaultEnvelope(metadata);
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
        currentEnvelope = this.getDefaultEnvelope(metadata);
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
        currentEnvelope = this.getDefaultEnvelope(metadata);
        break;
      }
    }

    const finalConfig: TCurrent = this.parse(currentEnvelope.config, this.schema);

    return {
      config: finalConfig,
      metadata: currentEnvelope.metadata,
    };
  }

  protected getDefaultEnvelope(metadata: ManagerMetadata): AdapterEnvelope<TCurrent> {
    let config: TCurrent;

    try {
      config = this.parse(undefined, this.schema);
    } catch (e) {
      throw new ConfigSchemaParseError(e);
    }

    return {config, metadata: metadata};
  }

  protected setLoadStatus(status: 'pending' | 'success'): void;
  protected setLoadStatus(status: 'error', e: unknown): void;
  protected setLoadStatus(status: ManagerStatus, error: unknown = null) {
    this.store.setState((state) => ({
      ...state,
      loadStatus: status,
      isLoadInitial: false,
      isLoadPending: status === 'pending',
      isLoadSuccess: status === 'success',
      isLoadError: status === 'error',
      loadError: error,
      hasBeenHydrated: status === 'success' || state.hasBeenHydrated,
    }));
  }

  protected setSaveStatus(status: 'pending' | 'success'): void;
  protected setSaveStatus(status: 'error', e: unknown): void;
  protected setSaveStatus(status: ManagerStatus, error: unknown = null) {
    this.store.setState((state) => ({
      ...state,
      saveStatus: status,
      isSaveInitial: false,
      isSavePending: status === 'pending',
      isSaveSuccess: status === 'success',
      isSaveError: status === 'error',
      saveError: error,
      hasBeenHydrated: status === 'success' || state.hasBeenHydrated,
    }));
  }

  protected setMetadata(metadata: ManagerMetadata) {
    this.store.setState((state) => ({
      ...state,
      metadata,
    }));
  }

  protected setDataVersion(dataVersion: number) {
    this.store.setState((state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        dataVersion,
      },
    }));
  }

  protected setConfig(config: TCurrent) {
    this.store.setState((state) => ({
      ...state,
      config,
    }));
  }

  protected incrementDataVersion() {
    this.store.setState((state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        dataVersion: state.metadata.dataVersion + 1,
      },
    }));
  }
}
