/*
  E725 (Phoenix, RELATORIO-002, A4): com 29 noites o cartão mostrava o total (R$ 3.731,67) junto ao aviso "Estadia mínima de
  30 dias". Estadia inválida não se precifica: abaixo do mínimo só o aviso. Roda: node --test src/lib/e725-estadia-abaixo-do-minimo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abaixoDaEstadiaMinima, estadiaMinimaDias, validarReserva } from "./availability.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("29 noites com mínimo de 30 é abaixo do mínimo; 30 não é; sem duração não há aviso", () => {
  assert.equal(abaixoDaEstadiaMinima(29, 30), true);
  assert.equal(abaixoDaEstadiaMinima(30, 30), false);
  assert.equal(abaixoDaEstadiaMinima(45, 30), false);
  assert.equal(abaixoDaEstadiaMinima(null, 30), false);
  assert.equal(abaixoDaEstadiaMinima(0, 30), false);
  // Mínimo do anúncio maior que 30: vale o do anúncio. Sem mínimo no cadastro, vale o padrão de 30.
  assert.equal(abaixoDaEstadiaMinima(40, 60), true);
  assert.equal(estadiaMinimaDias(null), 30);
  assert.equal(estadiaMinimaDias(60), 60);
  assert.equal(abaixoDaEstadiaMinima(29, null), true);
});

test("o aviso da reserva e o corte do total usam o mesmo mínimo (uma fonte só)", () => {
  const r = validarReserva({ checkIn: "2026-12-01", checkOut: "2026-12-30", fromISO: "2026-11-01", minDias: 30 } as Parameters<typeof validarReserva>[0]);
  assert.equal(r.ok, false);
  assert.equal(r.dias, 29);
  assert.match(r.motivo ?? "", /Estadia mínima de 30 dias/);
  assert.equal(abaixoDaEstadiaMinima(r.dias, 30), true);
});

test("a página do imóvel não precifica abaixo do mínimo: cartão, barra do celular e resumo recebem 'sem duração'", () => {
  const pg = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(pg, /const abaixoDoMinimo = abaixoDaEstadiaMinima\(diasEscolhidos, property\.minPeriodDays\)/);
  assert.match(pg, /const diasSelecao = abaixoDoMinimo \? null : diasEscolhidos/);
  assert.match(pg, /<PriceCard [^>]*dias=\{diasSelecao\} estadiaMinimaAviso=\{abaixoDoMinimo \? estadiaMinimaDias\(property\.minPeriodDays\) : null\}/);
  // O total da estadia vem só de diasSelecao (já nulo abaixo do mínimo).
  assert.match(pg, /const estadiaSelecao = diasSelecao \? estadiaDoImovelEmDias\(property, diasSelecao\) : null/);
});

test("o cartão mostra só o aviso quando abaixo do mínimo", () => {
  const c = ler("src/components/property/price-card.tsx");
  assert.match(c, /estadiaMinimaAviso != null && \(\s*<p [^>]*data-testid="cartao-lateral-estadia-minima"[^>]*>\s*Estadia mínima de \{estadiaMinimaAviso\} dias\./);
});
