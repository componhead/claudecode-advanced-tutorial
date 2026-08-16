/**
 * @module inventory.test
 * Test di base per inventory.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { totalValueCents, lowestStock } from "./inventory.js";

test("totalValueCents somma quantity * unitPriceCents", () => {
  const total = totalValueCents([
    { sku: "A", quantity: 2, unitPriceCents: 500 },
    { sku: "B", quantity: 1, unitPriceCents: 1000 },
  ]);
  assert.equal(total, 2000);
});

test("lowestStock ritorna undefined su array vuoto", () => {
  assert.equal(lowestStock([]), undefined);
});
