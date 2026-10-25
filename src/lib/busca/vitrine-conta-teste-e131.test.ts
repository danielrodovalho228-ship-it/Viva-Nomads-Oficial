/* Roda: node --test src/lib/busca/vitrine-conta-teste-e131.test.ts
   E131 (escalada 25/10): a /buscar em produção mostrava "1 imóvel em Uberlândia" — só o RETESTE. Causa-raiz: o RETESTE é
   de uma CONTA DE TESTE (profiles.is_teste) mas o título não tem a marca "[TESTE]"; a vitrine só tirava os de título
   marcado, então ele contava como imóvel real e a regra do Prompt 30 (com imóvel real na busca, os exemplos saem)
   escondia os ~15 exemplos. Correção: anúncio de conta de teste é anúncio de teste na vitrine (a mesma regra do
   ranking, ranking/sinais). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { semAnunciosDeContaTeste, semAnunciosDeTeste } from "../data/anuncio-teste.ts";
import { baseDaBusca, contarNaBase } from "./exemplos-e-pedido.ts";

type Linha = { id: string; title: string; ownerId: string | null; pronto: boolean };
const ehEx = (p: { id: string }) => p.id.startsWith("ube-");
const exemplos: Linha[] = Array.from({ length: 15 }, (_, i) => ({ id: `ube-${String(i + 1).padStart(3, "0")}`, title: `Exemplo ${i}`, ownerId: null, pronto: i % 2 === 0 }));
const reteste: Linha = { id: "r-1", title: "Studio Centro RETESTE", ownerId: "dono-teste", pronto: true };
const marcados: Linha[] = [
  { id: "t-1", title: "[TESTE QA] Apto", ownerId: "dono-teste", pronto: true },
  { id: "t-2", title: "[TESTE] Casa", ownerId: "dono-teste", pronto: false },
];
const real: Linha = { id: "real-1", title: "Apartamento no Centro", ownerId: "dono-real", pronto: true };
const vitrine = (linhas: Linha[], donosTeste: string[]) => [...semAnunciosDeContaTeste(semAnunciosDeTeste(linhas), new Set(donosTeste)), ...exemplos];

test("produção de 25/10: os 3 ativos são de conta de teste → a vitrine volta a ter os 15 exemplos (antes: 1)", () => {
  const lista = vitrine([reteste, ...marcados], ["dono-teste"]);
  const base = baseDaBusca(lista, ehEx);
  assert.equal(contarNaBase(base, () => true), 15);
  assert.ok(!base.some((p) => p.id === "r-1"), "o RETESTE não aparece ao visitante");
  // Lista e contagens da MESMA base: a faceta conta dentro da lista.
  assert.equal(contarNaBase(base, (p) => p.pronto), 8);
});

test("sem a regra da conta de teste, o RETESTE derrubava os exemplos (o defeito reproduzido)", () => {
  const antes = [...semAnunciosDeTeste([reteste, ...marcados]), ...exemplos];
  assert.equal(contarNaBase(baseDaBusca(antes, ehEx), () => true), 1);
});

test("com imóvel REAL publicado, a regra do Prompt 30 continua: os exemplos saem e o real fica", () => {
  const base = baseDaBusca(vitrine([real, reteste], ["dono-teste"]), ehEx);
  assert.deepEqual(base.map((p) => p.id), ["real-1"]);
});

test("sem contas de teste conhecidas (falha na leitura), nada muda além da marca do título", () => {
  assert.deepEqual(semAnunciosDeContaTeste([reteste, real], new Set()).map((p) => p.id), ["r-1", "real-1"]);
});

test("a vitrine pública (busca, home, cidades, página do proprietário) filtra pela conta de teste, nas linhas do banco", () => {
  const s = readFileSync(new URL("../data/properties.ts", import.meta.url), "utf8");
  assert.equal((s.match(/await semAnunciosDeTesteNaVitrine\(data as unknown as PropertyRow\[\]\)/g) ?? []).length, 2, "listProperties e listPropertiesDoProprietario");
  assert.match(s, /\.from\("profiles"\)\.select\("id"\)\.in\("id", donos\)\.eq\("is_teste", true\)/, "só os ids das contas de teste");
  assert.doesNotMatch(s, /ownerId: row\.owner_id/, "o owner_id não vai para o Property público");
});
