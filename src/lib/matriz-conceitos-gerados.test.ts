/**
 * Matriz de conformidade, passada 6 (Pista A, 04/11): a branch `mockups` tem três conceitos gerados
 * (`media-generation-mockup-…`) que não tinham linha na matriz. `espelho-perfil` é a linha `perfil-01-topo-espelho`;
 * `pouso-morador` e `setup-imovel` ganharam linha própria, com estado. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const matriz = readFileSync(new URL("../../docs/matriz-conformidade-mockups.md", import.meta.url), "utf8");
const linha = (chave: string) => matriz.split("\n").find((l) => l.startsWith(`| \`${chave}\` |`));

test("os conceitos gerados da branch mockups têm linha na matriz, com estado", () => {
  for (const chave of ["pouso-morador", "setup-imovel", "perfil-01-topo-espelho"]) {
    const l = linha(chave);
    assert.ok(l, `sem linha: ${chave}`);
    assert.match(l!, /\| (Conforme|Decisão pendente|Corrigido|A conferir|Parcial|Congelado)[^|]*\|/, chave);
  }
  assert.match(linha("setup-imovel")!, /\| Conforme \|/);
  assert.match(linha("pouso-morador")!, /\| Decisão pendente \|/);
});
