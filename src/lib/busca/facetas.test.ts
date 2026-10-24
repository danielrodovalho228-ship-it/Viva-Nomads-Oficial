/*
  FILTROS-1 — matriz chip → contagem da folha de filtros da /buscar, num fixture FIXO: os 15 anúncios de exemplo
  (SAMPLE_PROPERTIES, os mesmos da auditoria do Muse de 23/10). Cada defeito (E39–E43, E20, E6/E16) tem o seu caso.
  Roda: node --test src/lib/busca/facetas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { FILTROS_PAINEL_VAZIOS, OPCOES_PRECO, OPCOES_TIPO, cabeNaEstadia, passaNoPainel, precoDeBusca, type FiltrosPainel } from "./painel-filtros.ts";
import { temComodidade } from "./filtro-comodidades.ts";
import { faceta, facetaComodidade, facetaInterruptor, facetaUnica, faixasInternet, medicoesDaBusca, secaoInternetVisivel } from "./facetas.ts";
import { prontidaoAnuncio, ROTULO_FALTA_INTERNET, type FatosAnuncio } from "../anuncio/prontidao.ts";

type Imovel = Parameters<typeof passaNoPainel>[0];
const LISTA = SAMPLE_PROPERTIES as unknown as Imovel[];
const AGORA = new Date("2026-10-23T12:00:00Z");
const contar = (f: FiltrosPainel) => LISTA.filter((p) => passaNoPainel(p, f, AGORA)).length;
const V = FILTROS_PAINEL_VAZIOS;
const com = (f: Partial<FiltrosPainel>) => contar({ ...V, ...f });

/** A tabela do PR (chip → contagem com só ele ligado). */
const MATRIZ: [string, Partial<FiltrosPainel>, number][] = [
  ["(nenhum filtro)", {}, 15],
  ["Preço · Até R$ 2.500", { maxPrice: 2500 }, 1],
  ["Preço · Até R$ 3.500", { maxPrice: 3500 }, 8],
  ["Preço · Até R$ 5.000", { maxPrice: 5000 }, 13],
  ["Quartos · 1+", { minBedrooms: 1 }, 15],
  ["Quartos · 2+", { minBedrooms: 2 }, 8],
  ["Quartos · 3+", { minBedrooms: 3 }, 3],
  ["Estadia · 1–2 meses", { periodo: 60 }, 15],
  ["Estadia · 3–4 meses", { periodo: 120 }, 15],
  ["Estadia · 5–6 meses", { periodo: 180 }, 15],
  ["Tipo · Apartamento", { tipo: "apartamento" }, 7],
  ["Tipo · Studio / kitnet", { tipo: "studio" }, 5],
  ["Tipo · Casa", { tipo: "casa" }, 3],
  ["Tipo · Loft", { tipo: "loft" }, 0],
  ["Tipo · Cobertura", { tipo: "cobertura" }, 0],
  ["Tipo · Casa de condomínio", { tipo: "casa_condominio" }, 0],
  ["Tipo · Flat / apart-hotel", { tipo: "flat" }, 0],
  ["Tipo · Quarto privativo", { tipo: "quarto" }, 0],
  ["Aceita pets", { petsOnly: true }, 7],
  ["Para trabalhar de casa", { homeOfficeOnly: true }, 10],
  ["Pronto para Morar", { readyToLiveOnly: true }, 14],
  ["Contrato · Caução", { garantia: "caucao" }, 15],
  ["Contrato · Seguro-fiança", { garantia: "seguro_fianca" }, 14],
  ["Contrato · Gestor profissional", { gestorOnly: true }, 1],
  ["Comodidades · Garagem", { comodidades: ["garagem"] }, 12],
  ["Comodidades · Máquina de lavar", { comodidades: ["lavar"] }, 9],
];

test("matriz chip → contagem no fixture fixo (15 anúncios de exemplo)", () => {
  for (const [nome, f, esperado] of MATRIZ) assert.equal(com(f), esperado, nome);
});

test("E42/E6: a contagem do chip é a do aplicar; opção em 0 desabilita (menos a escolhida)", () => {
  const r = { ...V };
  for (const o of OPCOES_TIPO) {
    const fc = facetaUnica(contar, r, "tipo", o.valor);
    assert.equal(fc.n, com({ tipo: o.valor }), `contagem de ${o.rotulo} = resultado ao aplicar`);
    assert.equal(fc.desabilitado, fc.n === 0, o.rotulo);
  }
  // Loft já escolhido (veio da URL): mostra 0, mas fica clicável para desligar.
  assert.deepEqual(facetaUnica(contar, { ...V, tipo: "loft" }, "tipo", "loft"), { n: 0, desabilitado: false });
  assert.deepEqual(faceta(0, true), { n: 0, desabilitado: false });
  // As contagens valem com o resto do rascunho: Wi-Fi com "Casa" ligado.
  assert.equal(facetaComodidade(contar, { ...V, tipo: "casa" }, "wifi").n, com({ tipo: "casa", comodidades: ["wifi"] }));
  assert.equal(facetaInterruptor(contar, { ...V, petsOnly: false }, "petsOnly").n, 7);
  for (const o of OPCOES_PRECO) assert.equal(facetaUnica(contar, V, "maxPrice", o.valor).n, com({ maxPrice: o.valor }));
});

test("E39: a detecção de Wi-Fi lê o que o anúncio declara (rótulo \"Wi-Fi\", fibra, Mbps informado ou medido)", () => {
  // FILTROS-2: Wi-Fi deixou de ser chip (é garantia do mínimo); a detecção continua valendo para os dados públicos.
  const base = { monthlyPrice: 2000, bedrooms: 1, tagHomeOffice: false };
  const wifi = (p: Partial<Imovel>) => temComodidade({ ...base, ...p } as Imovel, "wifi");
  assert.equal(wifi({ amenities: ["Wi-Fi"] }), true);
  assert.equal(wifi({ amenities: ["Internet fibra de alta velocidade"] }), true);
  assert.equal(wifi({ comodidadesFiltro: [], internetMbps: 300 }), true, "velocidade informada no anúncio");
  assert.equal(wifi({ comodidadesFiltro: [], internetMedida: { downloadMbps: 120, validoAte: "2027-01-01" } }), true);
  assert.equal(wifi({ amenities: ["Cozinha equipada"] }), false, "sem internet declarada: fica fora");
});

test("E39 (b): anúncio novo só publica com a velocidade da internet; o publicado não muda", () => {
  const fatos: FatosAnuncio = {
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio", preco: 2000, garantiaOk: true, sublocacaoOk: true,
    privacidadeOk: true, documento: "approved", limitePlanoOk: true, descricao: "x".repeat(80), selo: false, video: false,
  };
  const falta = (f: FatosAnuncio) => prontidaoAnuncio(f).obrigatorios.filter((i) => !i.ok).map((i) => i.label);
  assert.deepEqual(falta({ ...fatos, internetOk: false }), [ROTULO_FALTA_INTERNET]);
  assert.deepEqual(falta({ ...fatos, internetOk: true }), []);
  assert.deepEqual(falta(fatos), [], "ausente (anúncio já publicado): não barra");
});

test("E40: sem medição na busca, a seção de internet medida some; as faixas saem das medições reais", () => {
  assert.deepEqual(medicoesDaBusca(LISTA, AGORA), [], "nenhum exemplo tem medição");
  assert.deepEqual(faixasInternet([], 0), []);
  assert.equal(secaoInternetVisivel([], { internetMin: 0, soInternetMedida: false }), false);
  // Veio da URL com ?internet=100 e nada medido: o chip escolhido fica (para desligar) e a explicação aparece.
  assert.deepEqual(faixasInternet([], 100), [100]);
  assert.equal(secaoInternetVisivel([], { internetMin: 100, soInternetMedida: false }), true);
  assert.deepEqual(faixasInternet([80, 320], 0), [50, 100, 300]);
  assert.deepEqual(faixasInternet([80], 0), [50], "100 e 300 não existem: ninguém alcança");
  const medido = { ...LISTA[3], internetMedida: { downloadMbps: 150, validoAte: "2027-01-01" } } as Imovel;
  const vencido = { ...LISTA[4], internetMedida: { downloadMbps: 500, validoAte: "2026-01-01" } } as Imovel;
  assert.deepEqual(medicoesDaBusca([medido, vencido, LISTA[5]], AGORA), [150], "medição vencida não conta");
});

test("E40 + E39: Wi-Fi + uma faixa de velocidade não vira beco sem saída", () => {
  // Sem medição, a faixa nem aparece; com uma medição de 150, só 50 e 100 existem e a contagem é a do aplicar.
  assert.deepEqual(faixasInternet(medicoesDaBusca(LISTA, AGORA), 0), []);
  const lista = LISTA.map((p, i) => (i === 3 ? ({ ...p, internetMedida: { downloadMbps: 150, validoAte: "2027-01-01" } } as Imovel) : p));
  const contar2 = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f, AGORA)).length;
  const faixas = faixasInternet(medicoesDaBusca(lista, AGORA), 0);
  assert.deepEqual(faixas, [50, 100]);
  for (const v of faixas) assert.equal(facetaUnica(contar2, V, "internetMin", v).n, 1, `${v} Mbps`);
});

test("E41: estadia e caução filtram de verdade (o fixture aceita tudo; um anúncio diferente sai)", () => {
  // Estadia: o mínimo do anúncio cabe na faixa e o máximo (quando há) alcança o começo dela.
  assert.equal(cabeNaEstadia({ minPeriodDays: 150 }, 60), false, "mínimo de 5 meses não serve para 1–2 meses");
  assert.equal(cabeNaEstadia({ minPeriodDays: 30, maxPeriodDays: 90 }, 180), false, "máximo de 3 meses não serve para 5–6");
  assert.equal(cabeNaEstadia({ minPeriodDays: 30, maxPeriodDays: 180 }, 180), true);
  const curto = { ...LISTA[0], id: "x", minPeriodDays: 30, maxPeriodDays: 60 } as Imovel;
  const soSeguro = { ...LISTA[0], id: "y", garantiasAceitas: ["seguro_fianca"] } as Imovel;
  assert.equal(passaNoPainel(curto, { ...V, periodo: 180 }, AGORA), false);
  assert.equal(passaNoPainel(soSeguro, { ...V, garantia: "caucao" }, AGORA), false, "só seguro-fiança não aceita caução");
});

test("E43: um chip de seguro-fiança (o atalho antigo é o mesmo critério) e Pronto para Morar num lugar só", () => {
  assert.equal(com({ seguroOnly: true }), com({ garantia: "seguro_fianca" }));
  const folha = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
  const busca = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(folha, /Aceita Seguro-Fiança/);
  assert.match(folha, /testId="faceta-pronto"/);
  assert.doesNotMatch(busca, /aria-label="Pronto para Morar"/, "a barra de cima não tem mais o chip");
  assert.match(busca, /on\("seguro"\) && !gar\) setGarantia\("seguro_fianca"\)/);
});

test("E20: o preço compara o TOTAL do mês (o mesmo do cartão), não o aluguel base", () => {
  const ube005 = LISTA.find((p) => (p as { id?: string }).id === "ube-005")!;
  assert.equal(ube005.monthlyPrice, 2850);
  assert.equal(precoDeBusca(ube005), 3470, "2.850 + condomínio 380 + contas 240");
  assert.equal(passaNoPainel(ube005, { ...V, maxPrice: 3000 }, AGORA), false, "antes passava (comparava 2.850)");
  const ube002 = LISTA.find((p) => (p as { id?: string }).id === "ube-002")!;
  assert.equal(passaNoPainel(ube002, { ...V, maxPrice: 2500 }, AGORA), false, "aluguel 2.400, total 3.130");
  assert.equal(precoDeBusca({ monthlyPrice: 2000, totalMes: 2500 }), 2500, "total já calculado vale");
});

test("E42: todos os grupos da folha mostram contagem e desabilitam em 0 (fonte)", () => {
  const folha = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
  // Fora o grupo de níveis (que já tinha), nenhuma opção ficou como <Chip> cru: todas passam por ChipFaceta.
  const linhas = folha.split("\n");
  const cru = linhas
    .map((l, i) => (/^\s*<Chip\b/.test(l) ? linhas.slice(i, i + 4).join(" ") : null))
    .filter((c): c is string => !!c && !/nivel\.desabilitado|disabled=\{f\.desabilitado\}/.test(c));
  assert.deepEqual(cru, []);
  for (const t of ["faceta-preco-", "faceta-quartos-", "faceta-estadia-", "faceta-tipo-", "faceta-pets", "faceta-home-office", "faceta-pronto", "faceta-porte-", "faceta-internet-", "faceta-garantia-", "faceta-gestor", "faceta-comodidade-"]) {
    assert.ok(folha.includes(t), t);
  }
});
