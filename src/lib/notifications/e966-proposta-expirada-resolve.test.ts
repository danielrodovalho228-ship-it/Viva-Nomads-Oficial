/*
  E966 — proposta expirada deixava o aviso CRÍTICO ("responda a proposta") e a faixa vermelha para sempre: a expiração
  RESOLVE o problema (regra do E444/E445: a faixa do crítico só some quando o problema é resolvido). Correção: quem expira
  as propostas (expirarVencidas, na leitura e na rotina diária) resolve, para as DUAS partes, os avisos críticos que pedem
  resposta àquela proposta (proposta_recebida, proposta_vencendo).
  Roda: node --test src/lib/notifications/e966-proposta-expirada-resolve.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_DA_PROPOSTA_ABERTA, prioridadeDoAviso, ACAO_RESOLVE } from "./avisos.ts";
import { criticosPendentes } from "./sino.ts";

test("E966 — os eventos que a expiração resolve são os críticos de responder à proposta", () => {
  assert.deepEqual([...EVENTOS_DA_PROPOSTA_ABERTA].sort(), ["proposta_recebida", "proposta_vencendo"]);
  for (const e of EVENTOS_DA_PROPOSTA_ABERTA) {
    assert.equal(prioridadeDoAviso(e, "morador"), "critico");
    assert.equal(ACAO_RESOLVE[e], "respondeu");
  }
});

test("E966 — aviso crítico resolvido sai da faixa (criticosPendentes)", () => {
  const base = { id: "a", evento: "proposta_recebida", prioridade: "critico", titulo: "t", criado_em: "2026-11-10T10:00:00Z", lido_em: null, url: "/dashboard/propostas/p1", ref_id: "p1" };
  assert.equal(criticosPendentes([{ ...base, resolvido_em: null }] as never).length, 1);
  assert.equal(criticosPendentes([{ ...base, resolvido_em: "2026-11-12T10:00:00Z" }] as never).length, 0);
});

test("E966 — expirarVencidas resolve, para as duas partes, os avisos de responder das propostas que expirou", () => {
  const s = readFileSync("src/lib/data/propostas-servidor.ts", "utf8");
  const fn = s.slice(s.indexOf("export async function expirarVencidas"), s.indexOf("\n}\n", s.indexOf("export async function expirarVencidas")));
  assert.match(fn, /from\("avisos"\)\s*\.update\(\{ resolvido_em:/);
  assert.match(fn, /\.in\("ref_id", ids\)/);
  assert.match(fn, /\.in\("evento", \[\.\.\.EVENTOS_DA_PROPOSTA_ABERTA\]\)/);
  assert.match(fn, /\.is\("resolvido_em", null\)/);
  assert.doesNotMatch(fn, /usuario_id/); // as duas partes, não só quem abriu a lista
});
