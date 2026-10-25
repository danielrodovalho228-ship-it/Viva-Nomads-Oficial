/*
  FILTROS-2 — composição da folha de filtros da /buscar: o que é item do padrão mínimo de 12 itens é GARANTIA, não chip.
  Roda: node --test src/lib/busca/garantia-minima.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITENS_CONFORTO } from "../../config/conforto-minimo.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { COMODIDADES_FILTRAVEIS, COMODIDADE_DO_MINIMO, comodidadesDaUrl, passaComodidades } from "./filtro-comodidades.ts";
import { FILTROS_PAINEL_VAZIOS, passaNoPainel, type FiltrosPainel } from "./painel-filtros.ts";
import { TEXTO_GARANTIA_MINIMA, cumpreGarantiaMinima } from "./garantia-minima.ts";

const folha = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
const busca = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");

/**
 * A composição da folha, chip a chip, e por quê. Item do mínimo → linha de garantia; o resto → filtro.
 * (Garagem e Máquina de lavar não são do mínimo: o mínimo pede ACESSO a uma máquina, no imóvel ou no prédio; o chip
 * pede máquina no imóvel.)
 */
const COMPOSICAO: { chip: string; testId: string; porque: string }[] = [
  { chip: "Quartos", testId: "faceta-quartos-", porque: "não é item do mínimo" },
  { chip: "Estadia", testId: "faceta-estadia-", porque: "não é item do mínimo" },
  { chip: "Aceita pets / porte", testId: "faceta-pets", porque: "não é item do mínimo" },
  { chip: "Para trabalhar de casa", testId: "faceta-home-office", porque: "não é item do mínimo" },
  { chip: "Pronto para Morar", testId: "faceta-pronto", porque: "selo, não item do mínimo" },
  { chip: "Internet medida a partir de", testId: "faceta-internet-", porque: "velocidade MEDIDA, além do mínimo (que pede a internet informada)" },
  { chip: "Contrato (caução, seguro-fiança, gestor)", testId: "faceta-garantia-", porque: "não é item do mínimo" },
  { chip: "Garagem", testId: "faceta-comodidade-${c.chave}", porque: "não é item do mínimo" },
];

test("Wi-Fi e Cozinha equipada saem da folha (itens do mínimo); Garagem e Máquina de lavar ficam", () => {
  assert.deepEqual(COMODIDADES_FILTRAVEIS.map((c) => c.chave), ["garagem", "lavar"]);
  // Cada comodidade garantida aponta para um item real da lista de 12.
  const chaves = new Set(ITENS_CONFORTO.map((i) => i.chave));
  for (const item of Object.values(COMODIDADE_DO_MINIMO)) assert.ok(chaves.has(item as never), item);
  assert.match(folha, /COMODIDADES_FILTRAVEIS\.map/);
  assert.doesNotMatch(folha, /COMODIDADES_FILTRO\.map/);
  for (const c of COMPOSICAO) assert.ok(folha.includes(c.testId), `${c.chip} (${c.porque})`);
});

test("a linha de garantia aparece na folha, curta, com a contagem real da lista", () => {
  assert.equal(ITENS_CONFORTO.length, 12);
  assert.equal(TEXTO_GARANTIA_MINIMA, "Padrão mínimo Viva em todos os imóveis: internet Wi-Fi, cozinha equipada e mais 10 itens.");
  assert.match(folha, /data-testid="painel-garantia-minima"/);
  assert.match(folha, /\{TEXTO_GARANTIA_MINIMA\.split\(/);
});

test("links e buscas salvas antigos com wifi/cozinha não filtram (garantia) e o resto segue igual", () => {
  assert.deepEqual(comodidadesDaUrl("wifi,cozinha"), []);
  assert.deepEqual(comodidadesDaUrl("wifi,garagem"), ["garagem"]);
  const semNada = { comodidadesFiltro: [] as string[] };
  assert.equal(passaComodidades(semNada, ["wifi", "cozinha"]), true, "garantida não tira ninguém");
  assert.equal(passaComodidades(semNada, ["garagem"]), false, "filtro de verdade continua filtrando");
});

test("anúncio em adequação nunca aparece nos resultados — nenhum filtro o traz de volta", () => {
  assert.equal(cumpreGarantiaMinima({ nivel: "em_adequacao" }), false);
  assert.equal(cumpreGarantiaMinima({ nivel: "essencial" }), true);
  assert.equal(cumpreGarantiaMinima({ nivel: null }), true);
  // A regra roda na BASE da busca, antes dos filtros da folha (então nenhuma combinação de chips o devolve).
  const base = busca.slice(busca.indexOf("const list = properties.filter("), busca.indexOf("return { base: list, dist }"));
  assert.match(base, /if \(!cumpreGarantiaMinima\(p\)\) return false;/);
  // Fora da base, nenhum filtro (vazio ou cheio) passa a ver o anúncio em adequação.
  const emAdequacao = { ...(SAMPLE_PROPERTIES[0] as object), nivel: "em_adequacao" } as Parameters<typeof passaNoPainel>[0] & { nivel: string };
  for (const f of [{}, { comodidades: ["wifi"] }, { comodidades: ["cozinha"] }] as Partial<FiltrosPainel>[]) {
    const ve = [emAdequacao].filter(cumpreGarantiaMinima).filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, ...f })).length;
    assert.equal(ve, 0);
  }
});
