/* Varredura 31/10: o rótulo do StatCard vai em até 2 linhas — a 390 cortava ("Manutenções em abe…", "Receita mensal em
   vigên…"). Roda: node --test src/components/dashboard/stat-rotulo.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("StatCard: rótulo com line-clamp-2, sem truncate", () => {
  const c = readFileSync(new URL("./primitives.tsx", import.meta.url), "utf8");
  assert.match(c, /<span className="line-clamp-2 min-w-0 text-\[11px\] leading-tight text-muted sm:text-sm" data-testid="stat-rotulo">/);
  assert.doesNotMatch(c, /min-w-0 truncate text-\[11px\]/);
});
