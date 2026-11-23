/*
  E1114 (ORDEM-DUET-503) — a ocupação "hoje" do pedido de avaliação era decidida pelo dia em UTC: entre as 21:00 e as
  24:00 de Brasília o UTC já está no dia seguinte, e no último dia do bloco o morador deixava de contar como ocupante
  (a visita abria sem a concordância dele). O "hoje" passa a sair da fonte única do dia de Brasília (hojeEmBrasilia, por cima
  do diaBRT — conversão de fuso de verdade, não −3 h fixas).
  Roda: node --test src/lib/vistoria/e1114-ocupacao-hoje-em-brasilia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diaBRT, hojeEmBrasilia } from "../datas-brasilia.ts";
import { ocupanteNoDia } from "./ocupacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
/** O que o código fazia: o dia em UTC. */
const diaUTC = (d: Date) => d.toISOString().slice(0, 10);
const morador = { tenant_id: "morador-1", contrato_blocos: [{ inicio: "2026-11-01", fim: "2026-11-30", status: "aceito" as string | null }] };

test("E1114: hojeEmBrasilia é o dia de Brasília — das 21:00 às 24:00 o UTC já virou e Brasília não", () => {
  const as2130 = new Date("2026-11-30T21:30:00-03:00");
  assert.equal(diaUTC(as2130), "2026-12-01", "o dia em UTC já é o seguinte");
  assert.equal(hojeEmBrasilia(as2130), "2026-11-30");
  assert.equal(hojeEmBrasilia(new Date("2026-11-30T21:00:00-03:00")), "2026-11-30", "às 21:00 em ponto");
  assert.equal(hojeEmBrasilia(new Date("2026-11-30T23:59:59-03:00")), "2026-11-30", "até ao último segundo do dia");
  assert.equal(hojeEmBrasilia(new Date("2026-12-01T00:00:00-03:00")), "2026-12-01", "à meia-noite de Brasília vira");
  assert.equal(hojeEmBrasilia(new Date("2026-11-30T12:00:00-03:00")), "2026-11-30", "de dia, igual ao UTC");
  // É a mesma conversão do diaBRT (a fonte que sobrevive), e sem argumento é o agora.
  assert.equal(hojeEmBrasilia(as2130), diaBRT(as2130));
  assert.equal(hojeEmBrasilia(), diaBRT(new Date()));
});

test("E1114: no último dia do bloco, às 21:30 de Brasília, o morador ainda é o ocupante", () => {
  const as2130 = new Date("2026-11-30T21:30:00-03:00");
  assert.equal(ocupanteNoDia([morador], hojeEmBrasilia(as2130))?.tenant_id, "morador-1");
  // Com o dia em UTC (o defeito), o mesmo instante dava "ninguém mora aqui".
  assert.equal(ocupanteNoDia([morador], diaUTC(as2130)), undefined);
  // No dia seguinte de Brasília, o bloco acabou.
  assert.equal(ocupanteNoDia([morador], hojeEmBrasilia(new Date("2026-12-01T00:30:00-03:00"))), undefined);
});

test("E1114: na véspera da entrada, às 22:00 de Brasília, o futuro morador ainda NÃO é o ocupante", () => {
  const vespera = new Date("2026-10-31T22:00:00-03:00");
  assert.equal(diaUTC(vespera), "2026-11-01", "em UTC já é o dia da entrada");
  assert.equal(ocupanteNoDia([morador], hojeEmBrasilia(vespera)), undefined);
  // No dia da entrada conta, desde a meia-noite de Brasília.
  assert.equal(ocupanteNoDia([morador], hojeEmBrasilia(new Date("2026-11-01T00:10:00-03:00")))?.tenant_id, "morador-1");
});

test("E1114: a regra da ocupação não mudou — bloco não aceito não conta; sem blocos, ninguém; o primeiro contrato que cobre o dia", () => {
  const hoje = "2026-11-15";
  assert.equal(ocupanteNoDia([{ tenant_id: "x", contrato_blocos: [{ inicio: "2026-11-01", fim: "2026-11-30", status: "nao_aceito" }] }], hoje), undefined);
  assert.equal(ocupanteNoDia([{ tenant_id: "x", contrato_blocos: null }], hoje), undefined);
  assert.equal(ocupanteNoDia([], hoje), undefined);
  assert.equal(ocupanteNoDia([{ tenant_id: "x", contrato_blocos: [{ inicio: "2026-11-01", fim: "2026-11-30", status: null }] }], hoje)?.tenant_id, "x", "bloco sem estado conta");
  const dois = [
    { tenant_id: "antes", contrato_blocos: [{ inicio: "2026-09-01", fim: "2026-10-31", status: "aceito" }] },
    { tenant_id: "agora", contrato_blocos: [{ inicio: "2026-11-01", fim: "2026-11-30", status: "aceito" }, { inicio: "2026-12-01", fim: "2026-12-31", status: "nao_aceito" }] },
  ];
  assert.equal(ocupanteNoDia(dois, hoje)?.tenant_id, "agora");
});

test("E1114: o pedido de avaliação lê o hoje da fonte única e decide a ocupação pela função", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes, /const hoje = hojeEmBrasilia\(agora\);/);
  assert.match(acoes, /const ocupante = ocupanteNoDia\(/);
  assert.doesNotMatch(acoes, /toISOString\(\)\.slice\(0, 10\)/, "nenhum dia em UTC nas ações da avaliação");
  // A fonte única mora ao lado do diaBRT e é feita dele (não de −3 h fixas).
  const fonte = ler("src/lib/datas-brasilia.ts");
  assert.match(fonte, /export function hojeEmBrasilia\(agora: Date = new Date\(\)\): string \{\s*const d = diaBRT\(agora\);/);
  assert.doesNotMatch(fonte, /3 \* 3600_000|3 \* 3_600_000/);
});
