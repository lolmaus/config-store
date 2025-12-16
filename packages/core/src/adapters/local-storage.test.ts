import { describe, it, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { LocalStorageAdapter } from "./local-storage.js";

describe("LocalStorageAdapter", () => {
  const KEY = "app-settings";
  let adapter: LocalStorageAdapter<unknown>;

  // 1. Setup global environment mock
  before(() => {
    const window = new Window();
    global.localStorage = window.localStorage;
    // @ts-expect-error Need to mock on top of happy-dom
    global.window = window;
  });

  // 2. Cleanup (Optional but good practice)
  after(() => {
    // @ts-expect-error Need to mock on top of happy-dom
    delete global.localStorage;
    // @ts-expect-error Need to mock on top of happy-dom
    delete global.window;
  });

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter({ key: KEY });
  });

  describe("read()", () => {
    it("returns undefined if key does not exist", () => {
      assert.strictEqual(adapter.read(), undefined);
    });

    it("returns parsed object if valid JSON exists", () => {
      const data = { theme: "dark", volume: 50 };
      localStorage.setItem(KEY, JSON.stringify(data));

      assert.deepStrictEqual(adapter.read(), data);
    });

    it("returns undefined and warns if JSON is invalid", (t) => {
      localStorage.setItem(KEY, "{ invalid json");
      const consoleSpy = t.mock.method(console, "warn", () => {});

      assert.strictEqual(adapter.read(), undefined);
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
    });
  });

  describe("write()", () => {
    it("serializes and saves data to localStorage", () => {
      const data = { theme: "light" };
      adapter.write(data);

      assert.strictEqual(localStorage.getItem(KEY), JSON.stringify(data));
    });

    it("handles localStorage errors gracefully", (t) => {
      // Mock setItem to throw
      t.mock.method(localStorage, "setItem", () => {
        throw new Error("Quota exceeded");
      });
      const consoleSpy = t.mock.method(console, "warn", () => {});

      assert.doesNotThrow(() => adapter.write({ foo: "bar" }));
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
    });
  });
});
