import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E744: o título não nasce preenchido e o Continuar da Descrição o exige; continuarAte escreve um quando falta.
const fx = readFileSync("tests/e2e/fixtures/cadastro.ts", "utf8");
test("continuarAte preenche o título ao cruzar a Descrição", () => {
  assert.match(fx, /atual === "descricao"/);
  assert.match(fx, /getByTestId\("cadastro-titulo"\)/);
  assert.match(fx, /export const TITULO_PADRAO_LAB/);
});
test("a tela mantém o campo cadastro-titulo e o aviso 'Título ainda não definido'", () => {
  assert.match(readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx", "utf8"), /data-testid="cadastro-titulo"/);
});
