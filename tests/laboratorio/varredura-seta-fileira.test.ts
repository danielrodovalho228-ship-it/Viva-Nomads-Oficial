import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: a seta da fileira rolável (E248) cobre a borda da fileira de propósito; a varredura "fixo" não pode acusá-la.
test("controlesCobertos ignora a seta da fileira rolável", () => {
  const src = readFileSync("tests/e2e/fixtures/varredura.ts", "utf8");
  assert.match(src, /setaDaFileira = \(t: Element \| null\) => !!t\?\.closest\("\[data-testid\^='fileira-seta-'\]"\)/);
  assert.match(src, /const cobre = .*!setaDaFileira\(t\)/);
  assert.match(src, /if \(setaDaFileira\(topo\)\) continue;/);
  const comp = readFileSync("src/components/ui/fileira-rolavel.tsx", "utf8");
  assert.match(comp, /data-testid="fileira-seta-dir"/);
  assert.match(comp, /data-testid="fileira-seta-esq"/);
});
