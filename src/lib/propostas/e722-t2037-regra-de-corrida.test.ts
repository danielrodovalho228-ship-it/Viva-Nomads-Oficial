/*
  t2037 · E722 (Pista 3, lote 2, item E5) @E722 @ao-vivo-seguro
  Regra de corrida, como está escrita: com vários pré-aceites nas mesmas datas, quem conclui o contrato primeiro fica com o
  imóvel; os demais recebem a mensagem clara, sem punição, e NADA volta sozinho para a fila — só o dono reabre, à mão,
  e só com as datas livres. Falha de leitura do período NÃO conta como perda.
  Roda o pre-aceitacao-servidor.ts REAL (dublês só nas bordas, ver e722-harness/).
  Roda: node --test src/lib/propostas/e722-t2037-regra-de-corrida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";
import { TEXTO_PERDEU_A_VEZ, TEXTO_PERDEU_A_VEZ_DONO } from "./pre-aceitacao.ts";

const { rodarPreAceitacao, reabrirNoBanco } = await import("./pre-aceitacao-servidor.ts");
const AGORA = new Date("2026-11-10T15:00:00Z");
const PRAZO = new Date("2026-11-12T15:00:00Z");

function doisPreAceites() {
  const a = cenario({ id: "A", prazo: PRAZO, tenant: "morador-A" });
  const b = cenario({ id: "B", prazo: PRAZO, tenant: "morador-B" });
  const tabelas = {
    propostas: [...a.propostas, ...b.propostas],
    proposta_versoes: [...a.proposta_versoes, ...b.proposta_versoes],
    profiles: [...a.profiles, b.profiles[0]],
    leads: [{ id: "lead-B", status: "aceita" }],
  };
  // A concluiu o contrato: as datas do imóvel estão ocupadas para B.
  tabelas.propostas[0].status = "contrato";
  return tabelas;
}

test("E5: quem não concluiu perde a vez com a mensagem clara; o dono também é avisado; o lead não é mexido", async () => {
  const mundo = novoMundo();
  mundo.conflito = async () => "Estas datas já estão ocupadas por outro contrato.";
  const db = novoBanco(doisPreAceites());
  const r = await rodarPreAceitacao(db.admin, (mundo.agora = AGORA));
  assert.equal(r.perderamAVez, 1);
  const b = db.tabelas.propostas.find((p) => p.id === "B")!;
  assert.equal(b.status, "expirada");
  assert.equal(b.pre_aceitacao_perdeu_em, AGORA.toISOString());
  assert.equal(db.tabelas.propostas.find((p) => p.id === "A")!.status, "contrato", "quem concluiu fica com o imóvel");
  assert.match(mundo.avisos.find((x) => x.userId === "morador-B")!.corpo, new RegExp(TEXTO_PERDEU_A_VEZ.slice(0, 60)));
  assert.match(mundo.avisos.find((x) => x.userId === "dono-1")!.corpo, new RegExp(TEXTO_PERDEU_A_VEZ_DONO.slice(0, 50)));
  assert.equal(mundo.avisos.some((x) => x.userId === "morador-A"), false, "quem venceu não recebe aviso de corrida");
  assert.equal(db.lidas.includes("leads"), false, "nada volta sozinho para a fila (o lead não é tocado)");
  assert.equal(db.tabelas.leads[0].status, "aceita");
});

test("E5: só o dono reabre quem perdeu a vez, e só com as datas livres", async () => {
  const mundo = novoMundo();
  let ocupado = true;
  mundo.conflito = async () => (ocupado ? "Estas datas já estão ocupadas por outro contrato." : null);
  const db = novoBanco(doisPreAceites());
  await rodarPreAceitacao(db.admin, (mundo.agora = AGORA));
  const pelo = await reabrirNoBanco(db.admin, "B", "tenant", AGORA);
  assert.deepEqual(pelo, { ok: false, error: "Outra pessoa concluiu o contrato deste imóvel antes (regra de corrida). Só o proprietário pode reabrir esta candidatura." });
  const comDatasOcupadas = await reabrirNoBanco(db.admin, "B", "owner", AGORA);
  assert.deepEqual(comDatasOcupadas, { ok: false, error: "O contrato de outra pessoa ainda ocupa estas datas: não dá para reabrir agora." });
  ocupado = false;
  const ok = await reabrirNoBanco(db.admin, "B", "owner", AGORA);
  assert.equal(ok.ok, true);
  const b = db.tabelas.propostas.find((p) => p.id === "B")!;
  assert.equal(b.status, "aceita");
  assert.equal(b.pre_aceitacao_perdeu_em, null);
});

test("E5: não conseguir ler o período não é perder a corrida", async () => {
  const mundo = novoMundo();
  mundo.conflito = async () => "Não foi possível conferir as datas agora.";
  const db = novoBanco(doisPreAceites());
  const r = await rodarPreAceitacao(db.admin, (mundo.agora = AGORA));
  assert.equal(r.perderamAVez, 0);
  assert.equal(db.tabelas.propostas.find((p) => p.id === "B")!.status, "aceita");
});
