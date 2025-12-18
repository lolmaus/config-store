import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js';
import {BaseAdapter} from './adapters/base.js';
import {type AdapterEnvelope, type Meta} from './types.js';
import {ConfigSchemaOutdatedError, ConfigConflictError} from './errors.js';

// --- Types for Test ---
const themeSchema = z.object({theme: z.string().default('light')}).prefault({});
type ThemeConfig = z.infer<typeof themeSchema>;

interface PendingWrite {
  config: unknown;
  metadata: Meta;
  resolve: (val: AdapterEnvelope | void) => void;
  reject: (err: unknown) => void;
}

// --- Advanced Mock Adapter ---
class ControlledMockAdapter extends BaseAdapter {
  // Store the current server truth
  state: AdapterEnvelope = {
    config: {theme: 'light'},
    metadata: {dataVersion: 1, schemaVersion: 1},
  };

  read = mock.fn(async () => this.state);

  // A list of pending write promises we can resolve/reject manually
  pendingWrites: PendingWrite[] = [];

  write = mock.fn((nextConfig: unknown, metadata: Meta) => {
    return new Promise<AdapterEnvelope | void>((resolve, reject) => {
      this.pendingWrites.push({
        config: nextConfig,
        metadata,
        resolve: (val) => {
          // Simulate server-side persistence logic
          if (val && val.config) {
            // If the server returned a new payload, that becomes truth
            this.state = val;
          } else {
            // If void (204 No Content), the submitted config becomes truth
            // and we simulate a dataVersion bump
            this.state = {
              config: nextConfig,
              metadata: {
                ...metadata,
                dataVersion: metadata.dataVersion + 1,
              },
            };
          }
          resolve(val);
        },
        reject,
      });
    });
  });
}

describe('ConfigManager — Error Handling & Concurrency', () => {
  let adapter: ControlledMockAdapter;
  let manager: ConfigManager<ThemeConfig>;
  let m: string;

  beforeEach(async () => {
    adapter = new ControlledMockAdapter();

    // We explicitly cast the chain result to the expected generic type
    // to avoid using 'any' or complex inference in the 'let' declaration above.
    manager = ConfigManager.create(adapter).addVersion({
      version: 1,
      schema: themeSchema,
    });

    await manager.load();
  });

  it('Scenario 1: Generic Error (Network Fail). Reverts optimistic update.', async () => {
    m = 'initial manager.get().theme';
    assert.strictEqual(manager.get().theme, 'light', m);

    // Start Save: light -> dark
    const savePromise = manager.save({theme: 'dark'});

    // Verify Optimistic Update matches
    m = 'Should have optimistically updated to dark';
    assert.strictEqual(manager.get().theme, 'dark', m);

    // Simulate Adapter Failure (Network Error)
    const pending = adapter.pendingWrites.shift();

    m = 'Write should be pending';
    assert.ok(pending, m);

    pending.reject(new Error('Network Down'));

    // Await Manager (swallows error, handles revert)
    await savePromise;

    // Verify Rollback
    m = 'Should revert to "light" after write failure';
    assert.strictEqual(manager.get().theme, 'light', m);
  });

  it('Scenario 2: Conflict Error on LAST request. Heals from server payload.', async () => {
    m = 'initial manager.get().theme';
    assert.strictEqual(manager.get().theme, 'light', m);

    // Start Save: v1 -> v2, dark
    const savePromise = manager.save({theme: 'dark'});

    // Simulate Conflict (Server is actually at v5, theme: 'blue')
    const serverEnvelope: AdapterEnvelope = {
      config: {theme: 'blue'},
      metadata: {dataVersion: 5, schemaVersion: 1},
    };
    const conflictError = new ConfigConflictError(serverEnvelope);

    const pending = adapter.pendingWrites.shift();

    m = 'promise should be pending';
    assert.ok(pending, m);

    pending.reject(conflictError);
    await savePromise;

    // Verify Healing
    m = 'Should accept the server truth (blue) instead of reverting to light';
    assert.strictEqual(manager.get().theme, 'blue', m);

    m = 'Should update metadata to match server';
    assert.strictEqual(manager.metadata.dataVersion, 5, m);
  });

  it('Scenario 3: Conflict Error on STALE request. Ignored.', async () => {
    m = 'initial manager.get().theme';
    assert.strictEqual(manager.get().theme, 'light', m);

    m = 'initial manager.metadata.dataVersion';
    assert.strictEqual(manager.metadata.dataVersion, 1, m);

    // Request A (Stale): v1 -> v2 (dark)
    const p1 = manager.save({theme: 'dark'});
    const reqA = adapter.pendingWrites.shift();

    m = 'req A exists';
    assert.ok(reqA, m);

    // Request B (Fresh): v2 -> v3 (blue)
    // Manager is optimistically at 'dark' (v2) when B starts.
    const p2 = manager.save({theme: 'blue'});
    const reqB = adapter.pendingWrites.shift();

    m = 'reqB exists';
    assert.ok(reqB, m);

    m = 'Manager should be optimistically at blue';
    assert.strictEqual(manager.get().theme, 'blue', m);

    // Resolve Request B FIRST (Success)
    // Server accepts B.
    reqB.resolve({
      config: {theme: 'blue'},
      metadata: {dataVersion: 3, schemaVersion: 1},
    });
    await p2;

    m = 'manager.get().theme.theme after req2 completes';
    assert.strictEqual(manager.get().theme, 'blue', m);

    m = 'manager.metadata.dataVersion after req2 completes';
    assert.strictEqual(manager.metadata.dataVersion, 3, m);

    // Now Reject Request A (Conflict)
    // This represents an old request finally failing after a newer one succeeded.
    const staleServerState: AdapterEnvelope = {
      config: {theme: 'light'},
      metadata: {dataVersion: 1, schemaVersion: 1},
    };
    reqA.reject(new ConfigConflictError(staleServerState));

    await p1.catch(() => {});

    // 6. Verify State Integrity
    m = 'Store should remain at "blue" (v3). The failure of v2 should not revert v3.';
    assert.strictEqual(manager.get().theme, 'blue', m);

    m = 'Metadata should remain at v3';
    assert.strictEqual(manager.metadata.dataVersion, 3, m);
  });

  it('Scenario 4: Generic Error on STALE request. Ignored.', async () => {
    // 1. Req A (dark)
    const p1 = manager.save({theme: 'dark'});
    const reqA = adapter.pendingWrites.shift();

    // 2. Req B (blue)
    const p2 = manager.save({theme: 'blue'});
    const reqB = adapter.pendingWrites.shift();

    // 3. Resolve B Success
    if (reqB) {
      reqB.resolve({
        config: {theme: 'blue'},
        metadata: {dataVersion: 3, schemaVersion: 1},
      });
    }
    await p2;

    // 4. Fail A (Network Error)
    if (reqA) {
      reqA.reject(new Error('Network Timeout'));
    }
    await p1.catch(() => {});

    m = 'Store should stay at blue. Old network error should not revert new state.';
    assert.strictEqual(manager.get().theme, 'blue', m);
  });

  it('Scenario 5: Client Outdated (Schema Version Mismatch). Should Throw.', async () => {
    m = 'initial manager.metadata.schemaVersion';
    assert.strictEqual(manager.metadata.schemaVersion, 1);

    // Start Save
    const savePromise = manager.save({theme: 'dark'});
    const pending = adapter.pendingWrites.shift();

    m = 'Reqeust exists';
    assert.ok(pending, m);

    // Simulate Server Response from the Future (Schema v2)
    // The server processed the request but returned data formatted for v2
    const futureEnvelope: AdapterEnvelope = {
      config: {theme: 'dark', newFeature: true},
      metadata: {dataVersion: 2, schemaVersion: 2}, // v2 > v1
    };

    pending.resolve(futureEnvelope);

    m = 'Should reject when receiving a higher schema version';
    await assert.rejects(
      savePromise,
      (err: unknown) => err instanceof ConfigSchemaOutdatedError,
      m
    );
  });
});
