/*
  E968 (Alta, dinheiro) — pré-aceite expirado (chave E722 ligada) deixava o lead ACEITE e o Fechamento usaria o PREÇO DO
  ANÚNCIO: `propostaAcordadaDoLead` só lê propostas aceitas; com a proposta "expirada" voltava null e os quatro pontos que
  montam o contrato (Fechamento, criação do contrato, documento, cobrança) caíam no monthly_price do imóvel, saltando o
  congelamento (E722). Regras: na expiração a candidatura VOLTA AO DONO (E4) e o preço/taxa congelam no pré-aceite.
  Correção: (1) `preAceiteExpiradoDoLead` — a pré-aceitação mais recente do lead está expirada → os quatro pontos barram,
  nunca usam o anúncio; (2) na expiração o lead aceito por ela volta a "new"; a reabertura o devolve a "accepted".
  Roda: node --test src/lib/data/e968-pre-aceite-expirado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoDoPreAceite, MSG_PRE_ACEITE_EXPIRADO } from "./pre-aceite-fechamento.ts";
import { situacaoCandidatura } from "../candidaturas/status.ts";

test("E968 — a pré-aceitação mais recente expirada barra o Fechamento (nunca o preço do anúncio)", () => {
  assert.equal(decisaoDoPreAceite({ status: "expirada", aceita_em: "2026-11-10T13:00:00Z" }), "expirada");
});

test("E968 — reaberta (aceita), em contrato ou assinada: segue com os valores congelados da proposta", () => {
  for (const status of ["aceita", "em_contrato", "contrato_assinado"]) assert.equal(decisaoDoPreAceite({ status, aceita_em: "2026-11-10T13:00:00Z" }), "segue", status);
});

test("E968 — sem pré-aceitação no lead (candidatura aceita sem proposta): segue como antes", () => {
  assert.equal(decisaoDoPreAceite(null), "segue");
});

test("E968 — a mensagem diz o que aconteceu e o que fazer, sem prometer preço do anúncio", () => {
  assert.match(MSG_PRE_ACEITE_EXPIRADO, /pré-aceitação/);
  assert.match(MSG_PRE_ACEITE_EXPIRADO, /voltou para o proprietário/);
  assert.match(MSG_PRE_ACEITE_EXPIRADO, /reabr/);
  assert.match(MSG_PRE_ACEITE_EXPIRADO, /congelad/);
});

const ler = (p: string) => readFileSync(p, "utf8");

test("E968 — os quatro pontos que montam o contrato barram o pré-aceite expirado ANTES de ler o preço", () => {
  for (const arq of ["src/lib/data/actions.ts", "src/lib/data/fechamento-servidor.ts", "src/app/api/contrato/route.ts", "src/lib/data/leads-actions.ts"]) {
    const s = ler(arq);
    const i = s.indexOf("preAceiteExpiradoDoLead(");
    // E1141: no fluxo do fecho, a proposta lê-se por `propostaDoFechamentoDoLead` (a estadia escolhida ou a de sempre).
    const j = s.indexOf("propostaDoFechamentoDoLead(admin");
    assert.ok(i > 0, `${arq}: chama preAceiteExpiradoDoLead`);
    assert.ok(j > 0 && i < j, `${arq}: a checagem vem antes de ler a proposta acordada`);
  }
});

test("E968 — na expiração (volta ao dono) o lead aceito por ela volta a 'new'; a reabertura o devolve a 'accepted'", () => {
  const s = ler("src/lib/propostas/pre-aceitacao-servidor.ts");
  assert.match(s, /if \(!encerra\) await devolverLeadAoDono\(admin, l\);/);
  assert.match(s, /update\(\{ status: "new", accepted_at: null \}\)\.eq\("id", l\.lead_id\)\.eq\("status", "accepted"\)\.eq\("accepted_at", l\.aceita_em\)/);
  assert.match(s, /await devolverLeadAceito\(admin, p\);\s*return \{ ok: true, prazo: r\.prazo/);
});

test("E968 (ORDEM-DUET-073): lead no estado terminal 'expired' — ao morador 'Não seguiu adiante'; ao dono sem Aceitar/Recusar", () => {
  assert.equal(situacaoCandidatura("expired").label, "Não seguiu adiante");
  const tela = ler("src/app/(dashboard)/dashboard/leads/leads-client.tsx");
  assert.match(tela, /if \(persisted === "expired"\) return "expired";/);
  assert.match(tela, /st === "expired" \? \(/);
  assert.match(ler("src/lib/propostas/pre-aceitacao-servidor.ts"), /else await encerrarLead\(admin, l\);/);
});
