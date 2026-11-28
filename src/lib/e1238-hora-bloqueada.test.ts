/*
  E1238 — ORDEM-DUET 1276 (o caso que o coordenador achou): sem conferência aberta até à entrada, o prazo segue o
  cálculo vivo depois dela, e o dono podia mudar a hora das instruções depois de o morador entrar (14:00 → 08:00
  encurtava a janela em 6 h). A regra: a hora de entrada das instruções fica BLOQUEADA depois da âncora de entrada
  vigente — o servidor recusa mudar contratos_checkin.horario com "A entrada já aconteceu; o horário não pode mais
  ser alterado." Antes da âncora, a mudança é aceite e o prazo acompanha.
  ORDEM-DUET 1284 (a regra é UMA SÓ, palavras do coordenador): "Nenhuma edição de horário pode pôr a âncora no passado.
  O servidor só aceita uma hora nova se a âncora que ela produz for igual ou posterior a agora." Três casos:
   1. depois da âncora vigente → recusa com a mensagem de cima (H3);
   2. antes da âncora vigente, mas a hora nova já passou → "Esse horário de entrada já passou; informe um horário a
      partir de agora." (H6);
   3. hora nova no futuro → aceite, e o prazo acompanha (H7, H8).
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
  MSG_HORA_DE_ENTRADA_NO_PASSADO?: string;
  recusaDaHoraDeEntrada?: (p: { blocos: { inicio: string | null; fim: string | null; status?: string | null }[]; horaAtual: string | null; horaNova: string | null; agora: Date }) => string | null;
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

test("H5. o servidor recusa ANTES de gravar, pela regra única (recusaDaHoraDeEntrada), e devolve a mensagem dela", () => {
  const acoes = ler("./data/checkin-actions.ts");
  const salvar = acoes.slice(acoes.indexOf("export async function salvarInstrucoesEntrada("));
  const trava = salvar.indexOf("recusaDaHoraDeEntrada(");
  assert.ok(trava > 0, "a ação chama a regra");
  assert.ok(trava < salvar.indexOf('.from("contratos_checkin")'), "a recusa vem antes do upsert");
  assert.match(acoes, /contrato_blocos\(inicio, fim, status\)/, "lê os blocos para a âncora");
  assert.match(
    salvar,
    /\n\s*const recusaDaHora = recusaDaHoraDeEntrada\(\{ blocos, horaAtual: \(k\?\.horario as string \| null\) \?\? null, horaNova: v\.dados\.horario, agora: new Date\(\) \}\);\s*if \(recusaDaHora\) return \{ ok: false, error: recusaDaHora \};/,
    "a hora vigente é a gravada no contrato; a recusa devolve a mensagem da regra",
  );
});

const R = (horaAtual: string | null, horaNova: string, agora: string) => j.recusaDaHoraDeEntrada!({ blocos: BLOCOS, horaAtual, horaNova, agora: new Date(agora) });

test("H6. ORDEM-DUET 1284, caso 2: no dia da entrada às 15:00, sem hora prévia, gravar 11:00 → recusado com a segunda mensagem; a âncora continua 23:59", () => {
  assert.equal(j.MSG_HORA_DE_ENTRADA_NO_PASSADO, "Esse horário de entrada já passou; informe um horário a partir de agora.");
  assert.equal(typeof j.recusaDaHoraDeEntrada, "function");
  // 01/12 15:00 BRT = 18:00Z. Sem hora, a âncora vigente é 23:59 (ainda não chegou); 11:00 já passou.
  assert.equal(R(null, "11:00", "2026-12-01T18:00:00Z"), j.MSG_HORA_DE_ENTRADA_NO_PASSADO);
  assert.equal(conf.ancoraConferencia("entrada", { inicio: "2026-12-01", checkinAfter: null })?.toISOString(), "2026-12-02T02:59:00.000Z", "a âncora (sem a hora recusada) continua 23:59");
  // Com hora prévia 18:00 (ainda no futuro), mudar para 14:00 às 15:00 também põe a âncora no passado.
  assert.equal(R("18:00", "14:00", "2026-12-01T18:00:00Z"), j.MSG_HORA_DE_ENTRADA_NO_PASSADO);
});

test("H7. ORDEM-DUET 1284, caso 3: no dia às 15:00, gravar 18:00 → aceite; a hora exactamente agora também (igual a agora)", () => {
  assert.equal(R(null, "18:00", "2026-12-01T18:00:00Z"), null);
  assert.equal(R(null, "15:00", "2026-12-01T18:00:00Z"), null, "a âncora igual a agora é aceite");
  assert.equal(conf.prazoDaJanela("entrada", { inicio: "2026-12-01", checkinAfter: "18:00" }, null)?.toISOString(), "2026-12-03T21:00:00.000Z", "o prazo acompanha");
});

test("H8. ORDEM-DUET 1284: num dia anterior, qualquer hora → aceite", () => {
  for (const h of ["00:00", "06:00", "11:00", "23:59"]) assert.equal(R("14:00", h, "2026-11-30T18:00:00Z"), null, h);
});

test("H9. ORDEM-DUET 1284, caso 1: depois da âncora vigente → recusado com a PRIMEIRA mensagem (mesmo para uma hora futura)", () => {
  assert.equal(R("14:00", "20:00", "2026-12-01T18:00:00Z"), j.MSG_HORA_DE_ENTRADA_BLOQUEADA);
  assert.equal(R("14:00", "08:00", "2026-12-01T18:00:00Z"), j.MSG_HORA_DE_ENTRADA_BLOQUEADA);
  assert.equal(R("14:00", "14:00", "2026-12-05T12:00:00Z"), null, "a mesma hora não é mudança");
});

test("H10. ORDEM-DUET 1289 (a fuga M3): agora IGUAL à âncora vigente → bloqueado, a primeira mensagem (à hora exacta, a entrada já aconteceu)", () => {
  // 01/12 14:00 BRT = 17:00:00Z, exactamente.
  const agora = new Date("2026-12-01T17:00:00Z");
  assert.equal(j.horaDeEntradaBloqueada!({ blocos: BLOCOS, horaAtual: "14:00", horaNova: "20:00", agora }), true);
  assert.equal(R("14:00", "20:00", "2026-12-01T17:00:00Z"), j.MSG_HORA_DE_ENTRADA_BLOQUEADA);
});

test("H11. ORDEM-DUET 1289 (o minuto corrente, pela letra da regra): às 15:00:30, gravar 15:00 → a âncora fica 30 s no passado → a segunda mensagem; sem arredondamento", () => {
  assert.equal(R(null, "15:00", "2026-12-01T18:00:30Z"), j.MSG_HORA_DE_ENTRADA_NO_PASSADO);
  assert.equal(R(null, "15:00", "2026-12-01T18:00:00Z"), null, "a âncora produzida igual a agora é aceite (H7)");
});
