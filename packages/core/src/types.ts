/**
 * Base type for metadata
 */
export interface Meta {
  dataVersion: number;
  schemaVersion: number;
}

/**
 * The Strict Contract for adapter read
 */
export interface AdapterEnvelope<TMeta extends Meta = Meta> {
  config: unknown;
  metadata?: TMeta;
}

/**
 * The Loose Contract for Writes
 * A write result is just a partial update of the envelope.
 */
export type AdapterWriteResult<TMeta extends Meta = Meta> = Partial<AdapterEnvelope<TMeta>>;
