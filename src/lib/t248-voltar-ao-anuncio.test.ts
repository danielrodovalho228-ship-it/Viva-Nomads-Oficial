/*
  Estático (laboratório verde, faixa D, lab 0c89bd6a): o t248 estourava os 120 s porque clicava em "Voltar ao anúncio"
  sem salvar a qualificação. Na tela, o botão `qualificacao-voltar` só existe DEPOIS de salvar (`saved`), e salvar exige
  os 5 requisitos, o documento e a resposta da convenção. O spec tem de percorrer esse caminho.
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

test("t248 cumpre os requisitos, envia o documento e salva antes de clicar em Voltar", () => {
  const spec = ler("tests/e2e/specs/t248-antes-de-anunciar-link.spec.ts");
  const salvar = spec.indexOf("qualificacao-salvar");
  const voltar = spec.indexOf("qualificacao-voltar");
  assert.ok(salvar > 0, "o spec clica em Salvar qualificação");
  assert.ok(voltar > salvar, "e só depois em Voltar ao anúncio");
  assert.match(spec, /Enviar documentação do imóvel/);
  assert.match(spec, /Sim, permite/);
  for (const r of ["Imóvel mobiliado completo", "Aceita período mínimo de 30 dias", "IPTU em dia", "Proprietário ou procurador legal"]) {
    assert.ok(spec.includes(r), `marca o requisito "${r}"`);
  }
});
