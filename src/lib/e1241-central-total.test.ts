/*
  E1241 (ORDENS-DUET 1213, 1227, 1233 e 1237) — a linha de cada pagamento na página do contrato da Central usa a MESMA
  gramática das linhas de documentos (textoLinhaRecibo, decisão do coordenador em 27/11: "uma linha de registro, uma
  gramática, em toda superfície"): número · bloco · TOTAL · período. A equipe confere pelo número.
   - com documento: "REC-… · Bloco 1, registro complementar · R$ 800,00 · 20/12 a 19/01";
   - confirmado e ainda sem documento: "Recibo em preparação · Bloco 1 · R$ … · …" (a linha 5 da ORDEM-1208);
   - SEM documento e não confirmado (aguardando, ou anulado antes da confirmação — ORDEM-1237): a forma curta, sem
     número e sem "em preparação": "Bloco {n} · R$ {total} · {dd/mm} a {dd/mm}" (esse registro nunca terá recibo).
  O total é sempre o do registro (componentesDoPagamento; na caução os encargos não contam); a soma bate com os totais.
  Roda: node --test src/lib/e1241-central-total.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as provas from "./contrato-provas.ts";

type P = provas.PagamentoProva & { bloco?: { numero: number; inicio: string | null; fim: string | null } | null };
const linha = (provas as unknown as { linhaPagamentoCentral: (p: P) => string }).linhaPagamentoCentral;
const B1 = { numero: 1, inicio: "2026-12-20", fim: "2027-01-19" };
const base = { forma: "pix", dia: "2026-12-20" };
const COMPLEMENTAR: P = { ...base, tipo: "aluguel", valor: 0, parte: 2, bloco: B1, documento: "REC-2026-000009", confirmadoEm: "2026-12-21T12:00:00Z", encargos: [{ rotulo: "Contas do período", valor: 550 }, { rotulo: "Limpeza de preparação", valor: 250 }] };
const ALUGUEL: P = { ...base, tipo: "aluguel", valor: 6400, parte: 1, bloco: B1, documento: "REC-2026-000007", confirmadoEm: "2026-12-21T12:00:00Z" };
const CAUCAO: P = { ...base, tipo: "caucao", valor: 3200, bloco: B1, documento: "CAU-2026-000004", confirmadoEm: "2026-12-21T12:00:00Z", encargos: [{ rotulo: "Contas do período", valor: 99 }] };

test("1. com documento: a gramática inteira — número · bloco (complementar) · TOTAL · período", () => {
  assert.equal(linha(COMPLEMENTAR), "REC-2026-000009 · Bloco 1, registro complementar · R$ 800,00 · 20/12 a 19/01");
  assert.equal(linha(ALUGUEL), "REC-2026-000007 · Bloco 1 · R$ 6.400,00 · 20/12 a 19/01");
  assert.equal(linha(CAUCAO), "CAU-2026-000004 · Caução do bloco 1 · R$ 3.200,00", "caução: sem período, sem encargos");
});

test("2. confirmado sem documento: 'Recibo em preparação' no lugar do número", () => {
  assert.equal(linha({ ...ALUGUEL, documento: null }), "Recibo em preparação · Bloco 1 · R$ 6.400,00 · 20/12 a 19/01");
});

test("3. sem documento e não confirmado (aguardando ou anulado antes da confirmação): a forma curta (ORDEM-DUET 1237)", () => {
  const anulado: P = { ...ALUGUEL, documento: null, confirmadoEm: null, anuladoEm: "2026-12-22T10:00:00Z", anuladoMotivo: "registro em duplicidade" };
  assert.equal(linha(anulado), "Bloco 1 · R$ 6.400,00 · 20/12 a 19/01");
  assert.equal(linha({ ...ALUGUEL, documento: null, confirmadoEm: null }), "Bloco 1 · R$ 6.400,00 · 20/12 a 19/01");
  assert.doesNotMatch(linha(anulado), /Recibo em preparação|REC-/);
});

test("4. a soma das linhas (dos não anulados) bate com os totais da página", () => {
  const pags = [COMPLEMENTAR, ALUGUEL];
  const t = provas.totaisPagamentos(pags);
  const soma = pags.reduce((s, p) => s + provas.componentesDoTotal(p), 0);
  assert.equal(Math.round(soma * 100) / 100, Math.round((t.confirmado + t.aguardando) * 100) / 100);
});

test("5. o pacote lê o bloco de cada registro; a página da Central usa a linha", () => {
  assert.match(provas.COLUNAS_PROVAS.pagamentos, /contrato_blocos\(numero_bloco, inicio, fim\)/);
  const pagina = readFileSync(new URL("../app/(dashboard)/admin/contratos/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /\{linhaPagamentoCentral\(p\)\} —/);
  assert.doesNotMatch(pagina, /fmtReais\(p\.valor\)|linhaPagamentoCentral\(p\)\.rotulo/);
});
