/*
  Prompt 57, fase 2 — filtro "internet medida" na busca: lista, linha "Mais N… não medida", contagem, alerta e pedido.
  Roda: node --experimental-strip-types --test src/lib/busca/filtro-internet.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHIPS_INTERNET,
  filtroInternetDaUrl,
  filtroInternetNaUrl,
  informadaNaoMedida,
  passaInternet,
  rotuloFiltroInternet,
  rotuloVerNaoMedidos,
  textoMaisNaoMedidos,
} from "./filtro-internet.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, naoMedidosDoPainel, passaNoPainel, resumoFiltros, rotuloMostrar } from "./painel-filtros.ts";
import { imovelBateComBusca, type ImovelParaAlerta } from "./alerta-busca.ts";
import { normalizarBusca, resumoDaBusca } from "./buscas-salvas.ts";
import { textoInternetPedido, validarCamposNovos } from "../pedidos/campos.ts";

const AGORA = new Date("2026-10-22T12:00:00Z");
const valida = (downloadMbps: number) => ({ downloadMbps, validoAte: "2027-03-01T00:00:00Z" });
const vencida = (downloadMbps: number) => ({ downloadMbps, validoAte: "2026-10-01T00:00:00Z" });

const base = { monthlyPrice: 2000, bedrooms: 1, tagHomeOffice: true, petsAllowed: false };
type Imovel = { id: string; monthlyPrice: number; bedrooms: number; tagHomeOffice: boolean; petsAllowed: boolean; internetMbps?: number; internetMedida?: { downloadMbps: number; validoAte: string } };
const imoveis: Imovel[] = [
  { id: "m320", ...base, internetMedida: valida(320) },
  { id: "m120", ...base, internetMedida: valida(120), internetMbps: 500 },
  { id: "m80", ...base, internetMedida: valida(80), internetMbps: 500 }, // medido abaixo: não volta pelo informado
  { id: "i500", ...base, internetMbps: 500 }, // só informado
  { id: "i60", ...base, internetMbps: 60 },
  { id: "venc", ...base, internetMedida: vencida(400), internetMbps: 300 }, // medição vencida = não medida
  { id: "nada", ...base }, // sem informação nenhuma
  { id: "caro", ...base, monthlyPrice: 9000, internetMbps: 500 }, // reprova em outro filtro
];
const ids = (l: { id: string }[]) => l.map((p) => p.id);
const lista = (f: typeof FILTROS_PAINEL_VAZIOS) => imoveis.filter((p) => passaNoPainel(p, f, AGORA));

test("chips da busca: 50 · 100 · 300 Mbps", () => {
  assert.deepEqual([...CHIPS_INTERNET], [50, 100, 300]);
});

test("filtro desligado: a busca não muda e não há linha de não medidos", () => {
  assert.equal(lista(FILTROS_PAINEL_VAZIOS).length, imoveis.length);
  assert.deepEqual(naoMedidosDoPainel(imoveis, FILTROS_PAINEL_VAZIOS, AGORA), []);
  assert.equal(contarFiltrosPainel(FILTROS_PAINEL_VAZIOS), 0);
  for (const p of imoveis) assert.ok(passaInternet(p, { internetMin: 0, soInternetMedida: false }, AGORA));
});

test("100 Mbps: só medição válida que passa; o resto informado vai para a linha 'não medida'", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, internetMin: 100 };
  assert.deepEqual(ids(lista(f)), ["m320", "m120"]);
  assert.deepEqual(ids(naoMedidosDoPainel(imoveis, f, AGORA)), ["i500", "venc", "caro"]);
  // Nenhum imóvel some por não ter testado: todo informado ≥ 100 aparece em uma das duas listas.
  assert.ok(informadaNaoMedida(imoveis[3], f, AGORA));
  assert.ok(!informadaNaoMedida(imoveis[2], f, AGORA), "medido abaixo não volta pelo informado");
  assert.ok(!informadaNaoMedida(imoveis[4], f, AGORA), "informado abaixo do valor não entra");
  assert.ok(!informadaNaoMedida(imoveis[6], f, AGORA), "sem informação não entra");
  assert.equal(contarFiltrosPainel(f), 1);
});

test("só com internet medida (sem valor): qualquer medição válida; não medidos = qualquer internet informada", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, homeOfficeOnly: true, soInternetMedida: true };
  assert.deepEqual(ids(lista(f)), ["m320", "m120", "m80"]);
  assert.deepEqual(ids(naoMedidosDoPainel(imoveis, f, AGORA)), ["i500", "i60", "venc", "caro"]);
});

test("não medidos respeitam os outros filtros (preço)", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, internetMin: 50, maxPrice: 3000 };
  assert.ok(!ids(naoMedidosDoPainel(imoveis, f, AGORA)).includes("caro"));
});

test("contagem 'Mostrar N imóveis' = tamanho da lista principal (medidos)", () => {
  for (const internetMin of [0, 50, 100, 300]) {
    const f = { ...FILTROS_PAINEL_VAZIOS, internetMin };
    const n = imoveis.filter((p) => passaNoPainel(p, f, AGORA)).length;
    assert.equal(rotuloMostrar(n), n === 0 ? "Nenhum imóvel com esses filtros" : `Mostrar ${n} ${n === 1 ? "imóvel" : "imóveis"}`);
    assert.equal(n, lista(f).length);
  }
  // 300: um medido; os informados ≥ 300 ficam na linha de baixo.
  const f300 = { ...FILTROS_PAINEL_VAZIOS, internetMin: 300 };
  assert.equal(lista(f300).length, 1);
  assert.equal(naoMedidosDoPainel(imoveis, f300, AGORA).length, 3);
});

test("textos: linha do fim da lista, chip ativo e resumo", () => {
  assert.equal(textoMaisNaoMedidos(1), "Mais 1 imóvel com internet informada, mas não medida");
  assert.equal(textoMaisNaoMedidos(4), "Mais 4 imóveis com internet informada, mas não medida");
  assert.equal(rotuloVerNaoMedidos(3), "Ver 3 com internet não medida");
  assert.equal(rotuloFiltroInternet({ internetMin: 100, soInternetMedida: true }), "Internet medida 100+ Mbps");
  assert.equal(rotuloFiltroInternet({ internetMin: 0, soInternetMedida: true }), "Internet medida");
  assert.equal(rotuloFiltroInternet({ internetMin: 0, soInternetMedida: false }), null);
  assert.match(resumoFiltros({ ...FILTROS_PAINEL_VAZIOS, internetMin: 300 }), /Internet medida 300\+ Mbps/);
});

test("URL: só 50/100/300; ida e volta", () => {
  assert.deepEqual(filtroInternetDaUrl(new URLSearchParams("internet=100&medida=1")), { internetMin: 100, soInternetMedida: true });
  assert.deepEqual(filtroInternetDaUrl(new URLSearchParams("internet=75")), { internetMin: 0, soInternetMedida: false });
  const p = new URLSearchParams("local=Uberlândia&internet=50");
  filtroInternetNaUrl(p, { internetMin: 300, soInternetMedida: false });
  assert.equal(p.toString(), "local=Uberl%C3%A2ndia&internet=300");
  filtroInternetNaUrl(p, { internetMin: 0, soInternetMedida: false });
  assert.equal(p.has("internet"), false);
});

test("alerta de busca aceita o mesmo filtro: sem medição válida, não alerta", () => {
  const im: ImovelParaAlerta = {
    id: "a", title: "Apto", city: "Uberlândia", neighborhood: "Centro", propertyType: "Apartamento",
    monthlyPrice: 2000, bedrooms: 1, minPeriodDays: 30, tagHomeOffice: true,
  };
  const q = normalizarBusca("local=Uberlândia&internet=100");
  assert.match(q, /internet=100/);
  assert.ok(imovelBateComBusca(q, { ...im, internetMedida: valida(150) }, undefined, AGORA));
  assert.ok(!imovelBateComBusca(q, { ...im, internetMedida: valida(90) }, undefined, AGORA));
  assert.ok(!imovelBateComBusca(q, { ...im, internetMbps: 500 }, undefined, AGORA), "só informado não alerta");
  assert.ok(!imovelBateComBusca(q, { ...im, internetMedida: vencida(500) }, undefined, AGORA));
  assert.ok(imovelBateComBusca("local=Uberlândia", { ...im }, undefined, AGORA), "sem o filtro, nada muda");
  assert.match(resumoDaBusca("local=Uberlândia&internet=300"), /internet medida 300\+ Mbps/);
  assert.match(resumoDaBusca("local=Uberlândia&homeoffice=1&medida=1"), /internet medida$/);
});

test("pedido de moradia aceita o mesmo filtro (50/100/300) e o dono lê 'Internet medida 100+ Mbps'", () => {
  const ctx = { orcamentoMax: 3000, pets: false };
  const ok = validarCamposNovos({ internetMinMbps: 100 }, ctx);
  assert.ok(ok.ok && ok.valor.internetMinMbps === 100);
  const vazio = validarCamposNovos({}, ctx);
  assert.ok(vazio.ok && vazio.valor.internetMinMbps === null);
  assert.deepEqual(validarCamposNovos({ internetMinMbps: 75 }, ctx), { ok: false, erro: "Escolha a internet medida mínima." });
  assert.equal(textoInternetPedido(100), "Internet medida 100+ Mbps");
  assert.equal(textoInternetPedido(null), null);
});
