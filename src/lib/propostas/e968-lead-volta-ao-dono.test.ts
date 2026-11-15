/*
  E968 — roda o pre-aceitacao-servidor.ts REAL (harness da Pista 3, e722-harness/): na expiração comum a candidatura volta
  ao dono e o lead aceito POR ESTA pré-aceitação deixa de estar aceito; a reabertura o devolve, com a taxa congelada intacta.
  Roda: node --test src/lib/propostas/e968-lead-volta-ao-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";

const { rodarPreAceitacao, reabrirNoBanco } = await import("./pre-aceitacao-servidor.ts");

function mundoCom(opts: { reaberturas?: number; leadAceitoEm?: string } = {}) {
  const prazo = new Date("2026-11-10T13:00:00Z");
  const c = cenario({ prazo, reaberturas: opts.reaberturas });
  const aceitaEm = String(c.propostas[0].aceita_em);
  const banco = novoBanco({ ...c, leads: [{ id: "lead-prop-1", status: "accepted", accepted_at: opts.leadAceitoEm ?? aceitaEm }] });
  novoMundo();
  return { banco, prazo, aceitaEm, lead: () => banco.tabelas.leads[0] };
}

test("E968: expirou (volta ao dono) → o lead aceito por esta pré-aceitação volta a 'new'", async () => {
  const { banco, prazo, lead } = mundoCom();
  await rodarPreAceitacao(banco.admin, new Date(prazo.getTime() + 60_000));
  assert.equal(banco.tabelas.propostas[0].status, "expirada");
  assert.equal(lead().status, "new");
  assert.equal(lead().accepted_at, null);
});

test("E968: lead aceito ANTES, à parte (outro accepted_at) → o lead fica como está (o Fechamento é barrado pela proposta)", async () => {
  const { banco, prazo, lead } = mundoCom({ leadAceitoEm: "2026-10-01T12:00:00.000Z" });
  await rodarPreAceitacao(banco.admin, new Date(prazo.getTime() + 60_000));
  assert.equal(banco.tabelas.propostas[0].status, "expirada");
  assert.equal(lead().status, "accepted");
});

test("E968: 3ª expiração é TERMINAL (ORDEM-DUET-073) → o lead vai a 'expired' e não há reabertura", async () => {
  const { banco, prazo, lead } = mundoCom({ reaberturas: 2 });
  const depois = new Date(prazo.getTime() + 60_000);
  await rodarPreAceitacao(banco.admin, depois);
  assert.ok(banco.tabelas.propostas[0].pre_aceitacao_encerrada_em);
  assert.equal(lead().status, "expired");
  for (const quem of ["owner", "tenant"] as const) {
    const r = await reabrirNoBanco(banco.admin, "prop-1", quem, new Date(depois.getTime() + 60_000));
    assert.equal(r.ok, false);
  }
  assert.equal(banco.tabelas.propostas[0].status, "expirada");
  assert.equal(lead().status, "expired");
});

test("E968: reabrir devolve o lead a 'accepted' com o accepted_at da pré-aceitação; a taxa congelada nunca é escrita", async () => {
  const { banco, prazo, aceitaEm, lead } = mundoCom();
  const depois = new Date(prazo.getTime() + 60_000);
  await rodarPreAceitacao(banco.admin, depois);
  const r = await reabrirNoBanco(banco.admin, "prop-1", "owner", new Date(depois.getTime() + 60_000));
  assert.equal(r.ok, true);
  assert.equal(banco.tabelas.propostas[0].status, "aceita");
  assert.equal(lead().status, "accepted");
  assert.equal(lead().accepted_at, aceitaEm);
  assert.equal(banco.tabelas.propostas[0].taxa_congelada, 0.08);
  assert.ok(banco.updates.every((u) => !("taxa_congelada" in u.valores)));
});
