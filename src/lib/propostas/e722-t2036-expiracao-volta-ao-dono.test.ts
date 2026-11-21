/*
  t2036 · E722 (Pista 3, lote 2, item E4) @E722 @ao-vivo-seguro
  Regra: vencida a pré-aceitação sem contrato, ela EXPIRA sem punição e a candidatura volta ao dono, com o relógio dele
  (E395: 1 dia útil, seg–sex, Brasília) recomeçando a cada volta e nunca passando da entrada. Os dois são avisados.
  Roda o pre-aceitacao-servidor.ts REAL (dublês só nas bordas, ver e722-harness/).
  Parte "com feriados": o código não conhece feriado (prazoDoDono só pula sáb/dom) — vermelho na main sem quebrar nada,
  registrado como defeito/dúvida no PR para o Gerente e NÃO incluído aqui.
  Roda: node --test src/lib/propostas/e722-t2036-expiracao-volta-ao-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";
import { TEXTO_JANELA_TERMINOU, TEXTO_SEM_PUNICAO } from "./pre-aceitacao.ts";

const { rodarPreAceitacao, reabrirNoBanco } = await import("./pre-aceitacao-servidor.ts");
const H = 3_600_000;

test("E4: expirou numa terça → status expirada, volta ao dono com prazo de 1 dia útil (quarta, mesma hora); os dois avisados", async () => {
  const prazo = new Date("2026-11-10T13:00:00Z"); // terça 10:00 BRT
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo }));
  const agora = (mundo.agora = new Date(prazo.getTime()));
  const r = await rodarPreAceitacao(db.admin, agora);
  assert.equal(r.expiradas, 1);
  assert.equal(r.encerradas, 0);
  const p = db.tabelas.propostas[0];
  assert.equal(p.status, "expirada");
  assert.equal(p.pre_aceitacao_expirou_em, agora.toISOString());
  assert.equal(p.pre_aceitacao_encerrada_em, null);
  assert.equal(p.pre_aceitacao_dono_ate, "2026-11-11T13:00:00.000Z"); // quarta 10:00 BRT
  const morador = mundo.avisos.find((a) => a.userId === "morador-prop-1")!;
  assert.ok(morador.corpo.includes(TEXTO_JANELA_TERMINOU) && morador.corpo.includes(TEXTO_SEM_PUNICAO));
  assert.match(morador.corpo, /O proprietário tem até 11\/11\/2026 às 10:00/);
  const dono = mundo.avisos.find((a) => a.userId === "dono-1")!;
  assert.match(dono.corpo, /a candidatura voltou para você\. O seu prazo para decidir termina em 11\/11\/2026 às 10:00/);
});

test("E4: expirou numa sexta → o dono tem até segunda (fim de semana não conta)", async () => {
  const prazo = new Date("2026-11-13T19:00:00Z"); // sexta 16:00 BRT
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo }));
  await rodarPreAceitacao(db.admin, (mundo.agora = new Date(prazo.getTime() + H)));
  assert.equal(db.tabelas.propostas[0].pre_aceitacao_dono_ate, "2026-11-16T20:00:00.000Z"); // segunda 17:00 BRT
});

test("E4: o relógio do dono nunca passa da entrada", async () => {
  const prazo = new Date("2026-11-10T13:00:00Z");
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo, entrada: "2026-11-11" }));
  await rodarPreAceitacao(db.admin, (mundo.agora = prazo));
  assert.equal(db.tabelas.propostas[0].pre_aceitacao_dono_ate, "2026-11-11T03:00:00.000Z"); // 11/11 00:00 BRT
});

test("E4: a cada volta o relógio do dono RECOMEÇA (reabre e expira de novo → novo prazo, a partir da nova expiração)", async () => {
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo: new Date("2026-11-10T13:00:00Z") }));
  await rodarPreAceitacao(db.admin, (mundo.agora = new Date("2026-11-10T13:00:00Z")));
  const primeiro = db.tabelas.propostas[0].pre_aceitacao_dono_ate;
  const re = await reabrirNoBanco(db.admin, "prop-1", "owner", new Date("2026-11-10T15:00:00Z"));
  assert.equal(re.ok, true);
  assert.equal(db.tabelas.propostas[0].pre_aceitacao_dono_ate, null, "na reabertura o relógio do dono sai da tela (um prazo por vez)");
  const novoFim = new Date(db.tabelas.propostas[0].pre_aceitacao_ate as string);
  await rodarPreAceitacao(db.admin, (mundo.agora = novoFim)); // sexta 13/11 12:00 BRT
  const segundo = db.tabelas.propostas[0].pre_aceitacao_dono_ate;
  assert.notEqual(segundo, primeiro);
  assert.equal(segundo, "2026-11-16T15:00:00.000Z"); // 1 dia útil depois da nova expiração: segunda 12:00 BRT
});
