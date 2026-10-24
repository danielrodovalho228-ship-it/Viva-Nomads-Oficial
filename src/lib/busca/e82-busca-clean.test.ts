/*
  E82-A + E91 + E95 (/buscar clean, mockup BUSCA-CARD): uma linha de pílulas, a contagem simples acima da lista,
  Local único, "Descrever o que procuro" numa folha e a bolha da Viva fora da busca.
  Roda: node --test src/lib/busca/e82-busca-clean.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORDEM_PILULAS, valorDaPilula } from "./pilulas.ts";
import { contagemDaBusca } from "./titulo-busca.ts";
import { FILTROS_PAINEL_VAZIOS } from "./painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const busca = ler("app/(public)/buscar/search-client.tsx");
const barra = ler("components/busca/barra-pilulas.tsx");

test("uma linha de controles na ordem do mockup: Datas · Local · Tipo · Preço · Nível · Mais filtros · Ordenar · Mapa", () => {
  assert.deepEqual([...ORDEM_PILULAS], ["datas", "local", "tipo", "preco", "nivel", "mais", "ordenar", "mapa"]);
  const linha = barra.slice(barra.indexOf(`role="toolbar"`), barra.indexOf("{aberto && ("));
  const ordem = [...linha.matchAll(/pilula\("(\w+)"\)|data-testid="pilula-(mais|mapa)"/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(ordem, [...ORDEM_PILULAS]);
  assert.match(linha, /role="toolbar"/);
  assert.match(linha, /overflow-x-auto/, "no celular a linha rola de lado, sem quebrar em duas");
  assert.equal((busca.match(/<BarraPilulas/g) ?? []).length, 1);
});

test("pílula ativa mostra o valor; inativa, o rótulo", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS };
  for (const id of ["datas", "local", "tipo", "preco", "nivel", "ordenar"] as const) assert.equal(valorDaPilula(id, f, {}), null, id);
  assert.equal(valorDaPilula("preco", { ...f, maxPrice: 3500 }, {}), "Até R$ 3.500");
  assert.equal(valorDaPilula("tipo", { ...f, tipo: "apartamento" }, {}), "Apartamento");
  assert.equal(valorDaPilula("nivel", { ...f, nivelMin: "conforto" }, {}), "Conforto+");
  assert.equal(valorDaPilula("nivel", { ...f, nivelMin: "premium" }, {}), "Premium");
  assert.equal(valorDaPilula("datas", { ...f, entrada: "2026-11-05", periodo: 120 }, {}), "Entrada 05/11 · 3–4 meses");
  assert.equal(valorDaPilula("local", f, { local: "  Uberlândia " }), "Uberlândia");
  // Local é ÚNICO: com "Perto de", a mesma pílula mostra o destino (sem segundo cartão de destino na página).
  assert.equal(valorDaPilula("local", f, { local: "Uberlândia", perto: "HC-UFU" }), "Perto de HC-UFU");
  assert.equal(valorDaPilula("ordenar", f, { ordem: "Menor preço" }), "Menor preço");
});

test("E91: a linha da contagem substitui o título grande", () => {
  assert.equal(contagemDaBusca({ n: 15, local: "Uberlândia" }), "15 imóveis em Uberlândia");
  assert.equal(contagemDaBusca({ n: 1, local: "Centro" }), "1 imóvel em Centro");
  assert.equal(contagemDaBusca({ n: 7 }), "7 imóveis");
  assert.equal(contagemDaBusca({ n: 0, local: "Uberlândia" }), "Nenhum imóvel com estes filtros");
  const linha = busca.slice(busca.indexOf('data-testid="linha-contagem"'), busca.indexOf("{descreverAberto && ("));
  assert.match(linha, /<h1 className="text-base font-semibold tabular-nums text-ink" data-testid="titulo-busca">/);
  assert.match(linha, /<SalvarBusca versao=\{versaoBusca\} \/>/);
  assert.match(linha, /data-testid="abrir-descrever"[^>]*>\s*Descrever o que procuro/);
  assert.doesNotMatch(busca, /<TituloBusca|BannerBusca|text-3xl/);
  assert.doesNotMatch(ler("app/(public)/buscar/page.tsx"), /TituloBusca|<Banner/);
});

test("E82-A: 'Onde você vai trabalhar ou estudar?' e a caixa 'Descreva o lugar ideal' saem da página", () => {
  // O destino vive só no painel da pílula Local.
  assert.equal((busca.match(/<CampoDestino/g) ?? []).length, 1);
  assert.match(busca, /painelLocal=\{[\s\S]*?<CampoDestino/);
  // A descrição só abre numa folha; nada de botão "Aplicar nos filtros" solto na página.
  assert.equal((busca.match(/<DescricaoBusca /g) ?? []).length, 1);
  assert.match(busca, /<BottomSheet open onClose=\{\(\) => setDescreverAberto\(false\)\} title="Descrever o que procuro"[^>]*testId="folha-descrever">\s*<DescricaoBusca key=\{reinicioDescricao\}/);
  assert.doesNotMatch(busca, /Aplicar nos filtros/);
  // Na folha de filtros, o 1º bloco é a descrição recolhida numa linha.
  assert.match(busca, /topo=\{[\s\S]*?data-testid="folha-descreva"/);
});

test("E95: a bolha 'Fale com a Viva' não cobre a busca; a ajuda fica como link no fim", () => {
  const chat = ler("components/ajuda/viva-chat.tsx");
  assert.match(chat.split("\n").find((l) => l.includes("const ESCONDER")) ?? "", /"\/buscar"/);
  assert.match(busca, /data-testid="buscar-ajuda"/);
});

test("E82-A: a folha de filtros recomeça com os filtros da URL, mesmo aberta antes de a URL ser lida", () => {
  assert.match(busca, /<FolhaFiltros\s+key=\{JSON\.stringify\(filtrosPainel\)\}\s+inicial=\{filtrosPainel\}/);
});
