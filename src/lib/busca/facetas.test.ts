/*
  FILTROS-1 — matriz chip → contagem da folha de filtros da /buscar, num fixture FIXO: os 15 anúncios de exemplo
  (SAMPLE_PROPERTIES, os mesmos da auditoria do Muse de 23/10). Cada defeito (E39–E43, E20, E6/E16) tem o seu caso.
  Roda: node --test src/lib/busca/facetas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { FILTROS_PAINEL_VAZIOS, OPCOES_PRECO, OPCOES_TIPO, cabeNaEstadia, naoMedidosDoPainel, passaNoPainel, precoDeBusca, type FiltrosPainel } from "./painel-filtros.ts";
import { faceta, facetaComodidade, facetaInterruptor, facetaUnica, faixasInternet, filtroInternetEfetivo, medicoesDaBusca, secaoInternetVisivel } from "./facetas.ts";
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
  // As contagens valem com o resto do rascunho: Garagem com "Casa" ligado.
  assert.equal(facetaComodidade(contar, { ...V, tipo: "casa" }, "garagem").n, com({ tipo: "casa", comodidades: ["garagem"] }));
  assert.equal(facetaInterruptor(contar, { ...V, petsOnly: false }, "petsOnly").n, 7);
  for (const o of OPCOES_PRECO) assert.equal(facetaUnica(contar, V, "maxPrice", o.valor).n, com({ maxPrice: o.valor }));
});

test("E39 (b): anúncio novo só publica com a velocidade da internet; o publicado não muda", () => {
  const fatos: FatosAnuncio = {
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio", preco: 2000, garantiaOk: true, sublocacaoOk: true,
    privacidadeOk: true, documento: "approved", descricao: "x".repeat(80), selo: false, video: false,
  };
  const falta = (f: FatosAnuncio) => prontidaoAnuncio(f).obrigatorios.filter((i) => !i.ok).map((i) => i.label);
  assert.deepEqual(falta({ ...fatos, internetOk: false }), [ROTULO_FALTA_INTERNET]);
  assert.deepEqual(falta({ ...fatos, internetOk: true }), []);
  assert.deepEqual(falta(fatos), [], "ausente (anúncio já publicado): não barra");
});

test("E40 (Adendo 3): sem medição na busca, a seção some e o filtro da URL é ignorado; com uma, as três faixas", () => {
  assert.deepEqual(medicoesDaBusca(LISTA, AGORA), [], "nenhum exemplo tem medição");
  assert.deepEqual(faixasInternet([]), []);
  assert.equal(secaoInternetVisivel([]), false);
  // Veio da URL com ?internet=100 e nada medido: o filtro é ignorado (o chip ativo sai).
  assert.deepEqual(filtroInternetEfetivo([], { ...V, internetMin: 100, soInternetMedida: true }), { ...V, internetMin: 0, soInternetMedida: false });
  // Com uma medição: 50/100/300, cada uma com a contagem do aplicar; faixa em 0 desativada.
  assert.deepEqual(faixasInternet([80]), [50, 100, 300]);
  assert.equal(secaoInternetVisivel([80]), true);
  assert.deepEqual(filtroInternetEfetivo([80], { ...V, internetMin: 100 }).internetMin, 100);
  const medido = { ...LISTA[3], internetMedida: { downloadMbps: 150, validoAte: "2027-01-01" } } as Imovel;
  const vencido = { ...LISTA[4], internetMedida: { downloadMbps: 500, validoAte: "2026-01-01" } } as Imovel;
  assert.deepEqual(medicoesDaBusca([medido, vencido, LISTA[5]], AGORA), [150], "medição vencida não conta");
});

test("E40: as faixas contam igual ao aplicar, a de 0 fica desativada e a linha dos não medidos continua", () => {
  const lista = LISTA.map((p, i) =>
    i === 3 ? ({ ...p, internetMedida: { downloadMbps: 150, validoAte: "2027-01-01" } } as Imovel) : i === 4 ? ({ ...p, internetMbps: 400 } as Imovel) : p,
  );
  const contar2 = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f, AGORA)).length;
  const faixas = faixasInternet(medicoesDaBusca(lista, AGORA));
  assert.deepEqual(faixas, [50, 100, 300]);
  assert.deepEqual(faixas.map((v) => facetaUnica(contar2, V, "internetMin", v)), [
    { n: 1, desabilitado: false },
    { n: 1, desabilitado: false },
    { n: 0, desabilitado: true },
  ]);
  // A linha "Mais N com internet informada, mas não medida" segue (o de 400 Mbps informados, sem medição).
  assert.equal(naoMedidosDoPainel(lista, { ...V, internetMin: 300 }, AGORA).length, 1);
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
  // Adendo 3: o campo antigo saiu do painel e da URL; sobra só como apelido da garantia (mesmo critério).
  assert.equal(com({ seguroOnly: true }), com({ garantia: "seguro_fianca" }));
  const folha = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
  const busca = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(folha, /Aceita Seguro-Fiança/);
  assert.match(folha, /testId="faceta-pronto"/);
  assert.doesNotMatch(busca, /aria-label="Pronto para Morar"/, "a barra de cima não tem mais o chip");
  assert.match(busca, /seguroDaUrlLegada\(gar, sp\.get\("seguro"\)\)\) setGarantia\("seguro_fianca"\)/);
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
  for (const t of ["faceta-quartos-", "faceta-estadia-", "faceta-pets", "faceta-home-office", "faceta-pronto", "faceta-porte-", "faceta-internet-", "faceta-garantia-", "faceta-gestor", "faceta-comodidade-"]) {
    assert.ok(folha.includes(t), t);
  }
  // E105: Preço, Tipo e Nível moram só nas pílulas — com a mesma contagem e o mesmo desabilitado em 0.
  for (const t of ["faceta-preco-", "faceta-tipo-", "filtro-nivel-"]) assert.ok(!folha.includes(t), `${t} saiu da folha`);
  const pilulas = readFileSync(new URL("../../components/busca/barra-pilulas.tsx", import.meta.url), "utf8");
  assert.match(pilulas, /facetaUnica\(p\.contar, f, "tipo", o\.valor\)[\s\S]*?fc\.desabilitado/);
  assert.match(pilulas, /facetaUnica\(p\.contar, f, "maxPrice", o\.valor\)[\s\S]*?fc\.desabilitado/);
});
