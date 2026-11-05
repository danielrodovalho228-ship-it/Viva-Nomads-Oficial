/*
  Estático (laboratório verde, faixa D, lab 0c89bd6a): o t248 estourava os 120 s porque clicava em "Voltar ao anúncio"
  sem salvar a qualificação. Na tela, o botão `qualificacao-voltar` só existe DEPOIS de salvar (`saved`), e salvar exige
  os 5 requisitos, o documento e a resposta da convenção. O spec tem de percorrer esse caminho.
  E196 (fecho): a /qualificar foi absorvida pela Revisão do assistente; o t248 passa a conferir o caminho único.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("na tela, 'Voltar ao anúncio' só aparece depois de salvar a qualificação", () => {
  const tela = ler("src/app/(dashboard)/qualificar/qualificar-client.tsx");
  assert.match(tela, /\{saved \? \(\s*<Button[^>]*\s+variant="accent"[\s\S]*?data-testid="qualificacao-voltar"/);
  assert.match(tela, /disabled=\{!eligible \|\| saving\}[^>]*data-testid="qualificacao-salvar"/);
});

test("E196: o t248 confere o caminho único — link antigo /qualificar?imovel= cai no 'Antes de publicar' do rascunho", () => {
  const spec = ler("tests/e2e/specs/t248-antes-de-anunciar-link.spec.ts");
  assert.match(spec, /page\.goto\(`\/qualificar\?imovel=\$\{imovel\}`/);
  assert.match(spec, /searchParams\.get\("draft"\)\)\.toBe\(imovel\)/);
  assert.match(spec, /searchParams\.get\("etapa"\)\)\.toBe\("revisao"\)/);
  assert.match(spec, /getByTestId\("antes-de-publicar"\)\)\.toBeVisible/);
  assert.match(spec, /getByTestId\("rascunho-requisitos-selo"\)\)\.toHaveCount\(0\)/);
});
