/*
  E580 — o filtro "Preço justo" não existia na busca apesar do merge do E572 (#2535), e o selo aparecia nos cards.
  Investigação: o #2535 entrou só com a LÓGICA (estado, URL, contagem, resumo), toda atrás da chave
  PRECO_JUSTO_COMPARADOR (E399-C, desligada); o controle no painel ficou "para a Pista A" e nunca foi feito. Já o selo
  do card NÃO depende da chave: com ela desligada vem da coluna properties.preco_justo (0130/0277); nos exemplos, do
  cálculo do exemplo; só com ela ligada vem do motor (dados simulados). Por isso: selo no card, filtro em lugar nenhum.

  Correção: o filtro lê o MESMO campo do card (Property.precoJusto), sem chave. Mora no grupo "Contrato", ao lado dos
  outros selos/declarações ("Aceita negociação", nota fiscal), com a contagem das facetas: o número é o de imóveis da
  busca com o selo; com 0 o chip fica desabilitado (padrão das facetas), nunca some.
  Chave desligada: o filtro aparece e conta o selo que os cards mostram (regra da coluna); o motor simulado segue fora.
  Roda: node --test src/lib/busca/e580-filtro-preco-justo-visivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, type FiltrosPainel, contarFiltrosPainel, filtroPrecoJustoLigado, passaNoPainel, passaPrecoJusto, resumoFiltros } from "./painel-filtros.ts";
import { facetaInterruptor } from "./facetas.ts";
import { PRECO_JUSTO_COMPARADOR } from "../flags.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const base = { id: "a", monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false } as unknown as Parameters<typeof passaNoPainel>[0];
const comSelo = { ...base, precoJusto: true };
const semSelo = { ...base, precoJusto: false };
const FILTRO = { ...FILTROS_PAINEL_VAZIOS, precoJustoOnly: true };

test("com a chave DESLIGADA (como em produção) o filtro vale: só passa quem tem o selo do card", () => {
  assert.equal(PRECO_JUSTO_COMPARADOR, false);
  assert.equal(filtroPrecoJustoLigado(FILTRO), true);
  assert.equal(passaNoPainel(comSelo, FILTRO), true);
  assert.equal(passaNoPainel(semSelo, FILTRO), false);
  assert.equal(passaNoPainel(base, FILTRO), false, "sem dado de selo, sem selo");
  assert.equal(passaPrecoJusto(semSelo, FILTROS_PAINEL_VAZIOS), true, "filtro não escolhido não tira ninguém");
  assert.equal(contarFiltrosPainel(FILTRO), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 1);
  assert.match(resumoFiltros(FILTRO), /Preço justo/);
});

test("contador = imóveis com o selo; com 0 fica desabilitado (não some); ligado continua clicável", () => {
  const lista = [comSelo, semSelo, { ...comSelo, id: "b" }];
  const contar = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f)).length;
  assert.deepEqual(facetaInterruptor(contar, FILTROS_PAINEL_VAZIOS, "precoJustoOnly"), { n: 2, desabilitado: false });
  const semNenhum = (f: FiltrosPainel) => [semSelo].filter((p) => passaNoPainel(p, f)).length;
  assert.deepEqual(facetaInterruptor(semNenhum, FILTROS_PAINEL_VAZIOS, "precoJustoOnly"), { n: 0, desabilitado: true });
  assert.deepEqual(facetaInterruptor(semNenhum, FILTRO, "precoJustoOnly"), { n: 0, desabilitado: false });
});

test("o filtro não depende mais da chave em lugar nenhum (painel e /buscar)", () => {
  const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(semComentarios(ler("src/lib/busca/painel-filtros.ts")), /PRECO_JUSTO_COMPARADOR/);
  const busca = ler("src/app/(public)/buscar/search-client.tsx");
  assert.doesNotMatch(busca, /PRECO_JUSTO_COMPARADOR/);
  assert.match(busca, /if \(on\("precojusto"\)\) setPrecoJustoOnly\(true\);/);
  assert.match(busca, /put\("precojusto", precoJustoOnly, "1"\);/);
  assert.match(busca, /setPrecoJustoOnly\(f\.precoJustoOnly \?\? false\);/);
});

test("o chip existe no grupo Contrato do painel, com a faceta e o mesmo nome do selo", () => {
  const folha = ler("src/components/busca/painel-filtros-celular.tsx");
  const contrato = folha.slice(folha.indexOf('<Grupo titulo="Contrato"'), folha.indexOf('<Grupo titulo="Comodidades"'));
  assert.match(contrato, /facetaInterruptor\(contar, rascunho, "precoJustoOnly"\)/);
  assert.match(contrato, /testId="faceta-selo-preco-justo"/);
  assert.match(contrato, /Preço justo/);
});

test("o card e o filtro leem o mesmo campo: Property.precoJusto (coluna sem a chave, motor com a chave, exemplo calculado)", () => {
  // E811: o cartão lê a fonte única dos selos (a mesma da página).
  assert.match(ler("src/components/property-card.tsx"), /\.\.\.simbolosDoImovel\(property\)/);
  assert.match(ler("src/lib/cartao-selos-foto.ts"), /precoJusto: !!p\.precoJusto/);
  const dados = ler("src/lib/data/properties.ts");
  assert.match(dados, /p\.precoJusto = r\?\.preco_justo === true;/);
  assert.match(dados, /p\.precoJusto = decidirSelo\(entrada, agora\)\.selo;/);
  assert.match(ler("src/lib/properties.ts"), /for \(const p of SAMPLE_PROPERTIES\) p\.precoJusto = /);
});
