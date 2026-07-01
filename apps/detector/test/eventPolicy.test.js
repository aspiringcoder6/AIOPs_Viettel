import test from "node:test";
import assert from "node:assert/strict";

import { parseEventTypeList, shouldBypassCooldown } from "../eventPolicy.js";

test("parseEventTypeList normalizes comma separated event types", () => {
  assert.deepEqual(
    parseEventTypeList(" error_spike, CPU_SPIKE ,, memory_spike "),
    new Set(["ERROR_SPIKE", "CPU_SPIKE", "MEMORY_SPIKE"])
  );
});

test("ERROR_SPIKE bypasses detector cooldown by default", () => {
  assert.equal(shouldBypassCooldown("ERROR_SPIKE"), true);
  assert.equal(shouldBypassCooldown("error_spike"), true);
});

test("metric driven events keep detector cooldown by default", () => {
  assert.equal(shouldBypassCooldown("CPU_SPIKE"), false);
  assert.equal(shouldBypassCooldown("MEMORY_SPIKE"), false);
  assert.equal(shouldBypassCooldown("LATENCY_SPIKE"), false);
});

test("cooldown bypass list can be overridden", () => {
  assert.equal(shouldBypassCooldown("ERROR_SPIKE", "CPU_SPIKE"), false);
  assert.equal(shouldBypassCooldown("CPU_SPIKE", "CPU_SPIKE"), true);
});
