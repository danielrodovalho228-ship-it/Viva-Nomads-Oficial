/* Roda: node --test src/lib/e254-estadia-minima.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularTotalMensal, estadiaDoImovel, linhaEstadiaMinima, precoDoImovel } from "./precos.ts";
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

test("E254-A: mínimo de 1 mês — o cartão não mostra a linha da estadia", () => {
  assert.equal(linhaEstadiaMinima(imovel({ minPeriodDays: 30 }), 1), null);
});

test("E254-A: sem limpeza de saída — a conta não menciona limpeza", () => {
  const e = estadiaDoImovel(imovel({ checkoutCleaningEnabled: false, checkoutCleaningFee: 0 }), 3)!;
  assert.equal(e.total, 3 * 3450);
  assert.equal(e.conta, `3 × ${formatBRL(3450)}`);
  assert.doesNotMatch(e.conta, /limpeza/i);
});

test("E254-A: prévia, cartão de Meus anúncios e página pública usam a mesma função", () => {
  assert.match(ler("lib/anuncio/passo10-colunas.ts"), /estadiaDoImovel\(property, meses\)/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /estadia: linhaEstadiaMinima\(p, r\.meses\)/);
  assert.match(ler("components/property/price-card.tsx"), /estadiaDoImovel\(property, meses\)/);
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /totalPeriodo: meses > 1 \? estadiaDoImovel\(property, meses\)\?\.total : null/);
});

test("E254-A: a prévia do Passo 10 recebe os pagamentos únicos (preparação e limpeza de saída) que o cartão e a página somam", () => {
  const pg = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const bloco = pg.slice(pg.indexOf("const previewProperty = {"), pg.indexOf("} as Property;", pg.indexOf("const previewProperty = {")));
  for (const campo of ["prepFee,", "minPeriodDays: Number(minPeriod) || 30", "checkoutCleaningEnabled: limpezaSaida.ativa", "checkoutCleaningFee: limpezaSaida.valor"]) assert.ok(bloco.includes(campo), campo);
});
