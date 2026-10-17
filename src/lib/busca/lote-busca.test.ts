/*
  Lote busca (ordem 826719b1): filtro, ordem e pino pelo total do mês; limpar zera a descrição;
  coração fora do link do cartão.
  Roda: node --test src/lib/busca/lote-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, passaNoPainel, precoDeBusca } from "./painel-filtros.ts";
import { calcularTotalMensal } from "../precos.ts";
import type { Property } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const base = { bedrooms: 1, tagHomeOffice: false };

test("D1: 'Até R$ 2.500' não inclui anúncio de total maior que 2.500", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, maxPrice: 2500 };
  assert.equal(passaNoPainel({ ...base, monthlyPrice: 2500, totalMes: 3020 }, f), false);
  assert.equal(passaNoPainel({ ...base, monthlyPrice: 2500, totalMes: 2500 }, f), true);
  // Sem total (alerta de busca salva, dados antigos): vale o valor mensal.
  assert.equal(passaNoPainel({ ...base, monthlyPrice: 2400 }, f), true);
});

test("D1: precoDeBusca devolve o total do mês e cai no mensal sem ele", () => {
  assert.equal(precoDeBusca({ monthlyPrice: 2500, totalMes: 3020 }), 3020);
  assert.equal(precoDeBusca({ monthlyPrice: 2500 }), 2500);
  assert.equal(precoDeBusca({ monthlyPrice: 2500, totalMes: 0 }), 2500);
});

test("D1: o total anotado na busca é o mesmo do cartão (calcularTotalMensal)", () => {
  const p = { monthlyPrice: 2500, condoFee: 520, utilitiesMode: "real" } as unknown as Property;
  const total = calcularTotalMensal(p).total;
  assert.ok(total >= 2500);
  const cli = ler("app/(public)/buscar/search-client.tsx");
  assert.match(cli, /comTotalMes\(p\)/);
  assert.match(cli, /precoDeBusca\(a\) - precoDeBusca\(b\)/);
  assert.match(cli, /precoDeBusca\(b\) - precoDeBusca\(a\)/);
});

test("D1: o pino e o cartão do mapa mostram o total", () => {
  assert.match(ler("components/search-map.tsx"), /formatBRL\(precoDeBusca\(p\)\)/);
  assert.match(ler("components/busca/card-pin-mapa.tsx"), /formatBRL\(precoDeBusca\(p\)\)/);
});

test("D5: Limpar filtros remonta a busca por descrição (campo e chips)", () => {
  const cli = ler("app/(public)/buscar/search-client.tsx");
  assert.match(cli, /<DescricaoBusca key=\{reinicioDescricao\}/);
  assert.match(cli, /function clearFilters\(\) \{\s*setReinicioDescricao/);
});

test("D12: o coração fica fora do <a> do cartão", () => {
  const card = ler("components/property-card.tsx");
  const link = card.slice(card.indexOf("<Link"), card.indexOf("</Link>"));
  assert.doesNotMatch(link, /FavoriteButton/);
  assert.match(card.slice(card.indexOf("</Link>")), /<FavoriteButton/);
});

test("D1 (achado do Moacir no #702): os dois pinos do mapa (Mapbox e Leaflet) mostram o total do mês", () => {
  const mapa = ler("components/search-map.tsx");
  assert.doesNotMatch(mapa, /formatBRL\(p\.monthlyPrice\)/);
  assert.equal((mapa.match(/formatBRL\(precoDeBusca\(p\)\)/g) ?? []).length, 2);
});

test("#544b148a: a home conta os atalhos pelo total do mês", () => {
  assert.match(ler("components/home/atalhos-categoria.tsx"), /imoveis\.map\(\(p\) => comTotalMes\(p\)\)/);
});

test("#544b148a: respiro no fim da lista com itens no comparador", () => {
  const cli = ler("app/(public)/buscar/search-client.tsx");
  assert.match(cli, /comparar\.length > 0 && <div aria-hidden="true" data-testid="comparar-respiro"/);
});

test("#544b148a D1: pino = cartão para todos os imóveis de exemplo (inclui os 4 casos medidos)", async () => {
  const { SAMPLE_PROPERTIES } = await import("../properties.ts");
  const { comTotalMes, textosTotalMensal } = await import("../precos.ts");
  const { formatBRL } = await import("../utils.ts");
  const { precoDeBusca } = await import("./painel-filtros.ts");
  assert.ok(SAMPLE_PROPERTIES.length >= 15);
  for (const p of SAMPLE_PROPERTIES) {
    const pino = formatBRL(precoDeBusca(comTotalMes(p)));
    assert.ok(textosTotalMensal(p).destaque.startsWith(pino), `${p.id}: pino ${pino} × cartão ${textosTotalMensal(p).destaque}`);
  }
  // Caso negativo: sem totalMes (lista ainda não enriquecida) o pino cai no valor base, nunca em zero.
  assert.equal(precoDeBusca({ monthlyPrice: 3200 }), 3200);
  assert.equal(precoDeBusca({ monthlyPrice: 3200, totalMes: 0 }), 3200);
  const santa = SAMPLE_PROPERTIES.find((p) => p.neighborhood === "Santa Mônica");
  assert.equal(precoDeBusca(comTotalMes(santa!)), 3960);
});

test("D5: o 'Limpar filtros' do celular (<390 px) fica no bloco do celular, não na caixa que some abaixo de sm (t157)", () => {
  const src = ler("app/(public)/buscar/search-client.tsx");
  const celular = src.slice(src.indexOf('data-testid="busca-celular"'), src.indexOf('data-testid="filtros-barra"'));
  assert.match(celular, /data-testid="limpar-filtros-celular"/);
  assert.match(celular, /onClick=\{clearFilters\}/);
  assert.equal((src.match(/data-testid="limpar-filtros/g) ?? []).length, 4);
});
