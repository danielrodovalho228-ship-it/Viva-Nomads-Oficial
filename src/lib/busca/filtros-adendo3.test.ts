/*
  ADENDO 3 AO FILTROS-B (E39–E43) — auditoria dos filtros da /buscar numa MASSA VARIADA (não nos exemplos: a base pública
  só tem exemplos, e exemplo não conta em resultado nem em contagem quando há filtro — E9).
  Roda: node --test src/lib/busca/filtros-adendo3.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FILTROS_PAINEL_VAZIOS,
  OPCOES_ESTADIA,
  OPCOES_PRECO,
  OPCOES_QUARTOS,
  OPCOES_TIPO,
  aceitaGarantia,
  cabeNaEstadia,
  contarFiltrosPainel,
  passaNoPainel,
  resumoFiltros,
  seguroDaUrlLegada,
  type FiltrosPainel,
} from "./painel-filtros.ts";
import { COMODIDADES_FILTRAVEIS, COMODIDADES_FILTRO, comodidadesDaUrl } from "./filtro-comodidades.ts";
import { facetaComodidade, facetaInterruptor, facetaUnica, faixasInternet, filtroInternetEfetivo, medicoesDaBusca, secaoInternetVisivel } from "./facetas.ts";
import { normalizarBusca } from "./buscas-salvas.ts";
import { imovelBateComBusca, type ImovelParaAlerta } from "./alerta-busca.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "../anuncio/prontidao.ts";
import { MOTIVO_SEM_INTERNET } from "../anuncio/internet-imovel.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-10-24T12:00:00Z");
const VALIDO = "2027-04-01T00:00:00Z";
const V = FILTROS_PAINEL_VAZIOS;

type Imovel = Parameters<typeof passaNoPainel>[0] & ImovelParaAlerta;
const base = (o: Partial<Imovel>): Imovel => ({
  id: "x",
  title: "Imóvel",
  city: "Uberlândia",
  neighborhood: "Centro",
  propertyType: "apartamento",
  monthlyPrice: 2000,
  totalMes: 2000,
  bedrooms: 1,
  minPeriodDays: 30,
  maxPeriodDays: 180,
  tagHomeOffice: false,
  garantiasAceitas: ["caucao"],
  ...o,
});

/** Massa variada do laboratório: tipos, garantias, estadias, internet medida/informada, Pronto para Morar, comodidades. */
const MASSA: Imovel[] = [
  base({ id: "a", propertyType: "apartamento", totalMes: 2400, bedrooms: 1, readyToLiveBadge: true, garantiasAceitas: ["caucao_avista"], internetMedida: { downloadMbps: 320, validoAte: VALIDO } }),
  base({ id: "b", propertyType: "apartamento", totalMes: 3300, bedrooms: 2, garantiasAceitas: ["seguro_fianca"], internetMbps: 200 }),
  // Sem caução (só seguro-fiança, pelo campo antigo).
  base({ id: "c", propertyType: "casa", totalMes: 4800, bedrooms: 3, garantiasAceitas: [], acceptsInsurance: true, comodidadesFiltro: ["garagem"], parkingSpots: 2 }),
  // Mínimo de 120 dias.
  base({ id: "d", propertyType: "studio", totalMes: 2900, minPeriodDays: 120, maxPeriodDays: 180, petsAllowed: true, internetMedida: { downloadMbps: 90, validoAte: VALIDO } }),
  // Máximo de 60 dias.
  base({ id: "e", propertyType: "kitnet", totalMes: 2100, minPeriodDays: 30, maxPeriodDays: 60, tagHomeOffice: true, comodidadesFiltro: ["lavar"] }),
  // Medição vencida: não conta como medida.
  base({ id: "f", propertyType: "apartamento", totalMes: 5600, bedrooms: 2, readyToLiveBadge: true, internetMedida: { downloadMbps: 500, validoAte: "2026-01-01T00:00:00Z" } }),
];

const contar = (f: FiltrosPainel, lista: Imovel[] = MASSA) => lista.filter((p) => passaNoPainel(p, f, AGORA)).length;
const ids = (f: FiltrosPainel) => MASSA.filter((p) => passaNoPainel(p, f, AGORA)).map((p) => p.id);

test("contagem: cada opção da folha mostra o mesmo número que o contar() dá ao aplicá-la (massa variada)", () => {
  const c = (f: FiltrosPainel) => contar(f);
  for (const o of OPCOES_PRECO) assert.equal(facetaUnica(c, V, "maxPrice", o.valor).n, contar({ ...V, maxPrice: o.valor }), o.rotulo);
  for (const o of OPCOES_QUARTOS) assert.equal(facetaUnica(c, V, "minBedrooms", o.valor).n, contar({ ...V, minBedrooms: o.valor }), o.rotulo);
  for (const o of OPCOES_ESTADIA) assert.equal(facetaUnica(c, V, "periodo", o.valor).n, contar({ ...V, periodo: o.valor }), o.rotulo);
  for (const o of OPCOES_TIPO) assert.equal(facetaUnica(c, V, "tipo", o.valor).n, contar({ ...V, tipo: o.valor }), o.rotulo);
  for (const g of ["caucao", "seguro_fianca"]) assert.equal(facetaUnica(c, V, "garantia", g).n, contar({ ...V, garantia: g }), g);
  for (const k of ["petsOnly", "homeOfficeOnly", "readyToLiveOnly", "gestorOnly"] as const) assert.equal(facetaInterruptor(c, V, k).n, contar({ ...V, [k]: true }), k);
  for (const cm of COMODIDADES_FILTRAVEIS) assert.equal(facetaComodidade(c, V, cm.chave).n, contar({ ...V, comodidades: [cm.chave] }), cm.chave);
  for (const v of faixasInternet(medicoesDaBusca(MASSA, AGORA))) assert.equal(facetaUnica(c, V, "internetMin", v).n, contar({ ...V, internetMin: v }), `${v} Mbps`);
  // E a massa é variada de verdade: as opções não dão todas o mesmo número.
  assert.deepEqual(OPCOES_PRECO.map((o) => contar({ ...V, maxPrice: o.valor })), [2, 4, 5]);
});

test("E39: Wi-Fi fora das comodidades, do painel, da URL e do alerta (?comod=wifi ignorado sem erro)", () => {
  assert.ok(!COMODIDADES_FILTRO.some((c) => (c.chave as string) === "wifi"));
  assert.ok(!COMODIDADES_FILTRAVEIS.some((c) => (c.chave as string) === "wifi"));
  assert.deepEqual(comodidadesDaUrl("wifi"), []);
  assert.deepEqual(comodidadesDaUrl("wifi,garagem"), ["garagem"]);
  // O valor antigo no estado não filtra, não conta e não aparece no resumo.
  const antigo: FiltrosPainel = { ...V, comodidades: ["wifi"] };
  assert.equal(contar(antigo), MASSA.length);
  assert.equal(contarFiltrosPainel(antigo), 0);
  assert.doesNotMatch(resumoFiltros(antigo), /Wi-Fi/);
  // Busca salva / alerta com ?comod=wifi: a chave sai na normalização e o alerta não exige nada por ela.
  assert.equal(normalizarBusca("local=Uberlândia&comod=wifi"), "local=Uberl%C3%A2ndia");
  assert.equal(normalizarBusca("comod=wifi,garagem"), "comod=garagem");
  assert.equal(imovelBateComBusca("comod=wifi", MASSA[1], undefined, AGORA), true);
  // Na tela: o painel não tem chip de Wi-Fi e a descrição livre não liga "wifi".
  const painel = ler("components/busca/painel-filtros-celular.tsx");
  assert.doesNotMatch(painel, /faceta-comodidade-wifi|"wifi"/);
  assert.doesNotMatch(ler("lib/busca/descricao-filtros.ts"), /com\.add\("wifi"\)/);
  assert.doesNotMatch(ler("app/api/busca/descricao/route.ts"), /"wifi"/);
});

test("E39 (2): o portão de publicar exige o campo estruturado de internet (Mbps; 'Não tem internet' barra), nunca texto livre", () => {
  const fatos: FatosAnuncio = {
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio", preco: 2000, garantiaOk: true, sublocacaoOk: true,
    privacidadeOk: true, documento: "approved", descricao: "Internet fibra de 500 Mbps no imóvel. ".repeat(3), selo: false, video: false,
  };
  // A descrição fala de internet, mas sem o campo estruturado o rascunho não publica.
  assert.equal(prontidaoAnuncio({ ...fatos, internetOk: false }).podePublicar, false);
  assert.equal(prontidaoAnuncio({ ...fatos, internetOk: true }).podePublicar, true);
  assert.deepEqual(prontidaoAnuncio({ ...fatos, internetOk: true, semInternet: true }).faltam, [MOTIVO_SEM_INTERNET]);
  // O servidor lê a coluna internet_mbps (e o tipo de internet do anúncio), não a descrição.
  const srv = ler("lib/anuncio/prontidao-servidor.ts");
  assert.match(srv, /f\.internetOk = \(internetPor\.get\(p\.id\) \?\? 0\) > 0/);
  assert.match(srv, /select\("id, tipo_entrada, internet_mbps"\)/);
  assert.match(srv, /f\.semInternet = true/);
});

test("E40: seção de velocidade ausente sem medição (e ?internet= ignorado); presente com uma, faixas 50/100/300", () => {
  const semMedicao = MASSA.map((p) => ({ ...p, internetMedida: undefined }));
  const m0 = medicoesDaBusca(semMedicao, AGORA);
  assert.equal(secaoInternetVisivel(m0), false);
  assert.deepEqual(faixasInternet(m0), []);
  const daUrl: FiltrosPainel = { ...V, internetMin: 100, soInternetMedida: true };
  const efetivo = filtroInternetEfetivo(m0, daUrl);
  assert.equal(efetivo.internetMin, 0);
  assert.equal(efetivo.soInternetMedida, false);
  assert.equal(contar(efetivo, semMedicao), semMedicao.length, "a lista não zera por um filtro que ninguém pode cumprir");

  const m1 = medicoesDaBusca(MASSA, AGORA);
  assert.deepEqual(m1.sort((a, b) => a - b), [90, 320], "a medição vencida (500) não conta");
  assert.equal(secaoInternetVisivel(m1), true);
  assert.deepEqual(faixasInternet(m1), [50, 100, 300]);
  assert.deepEqual([50, 100, 300].map((v) => ids({ ...V, internetMin: v })), [["a", "d"], ["a"], ["a"]]);
  // Só UMA medição na base já mostra a seção.
  assert.equal(secaoInternetVisivel(medicoesDaBusca([MASSA[3]], AGORA)), true);
  // Fonte: a /buscar zera o filtro da URL sem medição, e a folha não mostra a seção.
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.match(busca, /if \(!secaoInternetVisivel\(medicoes\) && \(internetMin > 0 \|\| soInternetMedida\)\) \{\s+setInternetMin\(0\);\s+setSoInternetMedida\(false\);/);
  assert.match(ler("components/busca/painel-filtros-celular.tsx"), /const internetVisivel = secaoInternetVisivel\(medicoes\);/);
});

test("E41: caução e estadia filtram de verdade (sem caução; mínimo de 120 dias; máximo de 60)", () => {
  // Caução: o "c" só aceita seguro-fiança.
  assert.equal(aceitaGarantia(MASSA[2], "caucao"), false);
  assert.deepEqual(ids({ ...V, garantia: "caucao" }), ["a", "d", "e", "f"]);
  assert.deepEqual(ids({ ...V, garantia: "seguro_fianca" }), ["b", "c"]);
  // Estadia: o "d" (mínimo 120) não serve para 1–2 meses; o "e" (máximo 60) não serve para 3–4 nem 5–6.
  assert.equal(cabeNaEstadia(MASSA[3], 60), false);
  assert.equal(cabeNaEstadia(MASSA[4], 120), false);
  assert.deepEqual(ids({ ...V, periodo: 60 }), ["a", "b", "c", "e", "f"]);
  assert.deepEqual(ids({ ...V, periodo: 120 }), ["a", "b", "c", "d", "f"]);
  assert.deepEqual(ids({ ...V, periodo: 180 }), ["a", "b", "c", "d", "f"]);
});

test("E42: tipos sem imóvel mostram '· 0', ficam desativados e não somem; o já escolhido continua clicável", () => {
  const c = (f: FiltrosPainel) => contar(f);
  for (const tipo of ["loft", "cobertura", "casa_condominio", "flat", "quarto", "chacara"]) {
    const o = OPCOES_TIPO.find((x) => x.valor === tipo);
    assert.ok(o, `${tipo} continua na lista de tipos`);
    assert.deepEqual(facetaUnica(c, V, "tipo", tipo), { n: 0, desabilitado: true }, tipo);
    // Escolhido (veio da URL): 0, mas clicável para desligar — nunca um beco sem saída.
    assert.deepEqual(facetaUnica(c, { ...V, tipo }, "tipo", tipo), { n: 0, desabilitado: false }, tipo);
  }
  // O rodapé (E15): "Limpar tudo" sempre existe e o botão de aplicar nunca abre lista vazia.
  const painel = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(painel, /data-testid="limpar-tudo"/);
  assert.match(painel, /disabled=\{n === 0 && extras === 0\}/);
  // E105: os tipos moram só na pílula "Tipo", com a contagem "· n" e desabilitados em 0.
  assert.doesNotMatch(painel, /OPCOES_TIPO/);
  assert.match(ler("components/busca/barra-pilulas.tsx"), /OPCOES_TIPO\.map\(\(o\) => \{\s+const fc = facetaUnica\(p\.contar, f, "tipo", o\.valor\);\s+return opcao\(o\.valor, f\.tipo === o\.valor, fc\.n, fc\.desabilitado/);
});

test("E43 (6): seguro-fiança é um filtro só — seguroOnly saiu do painel; ?seguro=1 (URL e buscas salvas) vira garantia", () => {
  // O campo antigo (nada mais o liga) é só apelido da garantia: MESMO critério e conta 1, nunca um segundo filtro.
  assert.deepEqual(ids({ ...V, seguroOnly: true }), ids({ ...V, garantia: "seguro_fianca" }));
  assert.equal(contarFiltrosPainel({ ...V, seguroOnly: true }), 1);
  assert.equal(contarFiltrosPainel({ ...V, garantia: "seguro_fianca" }), 1);
  assert.equal(contarFiltrosPainel({ ...V, garantia: "seguro_fianca", seguroOnly: true }), 1, "os dois juntos contam 1");
  // Migração no parser.
  assert.equal(seguroDaUrlLegada("", "1"), "seguro_fianca");
  assert.equal(seguroDaUrlLegada("caucao", "1"), "caucao", "a garantia escolhida vence");
  assert.equal(seguroDaUrlLegada(null, null), "");
  assert.equal(normalizarBusca("local=Centro&seguro=1"), "local=Centro&garantia=seguro_fianca");
  assert.equal(normalizarBusca("garantia=caucao&seguro=1"), "garantia=caucao");
  // Busca salva antiga continua alertando, com o critério do chip (garantias do anúncio, não só o campo antigo).
  assert.equal(imovelBateComBusca("seguro=1", MASSA[1], undefined, AGORA), true, "b: seguro_fianca nas garantias");
  assert.equal(imovelBateComBusca("seguro=1", MASSA[2], undefined, AGORA), true, "c: campo antigo acceptsInsurance");
  assert.equal(imovelBateComBusca("seguro=1", MASSA[0], undefined, AGORA), false, "a: só caução");
  // Fonte: nenhum estado/chip de seguro à parte na /buscar; a URL não volta a escrever ?seguro.
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.doesNotMatch(busca, /insuranceOnly|seguroOnly/);
  assert.match(busca, /params\.delete\("seguro"\)/);
  assert.doesNotMatch(ler("components/busca/painel-filtros-celular.tsx"), /seguroOnly/);
});

test("E43 (7): Pronto para Morar é um estado só (readyToLiveOnly) — chip e filtro ativo sincronizados, mesmo rótulo, conta 1", () => {
  assert.equal(contarFiltrosPainel({ ...V, readyToLiveOnly: true }), 1);
  assert.deepEqual(ids({ ...V, readyToLiveOnly: true }), ["a", "f"]);
  assert.match(resumoFiltros({ ...V, readyToLiveOnly: true }), /^Pronto para Morar$/);
  const busca = ler("app/(public)/buscar/search-client.tsx");
  const painel = ler("components/busca/painel-filtros-celular.tsx");
  // O chip da folha e o chip ativo da linha de filtros leem e escrevem o MESMO estado, com o mesmo rótulo.
  assert.match(painel, /ativo=\{rascunho\.readyToLiveOnly\} onClick=\{\(\) => muda\("readyToLiveOnly", !rascunho\.readyToLiveOnly\)\} testId="faceta-pronto">\s+Pronto para Morar/);
  // E82-A: a fileira de chips ativos saiu da /buscar (a linha de pílulas mostra os valores e "Mais filtros (N)" conta o
  // resto); o Pronto para Morar continua um estado só, limpo pela mesma chave da folha.
  assert.doesNotMatch(busca, /<ActiveChip /);
  assert.match(busca, /else if \(chave === "readyToLiveOnly"\) setReadyToLiveOnly\(false\);/);
  assert.match(busca, /setReadyToLiveOnly\(f\.readyToLiveOnly\);/);
  assert.match(busca, /put\("pronto", readyToLiveOnly, "1"\)/);
  // Uma vez só na contagem de filtros ativos da /buscar.
  assert.equal((busca.match(/readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, operatedOnly\]/g) ?? []).length, 1);
});
