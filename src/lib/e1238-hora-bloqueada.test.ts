/*
  E1238 — ORDEM-DUET 1276 (o caso que o coordenador achou): sem conferência aberta até à entrada, o prazo segue o
  cálculo vivo depois dela, e o dono podia mudar a hora das instruções depois de o morador entrar (14:00 → 08:00
  encurtava a janela em 6 h). A regra: a hora de entrada das instruções fica BLOQUEADA depois da âncora de entrada
  vigente — o servidor recusa mudar contratos_checkin.horario com "A entrada já aconteceu; o horário não pode mais
  ser alterado." Antes da âncora, a mudança é aceite e o prazo acompanha.
  Roda: node --test src/lib/e1238-hora-bloqueada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as conf from "./conferencia.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

const j = (await import("./data/janela-conferencia.ts")) as unknown as {
  MSG_HORA_DE_ENTRADA_BLOQUEADA?: string;
  horaDeEntradaBloqueada?: (p: { blocos: { inicio: string | null; fim: string | null; status?: string | null }[]; horaAtual: string | null; horaNova: string | null; agora: Date }) => boolean;
};
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));
const BLOCOS = [{ inicio: "2026-12-01", fim: "2027-01-30", status: "ativo" }];

test("H1. a mensagem, nas palavras do coordenador", () => {
  assert.equal(j.MSG_HORA_DE_ENTRADA_BLOQUEADA, "A entrada já aconteceu; o horário não pode mais ser alterado.");
});

test("H2. antes da âncora vigente: mudar a hora é aceite, e o prazo acompanha a hora nova", () => {
  assert.equal(typeof j.horaDeEntradaBloqueada, "function");
  // 01/12 14:00 BRT = 17:00Z. Às 16:59Z ainda não chegou.
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "08:00", agora: new Date("2026-11-20T12:00:00Z") }), false, "semanas antes");
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "16:00", agora: new Date("2026-12-01T16:59:00Z") }), false, "um minuto antes da âncora");
  assert.equal(conf.prazoDaJanela("entrada", { inicio: "2026-12-01", checkinAfter: "16:00" }, null)?.toISOString(), "2026-12-03T19:00:00.000Z", "o prazo acompanha a hora nova");
});

test("H3. depois da âncora vigente, sem conferência aberta: mudar a hora é recusado, e o prazo não muda", () => {
  const agora = new Date("2026-12-01T18:00:00Z");
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "08:00", agora }), true, "14:00 → 08:00 depois da entrada");
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "20:00", agora }), true, "também para alargar");
  // Sem hora até à entrada, a âncora é 23:59 do dia; depois dela, pôr uma hora também é mudar.
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: null, horaNova: "14:00", agora: new Date("2026-12-01T20:00:00Z") }), false, "sem hora: às 17:00 BRT a âncora (23:59) ainda não chegou");
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: null, horaNova: "14:00", agora: new Date("2026-12-02T03:00:00Z") }), true, "sem hora: depois das 23:59");
  // O prazo, recusada a mudança, fica o da hora que estava.
  assert.equal(conf.prazoDaJanela("entrada", { inicio: "2026-12-01", checkinAfter: "14:00" }, null)?.toISOString(), "2026-12-03T17:00:00.000Z");
});

test("H4. a mesma hora não é mudança: as instruções e o plantão continuam editáveis depois da entrada", () => {
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "14:00", agora: new Date("2026-12-05T12:00:00Z") }), false);
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: " 14:00 ", agora: new Date("2026-12-05T12:00:00Z") }), false, "espaços não contam");
});

test("H5. o servidor recusa ANTES de gravar: salvarInstrucoesEntrada confere a hora contra a âncora vigente", () => {
  const acoes = ler("./data/checkin-actions.ts");
  const salvar = acoes.slice(acoes.indexOf("export async function salvarInstrucoesEntrada("));
  const trava = salvar.indexOf("horaDeEntradaBloqueada(");
  assert.ok(trava > 0, "a ação chama a regra");
  assert.ok(trava < salvar.indexOf('.from("contratos_checkin")'), "a recusa vem antes do upsert");
  assert.match(
    salvar,
    /\n\s*if \(horaDeEntradaBloqueada\(\{ blocos, horaAtual: [^}]*, horaNova: v\.dados\.horario, agora: new Date\(\) \}\)\) \{\s*return \{ ok: false, error: MSG_HORA_DE_ENTRADA_BLOQUEADA \};\s*\}/,
    "a condição é só a regra (sem curto-circuito) e devolve a mensagem do coordenador",
  );
  assert.match(acoes, /contrato_blocos\(inicio, fim, status\)/, "lê os blocos para a âncora");
  assert.match(salvar, /horaAtual: \(k\?\.horario as string \| null\) \?\? null/, "a hora vigente é a gravada no contrato");
});
