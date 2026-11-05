/*
  E572 — filtro "Preço justo" na busca: o morador vai direto aos imóveis com o selo. Lógica da Pista B, atrás da MESMA
  chave desligada do selo (PRECO_JUSTO_COMPARADOR, família E399-C); a apresentação no painel de filtros é da Pista A.
  Par do E572: o indicador interno (admin) de % de imóveis com link de outra plataforma que têm o selo.
  Roda: node --test src/lib/busca/e572-filtro-preco-justo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, filtroPrecoJustoLigado, passaNoPainel, passaPrecoJusto, resumoFiltros } from "./painel-filtros.ts";
import { indicadorPrecoJusto } from "../comparador-airbnb/comparacao.ts";
import { PRECO_JUSTO_COMPARADOR } from "../flags.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const base = { id: "a", monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false } as unknown as Parameters<typeof passaNoPainel>[0];
const comSelo = { ...base, precoJusto: true };
const semSelo = { ...base, precoJusto: false };
const FILTRO = { ...FILTROS_PAINEL_VAZIOS, precoJustoOnly: true };

test("chave LIGADA: o filtro só deixa passar quem tem o selo; sem dado de selo não passa", () => {
  assert.equal(filtroPrecoJustoLigado(FILTRO, true), true);
  assert.equal(passaPrecoJusto(comSelo, FILTRO, true), true);
  assert.equal(passaPrecoJusto(semSelo, FILTRO, true), false);
  assert.equal(passaPrecoJusto(base, FILTRO, true), false);
  // Filtro não escolhido: ninguém sai, com ou sem selo.
  assert.equal(passaPrecoJusto(semSelo, FILTROS_PAINEL_VAZIOS, true), true);
});

test("chave DESLIGADA: o filtro não tira ninguém, não conta e não aparece no resumo", () => {
  assert.equal(filtroPrecoJustoLigado(FILTRO, false), false);
  assert.equal(passaPrecoJusto(semSelo, FILTRO, false), true);
  assert.equal(passaPrecoJusto(base, FILTRO, false), true);
});

test("a chave segue DESLIGADA no ambiente: passaNoPainel, contagem e resumo ignoram o filtro", () => {
  assert.equal(PRECO_JUSTO_COMPARADOR, false);
  assert.equal(passaNoPainel(semSelo, FILTRO), true);
  assert.equal(contarFiltrosPainel(FILTRO), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS));
  assert.doesNotMatch(resumoFiltros(FILTRO), /Preço justo/);
  assert.match(ler("src/lib/flags.ts"), /export const PRECO_JUSTO_COMPARADOR = process\.env\.NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR === "on";/);
});

test("painel: o filtro passa pela regra única (passaNoPainel), conta 1 e entra no resumo quando a chave liga", () => {
  const src = ler("src/lib/busca/painel-filtros.ts");
  assert.match(src, /if \(!passaPrecoJusto\(p, f\)\) return false;/);
  assert.match(src, /\(filtroPrecoJustoLigado\(f\) \? 1 : 0\)/);
  assert.match(src, /if \(filtroPrecoJustoLigado\(f\)\) partes\.push\("Preço justo"\);/);
});

test("busca: a URL ?precojusto=1 só vale com a chave; Limpar zera; a lista e a contagem usam o mesmo filtro", () => {
  const busca = ler("src/app/(public)/buscar/search-client.tsx");
  assert.match(busca, /if \(PRECO_JUSTO_COMPARADOR && on\("precojusto"\)\) setPrecoJustoOnly\(true\);/);
  assert.match(busca, /put\("precojusto", PRECO_JUSTO_COMPARADOR && precoJustoOnly, "1"\);/);
  assert.match(busca, /negociaOnly,\n\s+precoJustoOnly,/);
  assert.match(busca, /setPrecoJustoOnly\(PRECO_JUSTO_COMPARADOR && \(f\.precoJustoOnly \?\? false\)\);/);
  assert.ok((busca.match(/setPrecoJustoOnly\(false\)/g) ?? []).length >= 2, "os dois 'Limpar' zeram o filtro");
  // A lista da /buscar já traz o selo calculado no servidor (motor E399-C com a chave).
  assert.match(ler("src/lib/data/properties.ts"), /p\.precoJusto = decidirSelo\(entrada, agora\)\.selo;/);
});

test("indicador do admin: % dos imóveis com link que têm o selo (pelo motor decidirSelo)", () => {
  const agora = new Date("2026-11-05T12:00:00Z");
  const ontem = "2026-11-04T12:00:00Z";
  const justo = { totalViva: 3000, total30: 4000, consultadoEm: ontem, conferencia: "confere" as const };
  const acima = { totalViva: 4500, total30: 4000, consultadoEm: ontem, conferencia: "confere" as const };
  const diverge = { totalViva: 3000, total30: 4000, consultadoEm: ontem, conferencia: "diverge" as const };
  const velho = { totalViva: 3000, total30: 4000, consultadoEm: "2026-09-01T12:00:00Z", conferencia: "confere" as const };
  assert.deepEqual(indicadorPrecoJusto([justo, acima, diverge, velho], agora), { comLink: 4, comSelo: 1, pct: 25 });
  assert.deepEqual(indicadorPrecoJusto([justo, justo, acima], agora), { comLink: 3, comSelo: 2, pct: 66.7 });
  assert.deepEqual(indicadorPrecoJusto([], agora), { comLink: 0, comSelo: 0, pct: null });
});

test("indicador do admin: atrás da chave, só imóveis ativos, contas de teste fora, no painel de Qualidade", () => {
  const srv = ler("src/lib/comparador-airbnb/comparacao-servidor.ts");
  const fn = srv.slice(srv.indexOf("export async function indicadorPrecoJustoAdmin"));
  assert.match(fn, /if \(!PRECO_JUSTO_COMPARADOR\) return "desligado";/);
  assert.match(fn, /\.eq\("properties\.status", "active"\)/);
  assert.match(fn, /!teste\.has\(r\.properties\.owner_id\)/);
  assert.doesNotMatch(fn, /airbnb_id/);
  const pagina = ler("src/app/(dashboard)/admin/qualidade/page.tsx");
  assert.match(pagina, /indicadorPrecoJustoDoPainel\(\)\.catch\(\(\) => null\)/);
  assert.match(pagina, /data-testid="qualidade-preco-justo"/);
  assert.match(pagina, /Chave do Preço justo desligada: nada é lido\./);
});
