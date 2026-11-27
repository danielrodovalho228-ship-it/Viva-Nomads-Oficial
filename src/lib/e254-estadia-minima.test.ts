/* Roda: node --test src/lib/e254-estadia-minima.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularTotalMensal, estadiaDoCartaoDoDono, estadiaDoImovel, linhaEstadiaMinima, precoDoImovel } from "./precos.ts";
import { precosDaPrevia } from "./anuncio/passo10-colunas.ts";
import { barraFixaImovel } from "./barra-fixa-imovel.ts";
import { formatBRL } from "./utils.ts";
import type { Property } from "./types.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const imovel = (o: Partial<Property> = {}) =>
  ({ monthlyPrice: 3000, condoFee: 450, utilitiesMode: "included", utilitiesEstimate: 0, prepFee: 0, checkoutCleaningEnabled: true, checkoutCleaningFee: 450, minPeriodDays: 90, ...o }) as unknown as Property;

test("E254-A: mínimo de 3 meses + limpeza de saída R$ 450 — o total soma a limpeza, discriminada na conta", () => {
  const p = imovel();
  const mes = precoDoImovel(p).totalPorMes;
  assert.equal(mes, 3450);
  const e = estadiaDoImovel(p, 3)!;
  assert.equal(e.total, 3 * 3450 + 450);
  assert.equal(e.conta, `3 × ${formatBRL(3450)} + limpeza de saída ${formatBRL(450)}`);
  assert.equal(linhaEstadiaMinima(p, 3), `Estadia mínima (3 meses): ${formatBRL(10800)} · ${e.conta}`);
  // A limpeza de saída nunca entra no Total/mês.
  assert.equal(calcularTotalMensal(p).total, mes);
  // Prévia do Passo 10: o mesmo total e a mesma conta.
  const previa = precosDaPrevia(p);
  assert.equal(previa[1].valor, mes);
  assert.equal(previa[2].rotulo, "Estadia mínima (3 meses)");
  assert.equal(previa[2].valor, e.total);
  assert.equal(previa[2].conta, e.conta);
  // Barra do celular da página pública: o mesmo total.
  const barra = barraFixaImovel({ monthlyPrice: 3000, totalMensal: mes, meses: 3, totalPeriodo: e.total, exemplo: false, candidatouSe: false, hoje: "2026-10-30" });
  assert.equal(barra.estadia, `${formatBRL(10800)} em 3 meses`);
});

// E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): com mínimo de 1 mês a linha do dono não tinha total ("o total é o do mês"), e a prévia do Passo 10 somava as limpezas
// (R$ 4.660 no ube-001 contra R$ 3.960). Agora a linha de 1 mês tem o total e a conta da regra única, como a prévia.
test("E254-A/E756: mínimo de 1 mês — a linha tem o total e a conta da regra única (igual à prévia do dono)", () => {
  const p = imovel({ minPeriodDays: 30 });
  const e = estadiaDoImovel(p, 1)!;
  assert.equal(linhaEstadiaMinima(p, 1), `Estadia mínima (1 mês): ${formatBRL(e.total)} · ${e.conta}`);
});

test("QA 31/10: o cartão de Meus anúncios SEMPRE diz a estadia mínima configurada; sem o campo, não inventa", () => {
  // E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): 1 mês também com total e conta (antes, só o rótulo "Estadia mínima (1 mês)").
  assert.equal(estadiaDoCartaoDoDono(imovel({ minPeriodDays: 30 }), 1), linhaEstadiaMinima(imovel({ minPeriodDays: 30 }), 1));
  assert.match(estadiaDoCartaoDoDono(imovel({ minPeriodDays: 30 }), 1)!, /^Estadia mínima \(1 mês\): /);
  // Mais de 1 mês: a linha com total e conta (a mesma do E254-A).
  assert.equal(estadiaDoCartaoDoDono(imovel({ minPeriodDays: 90 }), 3), linhaEstadiaMinima(imovel({ minPeriodDays: 90 }), 3));
  assert.match(estadiaDoCartaoDoDono(imovel({ minPeriodDays: 90 }), 3)!, /^Estadia mínima \(3 meses\): /);
  // Sem min_period_days gravado: nada.
  assert.equal(estadiaDoCartaoDoDono(imovel({ minPeriodDays: undefined }), 1), null);
  assert.equal(estadiaDoCartaoDoDono(imovel({ minPeriodDays: 0 }), 1), null);
});

test("E254-A: sem limpeza de saída — a conta não menciona limpeza", () => {
  const e = estadiaDoImovel(imovel({ checkoutCleaningEnabled: false, checkoutCleaningFee: 0 }), 3)!;
  assert.equal(e.total, 3 * 3450);
  assert.equal(e.conta, `3 × ${formatBRL(3450)}`);
  assert.doesNotMatch(e.conta, /limpeza/i);
});

test("E254-A: prévia, cartão de Meus anúncios e página pública usam a mesma função", () => {
  assert.match(ler("lib/anuncio/passo10-colunas.ts"), /estadiaDoImovel\(property, meses\)/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /estadia: estadiaDoCartaoDoDono\(p, r\.meses\)/);
  assert.match(ler("components/property/price-card.tsx"), /estadiaDoImovel\(property, Math\.max\(1, meses\)\)/);
  // E562 (telas): com as datas escolhidas, o total vem em dias (estadiaDoImovelEmDias); sem datas, a mesma função em meses.
  // E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): sem datas, o total da regra única também com 1 mês (antes: só com N > 1).
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /totalPeriodo: estadiaSelecao \? estadiaSelecao\.total : estadiaDoImovel\(property, Math\.max\(1, meses\)\)\?\.total \?\? null/);
});

test("E254-A: a prévia do Passo 10 recebe os pagamentos únicos (preparação e limpeza de saída) que o cartão e a página somam", () => {
  const pg = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const bloco = pg.slice(pg.indexOf("const previewProperty = {"), pg.indexOf("} as Property;", pg.indexOf("const previewProperty = {")));
  for (const campo of ["prepFee,", "minPeriodDays: Number(minPeriod) || 30", "checkoutCleaningEnabled: limpezaSaida.ativa", "checkoutCleaningFee: limpezaSaida.valor"]) assert.ok(bloco.includes(campo), campo);
});
