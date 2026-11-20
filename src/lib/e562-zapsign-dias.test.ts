/*
  E562 (Relay 67) — modelo do contrato na ZapSign no prazo em DIAS. A proposta guarda os dias e o contrato registrado
  usa prazo_total_dias (a taxa também, #2729), mas /api/contrato mandava à ZapSign só termMonths (meses do navegador):
  uma estadia de 43 dias ia como "2 meses". Agora a rota lê os dias da proposta aceita no servidor (a MESMA fonte de
  registrarContrato); sem proposta, meses × 30. A ZapSign recebe os dias, o texto por extenso e os meses DERIVADOS dos
  dias (mesesDeReferencia, para cima).
  Roda: node --test src/lib/e562-zapsign-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prazoDoContratoEmDias } from "./contrato-prazo-dias.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("proposta de 43 dias: dias 43, '1 mês + 13 dias', meses derivados 2 (os meses do navegador não valem)", () => {
  assert.deepEqual(prazoDoContratoEmDias({ diasAcordados: 43, mesesDoFechamento: 1 }), { dias: 43, meses: 2, texto: "1 mês + 13 dias" });
});

test("sem proposta: os meses do Fechamento × 30; meses cheios ficam iguais", () => {
  assert.deepEqual(prazoDoContratoEmDias({ diasAcordados: null, mesesDoFechamento: 3 }), { dias: 90, meses: 3, texto: "3 meses" });
  assert.deepEqual(prazoDoContratoEmDias({ diasAcordados: 60, mesesDoFechamento: 9 }), { dias: 60, meses: 2, texto: "2 meses" });
});

test("rota e integração: dias da proposta aceita no servidor; a ZapSign recebe dias, texto e meses derivados", () => {
  const r = ler("app/api/contrato/route.ts");
  assert.match(r, /propostaAcordadaDoLead\(admin, f\.leadId\)/);
  assert.match(r, /prazoDoContratoEmDias\(\{ diasAcordados: acordada \? acordada\.dias : diasJanela, mesesDoFechamento: prazo \}\)/);
  assert.match(r, /termDays: periodo\.dias/);
  assert.match(r, /termMonths: periodo\.meses/);
  const z = ler("lib/integrations/zapsign.ts");
  assert.match(z, /term_days: input\.termDays/);
  assert.match(z, /term_text: input\.termText/);
  assert.match(z, /term: input\.termMonths/);
});
