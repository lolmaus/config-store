/**
 * The Strict Contract for adapter read
 */
export interface AdapterEnvelope<TData, TMeta = unknown> {
  settings: TData;
  metadata?: TMeta;
}

/**
 * The Loose Contract for Writes
 * A write result is just a partial update of the envelope.
 */
export type AdapterWriteResult<TData, TMeta = unknown> = Partial<
  AdapterEnvelope<TData, TMeta>
> | void;
