import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BaseAdapter } from "./base.js";

class MockAdapter extends BaseAdapter<unknown> {
  read() {
    return { value: "test" };
  }
  write() {}
}

describe("BaseAdapter", () => {
  it("implements a default onWriteError that logs to console", (t) => {
    const adapter = new MockAdapter();

    // Mock console.error
    const consoleSpy = t.mock.method(console, "error", () => {});
    const error = new Error("Test error");

    adapter.onWriteError(error);

    // Assertions
    assert.strictEqual(consoleSpy.mock.callCount(), 1);
    const args = consoleSpy.mock.calls[0]?.arguments;
    assert.strictEqual(args?.[0], "[SettingsManager] Write failed:");
    assert.strictEqual(args?.[1], error);
  });
});
