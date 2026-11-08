/* E769 — duas notas na mesma página (imóvel 4,5·2 x proprietário 4,7·12): a do proprietário diz de quem é. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avaliacoesDoExemplo, resumoAvaliacoesExemplo, avaliacoesDoProprietarioExemplo, PROPRIETARIOS_EXEMPLO } from "../../config/exemplo-proprietarios.ts";

test("ube-003: a nota do imóvel (2 avaliações) difere da do proprietário (todas as casas) — e o rótulo do proprietário diz o escopo", () => {
  const imovel = resumoAvaliacoesExemplo("ube-003")!;
  const dono = PROPRIETARIOS_EXEMPLO.find((p) => p.imoveis.includes("ube-003"))!;
  const todas = avaliacoesDoProprietarioExemplo(dono);
  assert.equal(imovel.n, avaliacoesDoExemplo("ube-003").length);
  assert.ok(todas.length > imovel.n);
  const fonte = readFileSync(new URL("./owner-card.tsx", import.meta.url), "utf8");
  assert.match(fonte, /do proprietário, em todos os imóveis/);
});
