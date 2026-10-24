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
  // E82-A: UMA linha de controles para celular e computador (sem bloco só do celular nem busca compacta no cabeçalho).
  assert.equal((s.match(/<BarraPilulas/g) ?? []).length, 1);
  assert.doesNotMatch(s, /data-testid="busca-celular"|BuscaCompacta|createPortal/);
  // O destino vive no painel da pílula Local; "Salvar busca" fica só na linha da contagem (e no vazio, como alerta).
  assert.match(s, /painelLocal=\{[\s\S]*?<LocationSearch[\s\S]*?<CampoDestino[\s\S]*?\}\s*painelMoradores=/);
  const linha = s.slice(s.indexOf('data-testid="linha-contagem"'), s.indexOf('data-testid="abrir-descrever"'));
  assert.match(linha, /<SalvarBusca versao=\{versaoBusca\} \/>/);
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
  // Plural único (ordem dd15064d, D7b) pela síntese do cartão (src/lib/cartao-sintese.ts, quartosTexto/banheirosTexto).
  assert.match(c, /const sintese = itensSintese\(property\);/);
  assert.match(ler("lib/cartao-sintese.ts"), /quartosTexto\(p\.bedrooms\)[\s\S]*banheirosTexto\(p\.bathrooms\)/);
  assert.match(c, /\{property\.neighborhood\}, \{property\.city\}/);
  // Custo total do mês em destaque (ordem 1a555bfa), no formato do QA: "R$ X/mês · R$ Y em N meses".
  assert.match(c, /<span className="text-sm text-ink">\/mês<\/span>/);
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
