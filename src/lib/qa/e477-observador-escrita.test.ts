/*
  E477 — admin observador da QA (QA-LOGIN-B v2): os controles de escrita apareciam HABILITADOS em Pendências, Cidades,
  Destinos e Marketing (e as ações do servidor dessas telas nem perguntavam pelo observador). Regra (observador.ts):
  configuração da plataforma é proibida para ele sempre (sem alvo); decisão sobre dado REAL é só leitura; sobre dado de
  TESTE segue liberada. Correção: a mesma guarda em cada ação do servidor e, na tela, os controles saem (aviso de só
  leitura) onde o servidor recusaria. Nenhuma escrita com a conta observadora foi feita para provar isto.
  Roda: node --test src/lib/qa/e477-observador-escrita.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasSoLeitura } from "./observador-regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("regra: sem alvo, o observador só lê; quem não é observador nunca é afetado", () => {
  assert.deepEqual(linhasSoLeitura(true, [{ id: "config" }], new Map(), new Set()), ["config"]);
  assert.deepEqual(linhasSoLeitura(false, [{ id: "config" }], new Map(), new Set()), []);
});

test("servidor: configuração da plataforma recusa o observador sempre (sem alvo)", () => {
  const casos: [string, string[]][] = [
    ["lib/cidades-liberadas/actions.ts", ["alternarCidade", "cadastrarCidade"]],
    ["lib/destinos/actions.ts", ["salvarDestino", "alternarDestino"]],
    ["lib/destinos/pessoal-actions.ts", ["resolverLocalNaoAchado"]],
    ["lib/data/proximidades-actions.ts", ["resolverReporteProximidade"]],
    ["lib/data/marketing-admin.ts", ["lancarGastoMarketing", "apagarGastoMarketing"]],
    ["lib/data/conforto-actions.ts", ["rodarPrazosAgora"]],
  ];
  for (const [arq, fns] of casos) {
    const s = ler(arq);
    assert.match(s, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/, arq);
    for (const fn of fns) {
      const corpo = s.slice(s.indexOf(`export async function ${fn}(`));
      const fim = corpo.indexOf("\nexport ", 10);
      assert.match(fim > 0 ? corpo.slice(0, fim) : corpo, /await recusaObservador\([^)]*\)/, `${arq} › ${fn}`);
    }
  }
});

test("servidor: decisões da Central de Pendências recusam o observador sobre dado real (alvo do item)", () => {
  // E477 (resíduo): na Central a observadora é só leitura em TODA linha (teste incluído): a recusa não olha o alvo.
  assert.match(ler("lib/data/nivel-actions.ts"), /recusaObservador\(s\.uid\)/);
  assert.match(ler("lib/data/conforto-actions.ts"), /recusaObservador\(s\.uid\)/);
  assert.match(ler("lib/data/avaliacoes-resposta-actions.ts"), /recusaObservador\(user\.id\)/);
});

test("tela: Cidades, Destinos, Marketing e Pendências tiram os controles onde o servidor recusaria", () => {
  for (const p of ["app/(dashboard)/admin/cidades/page.tsx", "app/(dashboard)/admin/destinos/page.tsx", "app/(dashboard)/admin/marketing/page.tsx"]) {
    const s = ler(p);
    assert.match(s, /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/, p);
    assert.match(s, /<SoLeituraQa/, p);
  }
  const pend = ler("app/(dashboard)/admin/pendencias/page.tsx");
  assert.match(pend, /await soLeituraNaTela\(await alvosDaCentral\(/);
  assert.match(pend, /soLeitura\.has\(chaveDaLinha\(l\)\) \? <SoLeituraQa/);
});
