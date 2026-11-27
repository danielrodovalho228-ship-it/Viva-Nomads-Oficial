import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
const ini = s.indexOf("const actions = candidatouSe");
const bloco = s.slice(ini, s.indexOf("Bloco de ações", ini) > 0 ? ini + 4200 : ini + 4200);

// E713 (resíduo reprovado): na COLUNA de reserva do anúncio de exemplo restavam os 4 campos (Quando quer entrar?, Até quando?,
// Quantas pessoas?, Motivo da estadia) e o aviso, sem botão de envio. No exemplo a coluna é a explicação + "Ver imóveis reais" (E694).
test("no anúncio de exemplo a coluna de reserva não traz os campos de reserva, só a explicação e a saída", () => {
  const exemploAntes = bloco.indexOf("{exemplo ? (");
  const campos = bloco.indexOf('camposPeriodo("candidatura")');
  assert.ok(exemploAntes > 0 && campos > 0);
  assert.ok(exemploAntes < campos, "o ramo do exemplo vem antes dos campos");
  assert.match(bloco, /data-testid="exemplo-sem-acoes"/);
  assert.match(bloco, /data-testid="exemplo-ver-reais"/);
  // os campos só existem no ramo do anúncio real (depois do `) : (`)
  const ramoReal = bloco.slice(bloco.indexOf(") : (", exemploAntes));
  assert.match(ramoReal, /camposPeriodo\("candidatura"\)/);
  assert.match(ramoReal, /data-testid="candidatura-motivo"/);
  assert.doesNotMatch(bloco.slice(exemploAntes, bloco.indexOf(") : (", exemploAntes)), /camposPeriodo|candidatura-motivo/);
});

test("no anúncio de exemplo a coluna não repete o aviso 'esta solicitação não é enviada' (nem o selo aviso-demo)", () => {
  const exemploAntes = bloco.indexOf("{exemplo ? (");
  const ramoExemplo = bloco.slice(exemploAntes, bloco.indexOf(") : (", exemploAntes));
  assert.doesNotMatch(ramoExemplo, /EXEMPLO_AVISO_DEMO|aviso-demo/);
});
