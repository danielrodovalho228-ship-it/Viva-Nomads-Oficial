import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Regra de ouro: contato nunca é liberado; o aceite revela a identidade.
test("check:consistency passa (sem 'contato liberado no aceite' em /parceiros)", () => {
  const r = spawnSync("node", ["scripts/check-consistency.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("/como-funciona: garantia é só a Caução, sem 'escolhe a que preferir'", () => {
  const src = readFileSync("src/app/(public)/como-funciona/page.tsx", "utf8").replace(/\s+/g, " ");
  assert.ok(!/escolhe a que preferir/i.test(src));
  assert.ok(/Hoje a garantia é a Caução/.test(src));
});
