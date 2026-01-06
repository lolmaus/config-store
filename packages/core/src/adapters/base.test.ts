import {describe, it, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {BaseAdapter} from './base.js';
import type {AdapterEnvelope, ManagerMetadata} from '../types.js';

class TestAdapter extends BaseAdapter {
  async read(): Promise<AdapterEnvelope> {
    return {config: {value: 'default'}, metadata: {dataVersion: 1, schemaVersion: 1}};
  }

  async write(nextConfig: unknown, metadata: ManagerMetadata): Promise<AdapterEnvelope> {
    return {config: nextConfig, metadata};
  }
}

describe('BaseAdapter', () => {
  let adapter: TestAdapter;
  let m: string;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('Contract Implementation', () => {
    it('allows a concrete class to implement the Envelope pattern', async () => {
      // Validating read()
      const readResult = await adapter.read();
      m = 'Read should return the defined envelope';
      assert.deepStrictEqual(
        readResult,
        {config: {value: 'default'}, metadata: {dataVersion: 1, schemaVersion: 1}},
        m
      );

      // Validating write()
      // Now we pass a valid object and partial object
      const writeResult = await adapter.write(
        {value: 'new-val'},
        {dataVersion: 2, schemaVersion: 1}
      );

      m = 'Write should return the defined write result';
      assert.deepStrictEqual(
        writeResult,
        {config: {value: 'new-val'}, metadata: {dataVersion: 2, schemaVersion: 1}},
        m
      );
    });
  });
});
