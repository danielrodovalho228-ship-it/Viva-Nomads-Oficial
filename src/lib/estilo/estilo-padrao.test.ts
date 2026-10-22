/*
  Guarda do padrão visual (Prompt 40, Estudo 1 — fundação visual).
  Nas telas do alcance (tokens, botões/chips/folha, cartão de anúncio e o esqueleto
  dele, busca, home, favoritos, cidades e "imóveis parecidos"):
    - nenhum shadow-* fora do flutuante;
    - nenhum raio fora de 8 / 12 / full;
    - nenhum espaço fora da escala de 4 (meio passo ou arbitrário);
    - nenhum font-bold / font-extrabold / font-black;
  e, pelo adendo: sem caixa alta espaçada (uppercase + tracking), sem gradiente,
  teto de 28 px (40 px só no h1 do hero da home) e o cinza de apoio só em miúdo.
  Prompt 45: a guarda vale para src/ INTEIRO (app, components, lib, config). ALCANCE fica como a lista histórica
  das telas que entraram primeiro; o teste "src inteiro" é o que impede regressão em qualquer tela nova.
  Roda: node --test src/lib/estilo/estilo-padrao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { espacoPermitido, pxDoTamanho, violacoesAdendo, violacoesEstilo } from "./regras-estilo.ts";
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
  "components/property/fotos-cartao.tsx",
  // Rodapé global (QA do Prompt 40: títulos de coluna sem caixa alta)
  "components/layout/footer.tsx",
  // Prompt 41: página do imóvel, barra inferior por papel, "um primário por tela", cogumelo — todo arquivo tocado.
  "app/(dashboard)/admin/ajuda-publicacao/ajuda-publicacao-client.tsx",
  "app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx",
  "app/(dashboard)/admin/atendimento/atendimento-client.tsx",
  "app/(dashboard)/admin/avaliacoes/forms.tsx",
  "app/(dashboard)/admin/dados-de-teste/nova-jornada.tsx",
  "app/(dashboard)/admin/dados-de-teste/semear-carteira.tsx",
  "app/(dashboard)/admin/documentos/admin-documentos-client.tsx",
  "app/(dashboard)/admin/documentos/falhas-client.tsx",
  "app/(dashboard)/admin/documentos/matriculas-admin-client.tsx",
  "app/(dashboard)/admin/parceiros/page.tsx",
  "app/(dashboard)/admin/pedidos/chave-sms.tsx",
  "app/(dashboard)/admin/servicos/mudar-estado.tsx",
  "app/(dashboard)/dashboard/avaliacoes/acoes.tsx",
  "app/(dashboard)/dashboard/buscas/page.tsx",
  "app/(dashboard)/dashboard/contratos/contratos-inquilino.tsx",
  "app/(dashboard)/dashboard/estadia/[contratoId]/estadia-tela.tsx",
  "app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx",
  "app/(dashboard)/dashboard/fechamento/closing-flow.tsx",
  "app/(dashboard)/dashboard/imoveis/imoveis-client.tsx",
  "app/(dashboard)/dashboard/imoveis/novo/barra-fotos.tsx",
  "app/(dashboard)/dashboard/imoveis/novo/busca-endereco.tsx",
  "app/(dashboard)/dashboard/imoveis/novo/cartao-ia.tsx",
  "app/(dashboard)/dashboard/imoveis/novo/page.tsx",
  "app/(dashboard)/dashboard/leads/leads-client.tsx",
  "app/(dashboard)/dashboard/locacoes/locacoes-client.tsx",
  "app/(dashboard)/dashboard/orcamentos/orcamentos-client.tsx",
  "app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx",
  "app/(dashboard)/dashboard/pedidos-cidade/pedidos-dono-client.tsx",
  "app/(dashboard)/dashboard/pedidos/pedidos-client.tsx",
  "app/(dashboard)/dashboard/solicitacoes/page.tsx",
  "app/(dashboard)/dashboard/verificacao/page.tsx",
  "app/(dashboard)/dashboard/visao-geral-client.tsx",
  "app/(public)/imoveis/[id]/property-detail.tsx",
  "app/(public)/parceiros/[slug]/page.tsx",
  "app/(public)/parceiros/buscar/page.tsx",
  "components/account/avatar-uploader.tsx",
  "components/account/categoria-profissional.tsx",
  "components/account/conta-menu.tsx",
  "components/account/conta-secoes.tsx",
  "components/account/telefone-verificacao.tsx",
  "components/contrato/conferencia-contrato.tsx",
  "components/contrato/contrato-detalhe.tsx",
  "components/dashboard/tenant-onboarding.tsx",
  "components/documentos/documentos-contrato.tsx",
  "components/estadia/acoes-estadia.tsx",
  "components/layout/dashboard-shell.tsx",
  "components/layout/mobile-tab-bar.tsx",
  "components/layout/papel-ativo.tsx",
  "components/manutencao/cartao-ordem.tsx",
  "components/parceiros/pedidos-do-parceiro.tsx",
  "components/parceiros/solicitar-orcamento.tsx",
  "components/property-gallery.tsx",
  "components/property/availability-calendar.tsx",
  "components/property/barra-fixa-celular.tsx",
  "components/property/faixa-proprietario.tsx",
  "components/property/owner-card.tsx",
  "components/property/price-card.tsx",
  "components/property/visita-video.tsx",
  "components/share-button.tsx",
  "components/video-walkthrough.tsx",
  "components/visitas/cartao-visita.tsx",
  "config/dinheiro.ts",
  "config/rotas-app.ts",
  "lib/barra-fixa-imovel.ts",
  "lib/estadia/acoes.ts",
  "lib/data/estadia.ts",
  "lib/imovel-pagina.ts",
  "lib/nav-mobile.ts",
  "lib/parceiros/painel-actions.ts",
  "lib/use-papel-barra.ts",
];

/** Hero com h1 de até 40 px (adendo): home; /para-proprietarios, /como-funciona, /precos e /parceiros entram quando forem trazidas. */
// h1 que pode ir até 40 px: o hero da home e o topo das páginas de marketing (banner-topo).
const HEROS = new Set(["app/(public)/page.tsx", "components/institucional/banner-topo.tsx"]);

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

test("telas do alcance: sem sombra, raio, espaço ou peso fora do padrão (nem caixa alta, gradiente, > 28 px ou apoio no corpo)", () => {
  const achados: string[] = [];
  for (const alvo of ALCANCE) {
    for (const f of arquivos(alvo)) {
      const t = ler(f);
      for (const v of [...violacoesEstilo(t), ...violacoesAdendo(t, { heroAte40: HEROS.has(f) })]) achados.push(`${f}:${v.linha} ${v.tipo} ${v.classe}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("Prompt 45: src inteiro sem sombra, raio, espaço, peso, caixa alta espaçada, gradiente ou tamanho fora do padrão", () => {
  const achados: string[] = [];
  for (const alvo of ["app", "components", "lib", "config"]) {
    for (const f of arquivos(alvo)) {
      if (f.startsWith("lib/estilo/")) continue; // as próprias regras e seus exemplos
      const t = ler(f);
      for (const v of [...violacoesEstilo(t), ...violacoesAdendo(t, { heroAte40: HEROS.has(f) })]) achados.push(`${f}:${v.linha} ${v.tipo} ${v.classe}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("adendo: as regras novas pegam o que devem", () => {
  const tipos = (s: string, hero = false) => violacoesAdendo(s, { heroAte40: hero }).map((v) => `${v.tipo}:${v.classe}`);
  assert.deepEqual(tipos(`<p className="text-xs uppercase tracking-[0.18em]" />`), ["caixa-alta:uppercase + tracking"]);
  assert.deepEqual(tipos(`<p className="uppercase" />`), []);
  assert.deepEqual(tipos(`<div className="bg-gradient-to-r from-night" />`), ["gradiente:bg-gradient-to-r"]);
  assert.deepEqual(tipos(`<span className="text-gradient-brand" />`), ["gradiente:text-gradient-brand"]);
  assert.deepEqual(tipos(`<h2 className="text-3xl sm:text-4xl text-[30px]" />`), ["tamanho:text-3xl", "tamanho:text-4xl", "tamanho:text-[30px]"]);
  assert.deepEqual(tipos(`<h2 className="text-2xl md:text-[28px]" />`), []);
  assert.deepEqual(tipos(`<h1 className="text-[28px] sm:text-[40px]" />`, true), []);
  assert.deepEqual(tipos(`<h1 className="sm:text-5xl" />`, true), ["tamanho:text-5xl"]);
  assert.deepEqual(tipos(`<p className="text-base text-apoio" />`), ["apoio:text-apoio sem tamanho miúdo"]);
  assert.deepEqual(tipos(`<p className="text-xs text-apoio" />`), []);
  assert.equal(pxDoTamanho("[2rem]"), 32);
});

test("adendo: números tabulares no preço, na contagem do botão e no título da busca", () => {
  assert.match(ler("components/property-card.tsx"), /<p className="tabular-nums" data-testid="cartao-total-mes">/);
  assert.match(ler("components/property-card.tsx"), /tabular-nums text-muted" data-testid="cartao-disponivel"/);
  assert.match(ler("components/busca/painel-filtros-celular.tsx"), /px-4 tabular-nums sm:flex-none/);
  assert.match(ler("app/(public)/buscar/page.tsx"), /font-semibold tabular-nums text-ink/);
});

test("tokens: uma cor de marca, neutros, três raios, uma sombra e pesos 400/600 (globals.css)", () => {
  const css = ler("app/globals.css");
  const tema = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
  assert.match(tema, /--color-forest: #1c6b3a;/);
  assert.match(tema, /--color-ink: #222222;/);
  assert.match(tema, /--color-muted: #3f3f3f;/); // secundário (adendo)
  assert.match(tema, /--color-apoio: #6a6a6a;/); // só miúdo e legenda
  assert.match(tema, /--color-surface-2: #f7f7f7;/);
  assert.match(tema, /--color-surface-3: #f2f2f2;/);
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
  // Teto de tamanho: hero até 40 px, títulos de seção até 28 px.
  assert.match(css, /\.display-xl \{\s*font-size: clamp\([^,]+, [^,]+, 2\.5rem\);/);
  assert.match(css, /\.display-lg \{\s*font-size: clamp\([^,]+, [^,]+, 1\.75rem\);/);
});

test("sombra: shadow-flutuante em TUDO o que flutua e em nada mais (adendo)", () => {
  const usos: string[] = [];
  const varrer = (dir: string) => {
    for (const f of readdirSync(join(SRC, dir))) {
      const rel = join(dir, f);
      if (statSync(join(SRC, rel)).isDirectory()) varrer(rel);
      else if (/\.tsx?$/.test(f) && !f.endsWith(".test.ts") && !rel.startsWith("lib/estilo") && /shadow-flutuante/.test(ler(rel))) usos.push(rel);
    }
  };
  varrer("");
  assert.deepEqual(usos.sort(), [
    "app/(dashboard)/admin/agentes/central-client.tsx", // menu suspenso e botão flutuante da Central (Prompt 45)
    "app/(dashboard)/dashboard/imoveis/novo/painel-qualificacao.tsx", // gaveta lateral sobre a página (Prompt 45)
    "app/(public)/buscar/search-client.tsx", // faixa de filtros presa sob o cabeçalho e o seletor de moradores
    "app/(public)/pedidos/novo/page.tsx", // menu suspenso de sugestões (Prompt 45)
    "components/admin/motivo-dialog.tsx", // diálogo sobre a página (Prompt 45)
    "components/ajuda/viva-chat.tsx", // botão flutuante e a janela do chat
    "components/app/links-do-app.tsx", // diálogo sobre a página (Prompt 45)
    "components/busca/barra-comparar.tsx", // barra flutuante do Comparar
    "components/busca/card-pin-mapa.tsx", // cartão aberto sobre o mapa
    "components/city-autocomplete.tsx", // menu suspenso de sugestões
    "components/dashboard/role-welcome-modal.tsx", // diálogo sobre a página (Prompt 45)
    "components/estadia/acoes-estadia.tsx", // botão flutuante "cogumelo" (Prompt 41)
    "components/layout/mobile-tab-bar.tsx", // barra inferior do celular/app (Prompt 41)
    "components/layout/navbar.tsx", // cabeçalho fixo (busca fixa) e menu suspenso
    "components/location-search.tsx", // menu suspenso de sugestões
    "components/property/barra-fixa-celular.tsx", // barra fixa do celular
    "components/property/places-picker.tsx", // menu suspenso de sugestões (Prompt 45)
    "components/search-map.tsx", // botões (pinos) do mapa
    "components/ui/button.tsx", // variante flutuante
  ]);
  // E nenhuma outra sombra nesses arquivos de flutuantes (a guarda geral cobre o resto do alcance).
  for (const f of ["components/property/barra-fixa-celular.tsx", "components/search-map.tsx", "components/layout/navbar.tsx", "components/layout/mobile-tab-bar.tsx"]) {
    assert.deepEqual(violacoesEstilo(ler(f)).filter((v) => v.tipo === "sombra"), [], f);
  }
});

test("cartão de anúncio: sem caixa (sem border nem shadow), foto 4:3 com raio de 12 px, ordem do Estudo 1", () => {
  const c = ler("components/property-card.tsx");
  const link = c.slice(c.indexOf("<Link"), c.indexOf(">", c.indexOf("className=", c.indexOf("<Link"))));
  assert.doesNotMatch(link, /\bborder\b|\bborder-|shadow|bg-white/, "o <Link> do cartão não é uma caixa");
  assert.doesNotMatch(c, /\bshadow\b|shadow-/);
  assert.match(c, /className="relative aspect-\[4\/3\] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto"/);
  // Ordem do adendo: foto → bairro + nota → título (2 linhas) → total → síntese → disponibilidade.
  const ordem = ["cartao-foto", "cartao-local", "cartao-titulo", "cartao-total-mes", "cartao-sintese", "cartao-disponivel"].map((id) => c.indexOf(`data-testid="${id}"`));
  assert.ok(ordem.every((i, k) => i > 0 && (k === 0 || i > ordem[k - 1])), `ordem ${ordem}`);
  assert.match(c, /text-base font-semibold[^"]*" data-testid="cartao-local"/); // cartão 16/600
  assert.match(c, /className="line-clamp-2 [^"]*" data-testid="cartao-titulo"/);
  assert.match(c, /<p className="tabular-nums" data-testid="cartao-total-mes">/);
  assert.match(c, /text-lg font-semibold text-forest" data-testid="cartao-preco-mes">\s*\{preco\.valor\}/);
  assert.match(c, /<span className="text-sm text-ink">\/mês<\/span>/); // sem "total" solto (QA)
  assert.doesNotMatch(c, /\/mês total/);
  assert.match(c, /const preco = rotuloPrecoCartao\(inc\.total, mesesDoCartao\(periodMonths, property\.minPeriodDays\)\);/);
  assert.match(c, /\{preco\.estadia && \(/); // N = 1: só "R$ X/mês"
  assert.match(c, /const sintese = itensSintese\(property\);/);
  assert.doesNotMatch(c, /IdealPara/); // ordem congelada: "Ideal para" fica na página do imóvel
  // Carrossel com pontos e no máximo 1 selo.
  assert.match(c, /<FotosCartao fotos=\{fotos\} alt=\{property\.title\}( carregarJa=\{carregarJa\})? \/>/);
  assert.match(ler("components/property/fotos-cartao.tsx"), /data-testid="cartao-pontos"/);
  assert.match(c, /\{selo && <Selo id=\{selo\} \/>\}/);
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

test("folha de filtros: chip de opção = pill; campo e botão = 8 px; Limpar tudo = texto (veredito do coordenador)", () => {
  const folha = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /chip de opção = pill/);
  assert.match(folha, /campo \(número, seleção, data\) = 8 px/);
  // Na folha, a única pill vem do <Chip>; nenhum rounded-full escrito à mão.
  assert.doesNotMatch(folha.replace(/\/\*[\s\S]*?\*\//g, ""), /rounded-full/);
  assert.match(folha, /data-testid="aplicar-filtros"[\s\S]{0,120}className=\{buttonClasses\(\{ className:/); // primário (raio 8)
  assert.match(folha, /className=\{buttonClasses\(\{ variant: "tertiary" \}\)\}/);
  // Campos da faixa de filtros da /buscar (seleção, data, moradores, raio): 8 px.
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.match(busca, /className="h-10 min-w-0 rounded-lg border border-line bg-white px-4 text-sm/); // <Select>
  assert.match(busca, /<label className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border/); // data
  assert.match(busca, /"inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4/); // moradores
});

test('/buscar: o campo "Descreva o lugar ideal" é pill como a busca do cabeçalho', () => {
  assert.match(ler("components/busca/descricao-busca.tsx"), /className="h-12 w-full rounded-full border border-line bg-white /);
});

test("rodapé: títulos de coluna 14/600, sem caixa alta nem tracking", () => {
  const r = ler("components/layout/footer.tsx");
  assert.match(r, /<h2 className="mb-4 text-sm font-semibold text-white">/);
  assert.doesNotMatch(r, /uppercase|tracking-|font-title|font-bold|gradient/);
  // Veredito do #953 (opção b): fundo escuro mantido, sem a faixa de marca no topo (nem gradiente nem substituto).
  assert.match(r, /<footer className="mt-auto bg-night /);
  assert.doesNotMatch(r, /className="h-1 w-full/);
  // Textos de apoio: só /60–/80; /50 só no miúdo.
  for (const m of r.matchAll(/text-white\/(\d+)/g)) assert.ok(Number(m[1]) >= 50, m[0]);
});
