/*
  Busca no celular (ordem 314f764e, prints 02/03/04): topo com busca + filtros,
  painel com rascunho e "Mostrar N imóveis", lista com foto, preço/mês,
  quartos/banheiros e bairro.
  Roda: node --test src/lib/busca/busca-celular.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FILTROS_PAINEL_VAZIOS,
  contarFiltrosPainel,
  passaNoPainel,
  resumoFiltros,
  rotuloMostrar,
} from "./painel-filtros.ts";
import { disponivelAPartirDe } from "./disponibilidade.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const imovel = (o: Partial<{ monthlyPrice: number; bedrooms: number; petsAllowed: boolean; tagHomeOffice: boolean; readyToLiveBadge: boolean }> = {}) => ({
  monthlyPrice: 3000,
  bedrooms: 2,
  petsAllowed: false,
  tagHomeOffice: false,
  readyToLiveBadge: false,
  ...o,
});

test("painel: preço, quartos, pets, home office e selo filtram como a lista", () => {
  const f = FILTROS_PAINEL_VAZIOS;
  assert.equal(passaNoPainel(imovel(), f), true);
  assert.equal(passaNoPainel(imovel({ monthlyPrice: 3600 }), { ...f, maxPrice: 3500 }), false);
  assert.equal(passaNoPainel(imovel({ monthlyPrice: 3500 }), { ...f, maxPrice: 3500 }), true);
  assert.equal(passaNoPainel(imovel({ bedrooms: 2 }), { ...f, minBedrooms: 3 }), false);
  assert.equal(passaNoPainel(imovel({ bedrooms: 3 }), { ...f, minBedrooms: 3 }), true);
  assert.equal(passaNoPainel(imovel(), { ...f, petsOnly: true }), false);
  assert.equal(passaNoPainel(imovel({ petsAllowed: true }), { ...f, petsOnly: true }), true);
  assert.equal(passaNoPainel(imovel(), { ...f, homeOfficeOnly: true }), false);
  assert.equal(passaNoPainel(imovel({ readyToLiveBadge: true }), { ...f, readyToLiveOnly: true }), true);
});

test("painel: contador do botão, texto de aplicar e resumo do topo", () => {
  assert.equal(contarFiltrosPainel(FILTROS_PAINEL_VAZIOS), 0);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, maxPrice: 2500, minBedrooms: 2, petsOnly: true, readyToLiveOnly: true }), 4);
  assert.equal(rotuloMostrar(0), "Nenhum imóvel com esses filtros");
  assert.equal(rotuloMostrar(1), "Mostrar 1 imóvel");
  assert.equal(rotuloMostrar(12), "Mostrar 12 imóveis");
  assert.equal(resumoFiltros(FILTROS_PAINEL_VAZIOS), "Qualquer preço · todos os imóveis");
  assert.equal(resumoFiltros({ ...FILTROS_PAINEL_VAZIOS, maxPrice: 3500, minBedrooms: 2, petsOnly: true }), "Até R$ 3.500 · 2+ quartos · Aceita pets");
});

test("busca usa UMA regra para a lista e para a contagem do painel", () => {
  const s = ler("app/(public)/buscar/search-client.tsx");
  assert.match(s, /let list = base\.filter\(\(p\) => passaNoPainel\(p, filtrosPainel\)\)/);
  // Prompt 30: a lista e a contagem tiram os exemplos do mesmo jeito (semExemplosQuandoHaReal).
  assert.match(s, /\(f: FiltrosPainel\) => semExemplosQuandoHaReal\(base\.filter\(\(p\) => passaNoPainel\(p, f\)\), \(p\) => isExemplo\(p\.id\), exemplosForcados\)\.length/);
  assert.match(s, /list = semExemplosQuandoHaReal\(list, \(p\) => isExemplo\(p\.id\), exemplosForcados\)/);
  // As 5 regras saíram do filtro antigo (sem duplicar).
  assert.doesNotMatch(s, /if \(petsOnly && !p\.petsAllowed\) return false/);
  assert.doesNotMatch(s, /if \(maxPrice && p\.monthlyPrice > maxPrice\) return false/);
  // Celular: topo com busca + botão de filtros; filtros antigos só do tablet para cima.
  assert.match(s, /className="container-page mt-4 sm:hidden" data-testid="busca-celular"/);
  assert.match(s, /data-testid="abrir-filtros"/);
  assert.match(s, /placeholder="Cidade, bairro ou endereço"/);
  assert.match(s, /"container-page hidden sm:block lg:order-1"/);
  // Computador (ordem eac7e3a1): busca compacta no cabeçalho abre o painel de filtros.
  assert.match(s, /createPortal\(\s*<div[^>]*>\s*<BuscaCompacta/);
  assert.match(s, /data-testid="busca-compacta"/);
});

test("painel: rascunho só vale ao aplicar; diálogo acessível; Esc fecha", () => {
  const p = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(p, /useState<FiltrosPainel>\(inicial\)/);
  assert.match(p, /onClick=\{\(\) => onAplicar\(rascunho\)\}/);
  assert.match(p, /\{rotuloMostrar\(n\)\}/);
  // Prompt 40: a folha é o BottomSheet (de baixo no celular, lateral no computador).
  assert.match(p, /<BottomSheet\s+open\s+onClose=\{onFechar\}\s+title="Filtros"\s+lateral/);
  const folha = ler("components/ui/bottom-sheet.tsx");
  assert.match(folha, /role="dialog"/);
  assert.match(folha, /aria-modal="true"/);
  assert.match(folha, /if \(e\.key === "Escape"\) fechar\.current\(\)/);
  for (const t of ["Preço por mês", "Quartos", "Aceita pets", "Para trabalhar de casa", "Limpar tudo"]) assert.ok(p.includes(t), t);
});

test("card: foto, preço por mês, quartos/banheiros por extenso, bairro e disponibilidade", () => {
  const c = ler("components/property-card.tsx");
  assert.match(c, /\{quartosTexto\(property\.bedrooms\)\}/); // plural único (ordem dd15064d, D7b)
  assert.match(c, /\{banheirosTexto\(property\.bathrooms\)\}/);
  assert.match(c, /\{property\.neighborhood\}, \{property\.city\}/);
  assert.match(c, /\/mês total<\/span>/); // custo total do mês em destaque (ordem 1a555bfa)
  const hoje = new Date("2026-10-14T12:00:00Z");
  assert.equal(disponivelAPartirDe("2026-11-15", hoje), "15/11");
  assert.equal(disponivelAPartirDe("2027-01-05", hoje), "05/01/2027");
  assert.equal(disponivelAPartirDe("2026-10-01", hoje), null);
  assert.equal(disponivelAPartirDe(undefined, hoje), null);
  assert.equal(disponivelAPartirDe("lixo", hoje), null);
});

test("identidade Viva Nomads: nada da referência", () => {
  for (const f of ["components/busca/painel-filtros-celular.tsx", "lib/busca/painel-filtros.ts", "app/(public)/buscar/search-client.tsx"]) {
    // Textos de tela da referência (o comentário interno "benchmark do Furnished Finder" não é tela).
    assert.doesNotMatch(ler(f), /Show \d+ Properties|Beds & Baths|Utilities Included|Add dates|Save This Search/i, f);
  }
  for (const f of ["components/busca/painel-filtros-celular.tsx", "lib/busca/painel-filtros.ts"]) {
    assert.doesNotMatch(ler(f), /Furnished/i, f);
  }
});
