import {describe, it, mock, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {ConfigManager} from './manager.js';
import {BaseAdapter} from './adapters/base.js';
import {type AdapterEnvelope, type ManagerMetadata} from './types.js';
import {ConfigSchemaOutdatedError, ConfigConflictError} from './errors.js';

// --- Types for Test ---
const themeSchema = z.object({theme: z.string().default('light')}).prefault({});
type ThemeConfig = z.infer<typeof themeSchema>;

interface PendingRead {
  resolve: (val: AdapterEnvelope | void) => void;
  reject: (err: unknown) => void;
}
interface PendingWrite extends PendingRead {
  config: unknown;
  metadata: ManagerMetadata;
}

// --- Advanced Mock Adapter ---
class ControlledMockAdapter extends BaseAdapter {
  // A pending read deferred we can resolve or reject manually
  pendingRead?: PendingRead;

  read = mock.fn(async () => {
    return new Promise<AdapterEnvelope | void>((resolve, reject) => {
      this.pendingRead = {
        resolve,
        reject,
      };
    });
  });

  // A list of pending write promises we can resolve/reject manually
  pendingWrites: PendingWrite[] = [];

  write = mock.fn((nextConfig: unknown, metadata: ManagerMetadata) => {
    return new Promise<AdapterEnvelope | void>((resolve, reject) => {
      this.pendingWrites.push({
        config: nextConfig,
        metadata,
        resolve,
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
    manager = ConfigManager.create(adapter, {
      version: 1,
      schema: themeSchema,
    });
  });

  describe('Load', () => {
    it('Faiulre on first read', async () => {
      m = 'initial manager.config.theme';
      assert.strictEqual(manager.config.theme, 'light', m);

      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'manager.config.theme after initial succsessful load';
      assert.strictEqual(manager.config.theme, 'light', m);

      const readPromise = manager.load();

      m = 'manager.state loading ';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'pending',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Read should be pending';
      assert.ok(adapter.pendingRead, m);

      adapter.pendingRead.reject({err: 'Network Down'});

      m = 'Read promise should reject';
      await assert.rejects(
        readPromise,
        (e) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Down',
        m
      );

      m = 'manager.state final';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'error',
          loadError: {err: 'Network Down'},
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'manager.config final';
      assert.deepStrictEqual(
        manager.config,
        {
          theme: 'light',
        },
        m
      );
    });

    it('Faiulre on second read', async () => {
      m = 'initial manager.config.theme';
      assert.strictEqual(manager.config.theme, 'light', m);

      const readPromise1 = manager.load();
      adapter.pendingRead?.resolve({
        config: {theme: 'dark'},
        metadata: {dataVersion: 123, schemaVersion: 321},
      });
      await readPromise1;

      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'success',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 123,
            schemaVersion: 321,
          },
        },
        m
      );

      m = 'manager.config.theme after initial succsessful load';
      assert.strictEqual(manager.config.theme, 'dark', m);

      const readPromise2 = manager.load();

      m = 'manager.state loading';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'pending',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 123,
            schemaVersion: 321,
          },
        },
        m
      );

      m = 'Read should be pending';
      assert.ok(adapter.pendingRead, m);

      adapter.pendingRead.reject({err: 'Network Down'});

      m = 'Read promise should reject';
      await assert.rejects(
        readPromise2,
        (e) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Down',
        m
      );

      m = 'manager.state final';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'error',
          loadError: {err: 'Network Down'},
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 123,
            schemaVersion: 321,
          },
        },
        m
      );

      m = 'manager.config final — should show data from last successful read';
      assert.deepStrictEqual(
        manager.config,
        {
          theme: 'dark',
        },
        m
      );
    });
  });

  describe('Save', () => {
    // beforeEach(async () => {
    // We need a successful load before we can use write
    // const initialData: AdapterEnvelope = {
    //   config: {theme: 'light'},
    //   metadata: {dataVersion: 1, schemaVersion: 1},
    // };
    // const promise = manager.load();
    // adapter.pendingRead?.resolve(initialData);
    // await promise;
    // });

    it('Generic Error (Network Fail). Retains latest state optimistically.', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'initial manager.config.theme';
      assert.strictEqual(manager.config.theme, 'light', m);

      // Start Save: light -> dark
      const savePromise = manager.save({theme: 'dark'});

      // Verify Optimistic Update matches
      m = 'Should have optimistically updated to dark';
      assert.strictEqual(manager.config.theme, 'dark', m);

      m = 'manager.state immediately after save';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Write should be pending';
      assert.ok(adapter.pendingWrites[0], m);

      adapter.pendingWrites[0].reject({err: 'Network Down'});

      m = 'Should reject the save promise';
      await assert.rejects(
        savePromise,
        (e: unknown) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Down',
        m
      );

      m = 'Should remain on "dark" after write failure';
      assert.strictEqual(manager.config.theme, 'dark', m);

      m = 'manager.state final';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'error',
          saveError: {err: 'Network Down'},
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1,
            schemaVersion: 1,
          },
        },
        m
      );
    });

    it('Backend has newer data, Conflict Error, accepts backend data', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'initial manager.config.theme';
      assert.strictEqual(manager.config.theme, 'light', m);

      // Start Save: v1 -> v2, dark
      const savePromise = manager.save({theme: 'dark'});

      m = 'manager.state immediately after save';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          config: {theme: 'dark'},
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      // Simulate Conflict (Server is actually at v5, theme: 'blue')
      const serverEnvelope: AdapterEnvelope = {
        config: {theme: 'blue'},
        metadata: {dataVersion: 5, schemaVersion: 1},
      };
      const conflictError = new ConfigConflictError(serverEnvelope);

      // Simulate network error
      adapter.pendingWrites[0]!.reject(conflictError);

      m = 'Should resolve the save promise';
      await assert.doesNotReject(savePromise, (e: unknown) => e instanceof ConfigConflictError, m);

      // Verify Healing
      m = 'Should accept the server truth (blue) instead of reverting to light';
      assert.strictEqual(manager.config.theme, 'blue', m);

      m = 'Should update metadata to match server';
      assert.strictEqual(manager.dataVersion, 5, m);

      m = 'manager.state final';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // change
          saveError: null,
          hasBeenHydrated: true,
          metadata: {
            dataVersion: 5, // change
            schemaVersion: 1,
          },
        },
        m
      );
    });

    it('Conflict Error on outdated request. Ignored.', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'initial manager.config.theme';
      assert.strictEqual(manager.config.theme, 'light', m);

      m = 'initial manager.dataVersion';
      assert.strictEqual(manager.dataVersion, 0, m);

      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state immediately after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Manager should be optimistically at dark';
      assert.strictEqual(manager.config.theme, 'dark', m);

      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state immediately after fresh request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Manager should be optimistically at blue';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Resolve Request B FIRST (Success)
      // Server accepts blue.
      adapter.pendingWrites[1]!.resolve({
        config: {theme: 'blue'},
        metadata: {dataVersion: 2, schemaVersion: 1},
      });
      await freshPromise;

      m = 'manager.state after fresh request resolves';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // change
          saveError: null,
          hasBeenHydrated: true, // change
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'manager.config.theme.theme after fresh request completes';
      assert.strictEqual(manager.config.theme, 'blue', m);

      m = 'manager.dataVersion after fresh request completes';
      assert.strictEqual(manager.dataVersion, 2, m);

      // Now Reject outdated Request A (Conflict)
      const staleServerState: AdapterEnvelope = {
        config: {theme: 'light'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      };
      adapter.pendingWrites[0]!.reject(new ConfigConflictError(staleServerState));

      m = 'The first promise should NOT reject';
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after outdated request fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // still
          saveError: null,
          hasBeenHydrated: true, // still
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      // Verify State Integrity
      m = 'Store should remain at "blue"';
      assert.strictEqual(manager.config.theme, 'blue', m);

      m = 'dataVersion should remain at v2';
      assert.strictEqual(manager.dataVersion, 2, m);
    });

    it('Two requests, both succeed in normal order.', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated request (dark)
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      // Fresh request (blue)
      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state after fresh request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated reqeust succeeds first
      adapter.pendingWrites[0]!.resolve({
        config: {theme: 'dark'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      });

      m = 'Successful outdated request should not reject';
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after outdated request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still, because the other request is pending
          saveError: null,
          hasBeenHydrated: false, // still
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay at blue';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh reqeust succeeds second
      adapter.pendingWrites[1]!.resolve({
        config: {theme: 'blue'},
        metadata: {dataVersion: 2, schemaVersion: 1},
      });

      m = 'Successful fresh request should not reject';
      await assert.doesNotReject(freshPromise, m);

      m = 'manager.state after fresh request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // change
          saveError: null,
          hasBeenHydrated: true, // change
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay at blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Generic Error on an outdated request. Ignored.', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated request (dark)
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      // Fresh request (blue)
      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state after fresh request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      adapter.pendingWrites[1]!.resolve({
        config: {theme: 'blue'},
        metadata: {dataVersion: 2, schemaVersion: 1},
      });

      m = 'Successful fresh request should not reject';
      await assert.doesNotReject(freshPromise, m);

      m = 'manager.state after fresh request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // change
          saveError: null,
          hasBeenHydrated: true, // change
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay at blue';
      assert.strictEqual(manager.config.theme, 'blue', m);

      adapter.pendingWrites[0]!.reject({err: 'Network error'});

      m =
        'Failed outdated request should NOT reject because we can safely ignore it because we have more recent data in store';
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after outdated request fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // still
          saveError: null,
          hasBeenHydrated: true, // still
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay at blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Generic Error on LAST request, last request finishes second (in order)..', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated requests starts
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept dark from request A.';
      assert.strictEqual(manager.config.theme, 'dark', m);

      // Fresh request starts
      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state after fresh request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept blue from request B.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Outdated request finishes successfully
      adapter.pendingWrites[0]!.resolve({
        config: {theme: 'dark'},
        metadata: {dataVersion: 1, schemaVersion: 1},
      });
      await outdatedPromise;

      m = 'manager.state after outdated request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still, because a more recent request is pending
          saveError: null,
          hasBeenHydrated: false, // still
          metadata: {
            dataVersion: 2, // despite resolved as 1
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay on blue.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh request fails
      adapter.pendingWrites[1]!.reject({err: 'Network Timeout'});

      m = 'Fresh promise should reject';
      await assert.rejects(
        freshPromise,
        (e) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Timeout',
        m
      );

      m = 'manager.state after fresh request fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'error', // change
          saveError: {err: 'Network Timeout'}, // change
          hasBeenHydrated: false, // still
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically stay on blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Generic Error on LAST request, last request finishes first (out of order)', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated request starts
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept dark from request A.';
      assert.strictEqual(manager.config.theme, 'dark', m);

      // Fresh request starts
      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state after fresh request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept blue from request B';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh request finishes successfully
      adapter.pendingWrites[1]!.resolve({
        config: {theme: 'blue'},
        metadata: {dataVersion: 2, schemaVersion: 1},
      });
      await freshPromise;

      m = 'manager.state after fresh request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // change
          saveError: null,
          hasBeenHydrated: true, // change
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay on blue.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh request fails
      adapter.pendingWrites[0]!.reject({err: 'Network Timeout'});

      m = 'Outdated promise should NOT reject despite failure, since we have newer data already';
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after fresh request succeeds';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'success', // still
          saveError: null,
          hasBeenHydrated: true, // still
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically stay on blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Generic Error on BOTH requests, last request finishes first (out of order)', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // Outdated request starts
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state immediately after outdated request starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept dark from request A.';
      assert.strictEqual(manager.config.theme, 'dark', m);

      // Fresh request
      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state immediately after fresh reqeust starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept blue from request B.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh request fails first
      adapter.pendingWrites[1]!.reject({err: 'Network Timeout'});

      m = 'Fresh promise should reject';
      await assert.rejects(
        freshPromise,
        (e: unknown) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Timeout',
        m
      );

      m = 'manager.state after fresh reqeust fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'error', // change
          saveError: {err: 'Network Timeout'}, // change
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay on blue.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Outdated request fails also
      adapter.pendingWrites[0]!.reject({err: 'Network Timeout'});

      m = "Outdated promise should NOT reject because we're on more recent data anyway";
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after outdated reqeust fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'error', // still
          saveError: {err: 'Network Timeout'}, // still
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically stay on blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Generic Error on BOTH requests, last request finishes last (in order order)', async () => {
      m = 'manager.state initial';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'initial',
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 0,
            schemaVersion: 1,
          },
        },
        m
      );

      // OUtdated request starts.
      const outdatedPromise = manager.save({theme: 'dark'});

      m = 'manager.state immediately after outdated reqeust starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', //change
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 1, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept dark from request A.';
      assert.strictEqual(manager.config.theme, 'dark', m);

      const freshPromise = manager.save({theme: 'blue'});

      m = 'manager.state immediately after fresh reqeust starts';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // change
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically accept blue from request B.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Outdated request fails first
      adapter.pendingWrites[0]!.reject({err: 'Network Timeout'});

      m = "Outdated promise should NOT reject because we're on more recent data anyway";
      await assert.doesNotReject(outdatedPromise, m);

      m = 'manager.state after outdated reqeust fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'pending', // still
          saveError: null,
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should stay on blue.';
      assert.strictEqual(manager.config.theme, 'blue', m);

      // Fresh request fails also
      adapter.pendingWrites[1]!.reject({err: 'Network Timeout'});

      m = 'Outdated promise should reject';
      await assert.rejects(
        freshPromise,
        (e: unknown) => e && typeof e === 'object' && 'err' in e && e.err === 'Network Timeout',
        m
      );

      m = 'manager.state after fresh reqeust fails';
      assert.partialDeepStrictEqual(
        manager.state,
        {
          loadStatus: 'initial',
          loadError: null,
          saveStatus: 'error', // change
          saveError: {err: 'Network Timeout'}, // change
          hasBeenHydrated: false,
          metadata: {
            dataVersion: 2, // still
            schemaVersion: 1,
          },
        },
        m
      );

      m = 'Store should optimistically stay on blue';
      assert.strictEqual(manager.config.theme, 'blue', m);
    });

    it('Client Outdated (Schema Version Mismatch). Should Throw.', async () => {
      m = 'initial manager.schemaVersion';
      assert.strictEqual(manager.schemaVersion, 1);

      // Start Save
      const savePromise = manager.save({theme: 'dark'});

      // Simulate Server Response from the Future (Schema v2)
      // The server processed the request but returned data formatted for v2
      const futureEnvelope: AdapterEnvelope = {
        config: {theme: 'dark', newFeature: true},
        metadata: {dataVersion: 2, schemaVersion: 2}, // v2 > v1
      };

      adapter.pendingWrites[0]!.resolve(futureEnvelope);

      m = 'Should reject when receiving a higher schema version';
      await assert.rejects(
        savePromise,
        (err: unknown) => err instanceof ConfigSchemaOutdatedError,
        m
      );
    });
  });
});
