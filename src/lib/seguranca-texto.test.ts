import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 404cd213: página pública /seguranca sem "aluguel", "comissão" ou "vistoria".
test("/seguranca não usa aluguel, comissão nem vistoria em texto público", () => {
  const fonte = readFileSync(new URL("../app/(public)/seguranca/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /alugu[eé]l|comiss[ãa]o|vistoria|corretagem|intermedia/i);
  assert.match(fonte, /valor mensal/);
});
