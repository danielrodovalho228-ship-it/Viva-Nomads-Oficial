/*
  E1241 (ORDENS-DUET 1213 e 1227; MAPA-E1241, secção 2) — a linha de cada pagamento na página do contrato da Central
  lê o TOTAL do registro (componentesDoPagamento), não a coluna valor: o registro complementar de R$ 800 (valor do bloco
  zero, tudo em encargos) dizia "Valor mensal de R$ 0". Passa a dizer "Registro complementar de R$ 800,00", como o pacote
  de provas já escreve; o aluguel simples e a caução ficam como hoje; a soma das linhas bate com os totais da página.
  Roda: node --test src/lib/e1241-central-total.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as provas from "./contrato-provas.ts";

type Fn = (p: provas.PagamentoProva) => { rotulo: string; total: number };
const linhaPagamentoCentral = (provas as unknown as { linhaPagamentoCentral?: Fn }).linhaPagamentoCentral;
const base = { forma: "pix", dia: "2026-12-20", confirmadoEm: "2026-12-21T12:00:00Z" };
const COMPLEMENTAR: provas.PagamentoProva = { ...base, tipo: "aluguel", valor: 0, parte: 2, encargos: [{ rotulo: "Contas do período", valor: 550 }, { rotulo: "Limpeza de preparação", valor: 250 }] };
const ALUGUEL: provas.PagamentoProva = { ...base, tipo: "aluguel", valor: 6400, parte: 1 };
const CAUCAO: provas.PagamentoProva = { ...base, tipo: "caucao", valor: 3200, encargos: [{ rotulo: "Contas do período", valor: 99 }] };

test("1. o registro complementar: 'Registro complementar' e o TOTAL (R$ 800), nunca R$ 0", () => {
  assert.equal(typeof linhaPagamentoCentral, "function", "contrato-provas exporta linhaPagamentoCentral");
  assert.deepEqual(linhaPagamentoCentral!(COMPLEMENTAR), { rotulo: "Registro complementar", total: 800 });
});

test("2. guarda: o aluguel simples e a caução como hoje (na caução os encargos não contam)", () => {
  assert.deepEqual(linhaPagamentoCentral!(ALUGUEL), { rotulo: "Valor mensal", total: 6400 });
  assert.deepEqual(linhaPagamentoCentral!(CAUCAO), { rotulo: "Caução", total: 3200 });
});

test("3. a soma das linhas (dos não anulados) bate com os totais da página", () => {
  const pags = [COMPLEMENTAR, ALUGUEL, { ...ALUGUEL, confirmadoEm: null, valor: 3200 }];
  const t = provas.totaisPagamentos(pags);
  const soma = pags.reduce((s, p) => s + linhaPagamentoCentral!(p).total, 0);
  assert.equal(Math.round(soma * 100) / 100, Math.round((t.confirmado + t.aguardando) * 100) / 100);
});

test("4. a página da Central usa a linha (sem a coluna valor crua)", () => {
  const pagina = readFileSync(new URL("../app/(dashboard)/admin/contratos/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /linhaPagamentoCentral\(p\)/);
  assert.doesNotMatch(pagina, /\{p\.tipo === "caucao" \? "Caução" : "Valor mensal"\} de \{fmtReais\(p\.valor\)\}/);
});
