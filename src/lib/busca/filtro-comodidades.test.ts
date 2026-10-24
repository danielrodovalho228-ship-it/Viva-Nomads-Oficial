/*
  Filtros de estadia longa na /buscar (ordem 583d2e71): Wi-Fi, cozinha equipada,
  garagem e máquina de lavar. Imóvel sem a informação NÃO aparece no filtro.
  Roda: node --test src/lib/busca/filtro-comodidades.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMODIDADES_FILTRO, chavesFiltroDe, comodidadesDaUrl, passaComodidades, temComodidade } from "./filtro-comodidades.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros } from "./painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const imovel = (o: Record<string, unknown> = {}) => ({
  monthlyPrice: 3000, bedrooms: 2, tagHomeOffice: false, amenities: [] as string[], ...o,
});

test("o catálogo tem exatamente os 4 filtros pedidos", () => {
  assert.deepEqual(COMODIDADES_FILTRO.map((c) => c.chave), ["wifi", "cozinha", "garagem", "lavar"]);
});

test("rótulos gravados viram chaves de filtro (Internet fibra = Wi-Fi)", () => {
  assert.deepEqual(
    chavesFiltroDe(["Internet fibra de alta velocidade", "Cozinha equipada", "Vaga de garagem", "Máquina de lavar", "Piscina"]).sort(),
    ["cozinha", "garagem", "lavar", "wifi"]
  );
  assert.deepEqual(chavesFiltroDe(["Piscina"]), []);
});

test("sem a informação o imóvel NÃO passa; com ela passa", () => {
  assert.equal(temComodidade(imovel(), "wifi"), false);
  assert.equal(temComodidade(imovel({ amenities: ["Internet fibra de alta velocidade"] }), "wifi"), true);
  assert.equal(temComodidade(imovel({ comodidadesFiltro: ["lavar"] }), "lavar"), true);
  assert.equal(temComodidade(imovel({ comodidadesFiltro: ["lavar"] }), "cozinha"), false);
});

test("garagem: vaga cadastrada no imóvel também vale; 0 vagas não", () => {
  assert.equal(temComodidade(imovel({ parkingSpots: 1 }), "garagem"), true);
  assert.equal(temComodidade(imovel({ parkingSpots: 0 }), "garagem"), false);
});

test("dois filtros combinados: precisa ter os dois (E, não OU)", () => {
  const so1 = imovel({ comodidadesFiltro: ["wifi"] });
  const ambos = imovel({ comodidadesFiltro: ["wifi", "garagem"] });
  assert.equal(passaComodidades(so1, ["wifi", "garagem"]), false);
  assert.equal(passaComodidades(ambos, ["wifi", "garagem"]), true);
  assert.equal(passaComodidades(so1, []), true);
});

test("URL: lê só chaves conhecidas, sem repetir; lixo é ignorado", () => {
  // FILTROS-2: wifi/cozinha de links antigos são garantia do mínimo, não filtro — ignoradas.
  assert.deepEqual(comodidadesDaUrl("wifi,garagem,garagem,<script>,x,cozinha,lavar"), ["garagem", "lavar"]);
  assert.deepEqual(comodidadesDaUrl(null), []);
  assert.deepEqual(comodidadesDaUrl(""), []);
});

test("painel: entra na contagem, no resumo e no filtro (caso negativo incluso)", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, comodidades: ["wifi" as const, "lavar" as const] };
  assert.equal(contarFiltrosPainel(f), 2);
  assert.match(resumoFiltros(f), /Wi-Fi/);
  assert.match(resumoFiltros(f), /Máquina de lavar/);
  assert.equal(passaNoPainel(imovel({ comodidadesFiltro: ["wifi"] }), f), false);
  assert.equal(passaNoPainel(imovel({ comodidadesFiltro: ["wifi", "lavar"] }), f), true);
  assert.equal(contarFiltrosPainel(FILTROS_PAINEL_VAZIOS), 0);
});

test("a lista (/buscar) carrega só as 4 comodidades filtráveis, numa consulta só (sem N+1)", () => {
  const dados = ler("lib/data/properties.ts");
  assert.match(dados, /attachComodidadesFiltro\(supabase, mapped\)/);
  assert.match(dados, /\.from\("property_amenities"\)[\s\S]{0,200}\.in\("property_id"/);
  const tela = ler("app/(public)/buscar/search-client.tsx");
  assert.match(tela, /comodidadesDaUrl\(sp\.get\("comod"\)\)/);
  assert.match(tela, /put\("comod"/);
  const painel = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(painel, /COMODIDADES_FILTRAVEIS/);
});
