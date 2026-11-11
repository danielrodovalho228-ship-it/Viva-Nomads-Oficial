import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MIN_DESCRICAO } from "../../src/lib/anuncio/prontidao.ts";

// Lab 10/11 (rodada completa 5eb1fad9): t288 e t292 paravam no Passo 7 ("Título e descrição do anúncio") esperando
// "Quanto custa por mês?". Desde o E135 o "Continuar" da Descrição exige a descrição com o mínimo de caracteres, e o
// rascunho que as specs gravam em draft_data só tinha título. O rascunho precisa trazer a descrição de teste.
const fixture = readFileSync("tests/e2e/fixtures/cadastro.ts", "utf8");

test("fixture: DESCRICAO_RASCUNHO_TESTE tem o mínimo que o Passo 7 exige", () => {
  const m = /export const DESCRICAO_RASCUNHO_TESTE =\s*"([^"]+)"/.exec(fixture);
  assert.ok(m, "DESCRICAO_RASCUNHO_TESTE não existe em tests/e2e/fixtures/cadastro.ts");
  assert.ok(m[1].trim().length >= MIN_DESCRICAO, `descrição com ${m[1].trim().length} caracteres (mínimo ${MIN_DESCRICAO})`);
  assert.doesNotMatch(m[1], /aluguel|comiss|vistoria|temporada/i);
});

for (const spec of ["t288-padrao-minimo-59a", "t292-conforto-manutencao-59"]) {
  test(`${spec}: o rascunho gravado em draft_data leva a descrição`, () => {
    const texto = readFileSync(`tests/e2e/specs/${spec}.spec.ts`, "utf8");
    const linhas = texto.split("\n").filter((l) => l.includes("draft_data: {"));
    assert.ok(linhas.length > 0, "sem draft_data na spec");
    for (const l of linhas) assert.match(l, /description: DESCRICAO_RASCUNHO_TESTE/, l.trim());
  });
}
