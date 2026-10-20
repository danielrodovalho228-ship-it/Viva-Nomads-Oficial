/*
  Guarda do padrão visual (Prompt 40, Estudo 1 — fundação visual).
  Nas telas do alcance (tokens, botões/chips/folha, cartão de anúncio e o esqueleto
  dele, busca, home, favoritos, cidades e "imóveis parecidos"):
    - nenhum shadow-* fora do flutuante;
    - nenhum raio fora de 8 / 12 / full;
    - nenhum espaço fora da escala de 4 (meio passo ou arbitrário);
    - nenhum font-bold / font-extrabold / font-black.
  O resto do app entra nos Prompts 41–43 (a contagem do que falta sai no relatório
  do PR, por pasta). Ao levar uma tela para o padrão, acrescente-a em ALCANCE.
  Roda: node --test src/lib/estilo/estilo-padrao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { espacoPermitido, violacoesEstilo } from "./regras-estilo.ts";
import {
  FILTROS_PAINEL_VAZIOS,
  OPCOES_ESTADIA,
  OPCOES_PORTE_PET,
  OPCOES_PRECO,
  OPCOES_QUARTOS,
  OPCOES_TIPO,
  contarFiltrosPainel,
  passaNoPainel,
  rotuloMostrar,
  type FiltrosPainel,
} from "../busca/painel-filtros.ts";
import { COMODIDADES_FILTRO } from "../busca/filtro-comodidades.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { comTotalMes } from "../precos.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

/** Arquivos e pastas cobertos pela guarda (caminhos a partir de src/). */
export const ALCANCE = [
  // Tokens
  "app/globals.css",
  // Botões, chips, folha, selos, esqueleto…
  "components/ui",
  // Cartão de anúncio (o mesmo em todas as telas) e o que ele mostra por cima da foto
  "components/property-card.tsx",
  "components/favorite-button.tsx",
  "components/property/marca-imovel.tsx",
  // Busca (/buscar e a da home)
  "app/(public)/buscar",
  "components/busca",
  "components/location-search.tsx",
  "components/city-autocomplete.tsx",
  "components/home",
  // Home, favoritos, cidades e imóveis parecidos
  "app/(public)/page.tsx",
  "app/(public)/favoritos",
  "components/favoritos-lista.tsx",
  "app/(dashboard)/dashboard/favoritos",
  "app/(public)/cidades/[cidade]/page.tsx",
  "components/property/imoveis-parecidos.tsx",
];

function arquivos(alvo: string, out: string[] = []): string[] {
  const p = join(SRC, alvo);
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) arquivos(join(alvo, f), out);
  } else if (/\.(tsx|css)$/.test(p) || (p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    out.push(alvo);
  }
  return out;
}

test("as regras pegam o que devem e deixam passar o padrão", () => {
  const tipos = (s: string) => violacoesEstilo(`<div className="${s}" />`).map((v) => `${v.tipo}:${v.classe}`);
  assert.deepEqual(tipos("shadow-sm hover:shadow-md shadow-[0_8px_24px_rgba(0,0,0,.2)]"), [
    "sombra:shadow-sm",
    "sombra:shadow-md",
    "sombra:shadow-[0_8px_24px_rgba(0,0,0,.2)]",
  ]);
  assert.deepEqual(tipos("shadow-flutuante shadow-none"), []);
  assert.deepEqual(tipos("rounded rounded-md rounded-2xl rounded-t-3xl lg:rounded-[18px]"), [
    "raio:rounded",
    "raio:rounded-md",
    "raio:rounded-2xl",
    "raio:rounded-t-3xl",
    "raio:rounded-[18px]",
  ]);
  assert.deepEqual(tipos("rounded-lg rounded-xl rounded-full rounded-none rounded-t-xl rounded-control rounded-media sm:rounded-xl"), []);
  assert.deepEqual(tipos("p-[13px] gap-1.5 py-0.5 mt-2.5 -mx-[6px]"), [
    "espaco:p-[13px]",
    "espaco:gap-1.5",
    "espaco:py-0.5",
    "espaco:mt-2.5",
    "espaco:-mx-[6px]",
  ]);
  assert.deepEqual(tipos("p-4 gap-2 mx-auto px-[12px] pb-[max(0.75rem,env(safe-area-inset-bottom))] mt-px -mt-4"), []);
  assert.deepEqual(tipos("font-bold sm:font-extrabold font-black font-semibold font-normal"), [
    "peso:font-bold",
    "peso:font-extrabold",
    "peso:font-black",
  ]);
  assert.equal(espacoPermitido("[1.5rem]"), true); // 24 px
  assert.equal(espacoPermitido("[1.3rem]"), false); // 20,8 px
});

test("telas do alcance: sem sombra, raio, espaço ou peso fora do padrão", () => {
  const achados: string[] = [];
  for (const alvo of ALCANCE) {
    for (const f of arquivos(alvo)) {
      for (const v of violacoesEstilo(ler(f))) achados.push(`${f}:${v.linha} ${v.tipo} ${v.classe}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("tokens: uma cor de marca, neutros, três raios, uma sombra e pesos 400/600 (globals.css)", () => {
  const css = ler("app/globals.css");
  const tema = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
  assert.match(tema, /--color-forest: #1c6b3a;/);
  assert.match(tema, /--color-ink: #222222;/);
  assert.match(tema, /--color-muted: #6a6a6a;/);
  assert.match(tema, /--color-line: #dddddd;/);
  assert.match(tema, /--color-divisor: #ebebeb;/);
  assert.match(tema, /--radius-control: 8px;/);
  assert.match(tema, /--radius-media: 12px;/);
  assert.doesNotMatch(css, /--radius-card/);
  assert.match(tema, /--shadow-flutuante: [^;]+;/);
  for (const peso of ["bold", "extrabold", "black"]) assert.match(tema, new RegExp(`--font-weight-${peso}: 600;`));
  // Nenhuma sombra de CSS solto além do "none" (o popup do mapa zera a moldura do Leaflet/Mapbox).
  const sombras = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual([...new Set(sombras)], ["none"]);
});

test("sombra: shadow-flutuante só no botão flutuante (Fale com a Viva) e na barra flutuante do Comparar", () => {
  const usos: string[] = [];
  const varrer = (dir: string) => {
    for (const f of readdirSync(join(SRC, dir))) {
      const rel = join(dir, f);
      if (statSync(join(SRC, rel)).isDirectory()) varrer(rel);
      else if (/\.tsx$/.test(f) && /shadow-flutuante/.test(ler(rel))) usos.push(rel);
    }
  };
  varrer("");
  assert.deepEqual(usos.sort(), ["components/ajuda/viva-chat.tsx", "components/busca/barra-comparar.tsx", "components/ui/button.tsx"]);
});

test("cartão de anúncio: sem caixa (sem border nem shadow), foto 4:3 com raio de 12 px, ordem do Estudo 1", () => {
  const c = ler("components/property-card.tsx");
  const link = c.slice(c.indexOf("<Link"), c.indexOf(">", c.indexOf("className=", c.indexOf("<Link"))));
  assert.doesNotMatch(link, /\bborder\b|\bborder-|shadow|bg-white/, "o <Link> do cartão não é uma caixa");
  assert.doesNotMatch(c, /\bshadow\b|shadow-/);
  assert.match(c, /className="relative aspect-\[4\/3\] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto"/);
  // Ordem: foto → bairro e cidade → linha-síntese → valor mensal (o maior texto, 600).
  const ordem = ["cartao-foto", "cartao-local", "cartao-sintese", "cartao-total-mes"].map((id) => c.indexOf(`data-testid="${id}"`));
  assert.ok(ordem.every((i, k) => i > 0 && (k === 0 || i > ordem[k - 1])), `ordem ${ordem}`);
  assert.match(c, /text-\[15px\] font-semibold[^"]*sm:text-base" data-testid="cartao-local"/);
  assert.match(c, /<span className="font-title text-lg font-semibold text-forest">\{formatBRL\(inc\.total\)\}<\/span>/);
  // Selos: no máximo 2 na foto (B1 de 86dcb4db), pelo repartirSelos.
  assert.match(c, /selos\.foto\.map/);
});

test("coração: 1 toque salva, outro desfaz, com aria-pressed (mesmo store de favoritos)", () => {
  const f = ler("components/favorite-button.tsx");
  assert.match(f, /aria-pressed=\{isFavorite\}/);
  assert.match(f, /toggle\(propertyId\)/);
  assert.match(f, /void toggleFavorite\(propertyId, next\)/);
  // Fora do <a> do cartão (D12) — o clique não navega.
  const c = ler("components/property-card.tsx");
  assert.match(c.slice(c.indexOf("</Link>")), /<FavoriteButton propertyId=\{property\.id\} \/>/);
});

test("esqueleto do cartão no formato exato (foto 4:3, raio 12) na busca e nos favoritos", () => {
  const sk = ler("components/ui/skeleton.tsx");
  assert.match(sk, /<Skeleton className="aspect-\[4\/3\] w-full rounded-xl" \/>/);
  assert.match(sk, /bg-divisor/);
  assert.match(ler("app/(public)/buscar/loading.tsx"), /<SkeletonGradeCartoes /);
  assert.match(ler("components/favoritos-lista.tsx"), /<SkeletonCartao key=\{id\} \/>/);
});

test("imóveis parecidos usam o mesmo cartão e grade par", () => {
  const b = ler("components/property/imoveis-parecidos.tsx");
  assert.match(b, /<PropertyCard key=\{p\.id\} property=\{p\} \/>/);
  assert.match(b, /grid-cols-2[^"]*lg:grid-cols-4/);
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /<ImoveisParecidos imoveis=\{similar\} \/>/);
  assert.match(ler("app/(public)/imoveis/[id]/page.tsx"), /outros\.slice\(0, quantosDestaques\(outros\.length\)\)/);
});

// ── Folha de filtros: contagem ao vivo e "Limpar tudo" ──

const IMOVEIS = SAMPLE_PROPERTIES.map((p) => comTotalMes(p));
const contar = (f: FiltrosPainel) => IMOVEIS.filter((p) => passaNoPainel(p, f)).length;

test("filtros: a contagem do botão é a MESMA função da lista (uma regra só)", () => {
  const s = ler("app/(public)/buscar/search-client.tsx");
  assert.match(s, /let list = base\.filter\(\(p\) => passaNoPainel\(p, filtrosPainel\)\)/);
  assert.match(s, /\(f: FiltrosPainel\) => semExemplosQuandoHaReal\(base\.filter\(\(p\) => passaNoPainel\(p, f\)\), \(p\) => isExemplo\(p\.id\), exemplosForcados\)\.length/);
  // Estadia e tipo saíram do filtro de base: senão o rascunho da folha não mudava a contagem.
  assert.doesNotMatch(s, /if \(maxPeriod && p\.minPeriodDays > maxPeriod\) return false/);
  assert.doesNotMatch(s, /if \(typeFilter && /);
  const folha = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /const n = contar\(rascunho\);/);
  assert.match(folha, /\{rotuloMostrar\(n\)\}/);
  // Cada escolha sozinha: o número do botão é exatamente quantos imóveis a lista mostraria.
  const escolhas: Partial<FiltrosPainel>[] = [
    ...OPCOES_PRECO.map((o) => ({ maxPrice: o.valor })),
    ...OPCOES_QUARTOS.map((o) => ({ minBedrooms: o.valor })),
    ...OPCOES_ESTADIA.map((o) => ({ periodo: o.valor })),
    ...OPCOES_TIPO.map((o) => ({ tipo: o.valor })),
    ...OPCOES_PORTE_PET.map((o) => ({ petsOnly: true, petPorte: o.valor })),
    ...COMODIDADES_FILTRO.map((c) => ({ comodidades: [c.chave] })),
    { petsOnly: true },
    { homeOfficeOnly: true },
    { readyToLiveOnly: true },
    { garantia: "caucao" },
    { seguroOnly: true },
    { gestorOnly: true },
  ];
  for (const e of escolhas) {
    const f = { ...FILTROS_PAINEL_VAZIOS, ...e };
    const n = contar(f);
    assert.ok(n <= IMOVEIS.length, JSON.stringify(e));
    assert.equal(rotuloMostrar(n), n === 0 ? "Nenhum imóvel com esses filtros" : `Mostrar ${n} ${n === 1 ? "imóvel" : "imóveis"}`);
    assert.equal(contarFiltrosPainel(f), Object.keys(e).filter((k) => k !== "petPorte").length, JSON.stringify(e));
  }
});

test("filtros: estadia confere o mínimo E o máximo do anúncio (min_period_days / max_period_days)", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, periodo: 180 };
  const base = { monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false };
  assert.equal(passaNoPainel({ ...base, minPeriodDays: 30 }, f), true);
  assert.equal(passaNoPainel({ ...base, minPeriodDays: 30, maxPeriodDays: 180 }, f), true);
  assert.equal(passaNoPainel({ ...base, minPeriodDays: 30, maxPeriodDays: 90 }, f), false); // 5–6 meses não cabe em 90 dias
  assert.equal(passaNoPainel({ ...base, minPeriodDays: 90 }, { ...f, periodo: 60 }), false); // pede 1–2 meses, mínimo é 3
  assert.equal(passaNoPainel({ ...base, propertyType: "Casa" }, { ...FILTROS_PAINEL_VAZIOS, tipo: "casa" }), true);
  assert.equal(passaNoPainel({ ...base, propertyType: "apartamento" }, { ...FILTROS_PAINEL_VAZIOS, tipo: "casa" }), false);
});

test('filtros: "Limpar tudo" zera — volta a contar todos os imóveis e o contador some', () => {
  const tudo: FiltrosPainel = {
    ...FILTROS_PAINEL_VAZIOS,
    maxPrice: 2500,
    minBedrooms: 3,
    periodo: 180,
    tipo: "casa",
    petsOnly: true,
    petPorte: "G",
    homeOfficeOnly: true,
    readyToLiveOnly: true,
    comodidades: ["wifi", "garagem"],
    garantia: "caucao",
    seguroOnly: true,
    gestorOnly: true,
  };
  assert.ok(contar(tudo) < IMOVEIS.length);
  assert.equal(contar(FILTROS_PAINEL_VAZIOS), IMOVEIS.length);
  assert.equal(contarFiltrosPainel(FILTROS_PAINEL_VAZIOS), 0);
  const folha = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /onClick=\{\(\) => setRascunho\(FILTROS_PAINEL_VAZIOS\)\}\s+data-testid="limpar-tudo"\s+className=\{buttonClasses\(\{ variant: "tertiary" \}\)\}/);
});

test('filtros: nunca "Qualquer", "Ambos", "Indiferente" ou "Tanto faz" como opção; chips com aria-pressed', () => {
  const opcoes = [...OPCOES_PRECO, ...OPCOES_QUARTOS, ...OPCOES_ESTADIA, ...OPCOES_TIPO, ...OPCOES_PORTE_PET].map((o) => o.rotulo);
  for (const r of opcoes) assert.doesNotMatch(r, /qualquer|ambos|indiferente|tanto faz/i, r);
  const folha = ler("components/busca/painel-filtros-celular.tsx");
  assert.doesNotMatch(folha.replace(/\/\*[\s\S]*?\*\//g, ""), /Ambos|Indiferente|Tanto faz|"Qualquer/);
  assert.match(ler("components/ui/chip.tsx"), /aria-pressed=\{ativo\}/);
  // Tipos com os rótulos que o anúncio já usa (src/lib/amenities.ts), em número par.
  assert.equal(OPCOES_TIPO.length % 2, 0);
});
