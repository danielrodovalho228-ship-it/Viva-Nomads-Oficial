/*
  E903: em /para-proprietarios, o bloco "Simulador de rentabilidade" prometia a ferramenta ao visitante, mas o botão caía no
  login sem aviso (/dashboard/simulador exige conta). Correção mínima: o bloco e o botão dizem que o simulador fica na conta
  ("Entrar para calcular"). O simulador NÃO fica público. Roda: node --test src/lib/e903-simulador-na-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_SIMULADOR_PUBLICO, NOTA_SIMULADOR_NA_CONTA } from "./simulador-na-conta.ts";

const s = readFileSync(new URL("../app/(public)/para-proprietarios/page.tsx", import.meta.url), "utf8");
const bloco = s.slice(s.indexOf('data-testid="proprietarios-simulador"'), s.indexOf("Quanto custa, em reais"));

test("E903: os textos dizem que o simulador fica na conta", () => {
  assert.equal(BOTAO_SIMULADOR_PUBLICO, "Entrar para calcular");
  assert.match(NOTA_SIMULADOR_NA_CONTA, /na sua conta/);
  assert.match(NOTA_SIMULADOR_NA_CONTA, /grátis/);
});

test("E903: o bloco mostra a nota e o botão 'Entrar para calcular'; o destino segue sendo o simulador da conta", () => {
  assert.match(bloco, /\{NOTA_SIMULADOR_NA_CONTA\}/);
  assert.match(bloco, /data-testid="proprietarios-simulador-conta"/);
  assert.match(bloco, /href="\/dashboard\/simulador"[\s\S]*\{BOTAO_SIMULADOR_PUBLICO\}/);
  assert.doesNotMatch(bloco, />\s*Calcular rentabilidade\s*</);
  // O simulador não ficou público: a rota continua dentro do painel (protegida pelo proxy).
  assert.ok(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8").includes('pathname.startsWith("/dashboard")'));
});
