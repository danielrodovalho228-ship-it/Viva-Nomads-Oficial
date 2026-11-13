/*
  E814 — título com termo de nível ("premium", "conforto") diferente do nível calculado: o ube-002 ("Studio premium")
  e o ube-014 ("… 3 quartos premium") são Essencial. Exemplos corrigidos; no fluxo real, o editor avisa e o servidor recusa.
  Roda: node --test src/lib/anuncio/e814-titulo-nivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { erroTituloNivel, termoDeNivelDivergente } from "./titulo-nivel.ts";
import { avisosConsistenciaTitulo } from "./titulo-bairro.ts";

test("nenhum exemplo usa no título um termo de nível diferente do nível calculado", () => {
  for (const p of SAMPLE_PROPERTIES) assert.equal(termoDeNivelDivergente(p.title, p.nivel), null, `${p.id}: ${p.title} (${p.nivel})`);
  assert.equal(SAMPLE_PROPERTIES.find((p) => p.id === "ube-002")!.title, "Studio no Centro, ideal para estadia profissional");
});

test("a regra: premium só com Premium, conforto só com Conforto; 'confortável' não é termo de nível", () => {
  assert.deepEqual(termoDeNivelDivergente("Studio premium no Centro", "essencial"), { termo: "premium", nivelDoTermo: "premium" });
  assert.equal(termoDeNivelDivergente("Studio Premium no Centro", "premium"), null);
  assert.deepEqual(termoDeNivelDivergente("Casa conforto total", "essencial"), { termo: "conforto", nivelDoTermo: "conforto" });
  assert.equal(termoDeNivelDivergente("Casa com conforto", "conforto"), null);
  assert.equal(termoDeNivelDivergente("Studio confortável no Centro", "essencial"), null);
  assert.equal(termoDeNivelDivergente("Studio no Centro", "essencial"), null);
  // Sem nível calculado (novo, em adequação): nenhum termo de nível.
  assert.ok(termoDeNivelDivergente("Studio premium", null));
  assert.ok(termoDeNivelDivergente("Studio premium", "em_adequacao"));
  assert.equal(erroTituloNivel("Studio premium no Centro", "essencial"), 'O título diz "premium", mas o nível do anúncio é Essencial. O nível é calculado pela Viva: tire "premium" do título.');
});

test("o editor e o assistente avisam (bloco de consistência do título)", () => {
  assert.ok(avisosConsistenciaTitulo("Studio premium no Centro", { bairro: "Centro" }).some((a) => a.startsWith('O título diz "premium"')));
  assert.ok(!avisosConsistenciaTitulo("Studio no Centro", { bairro: "Centro" }).some((a) => a.includes("nível")));
});

test("o servidor recusa ao criar e ao salvar (nível lido de imovel_nivel)", () => {
  const acoes = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  const criar = acoes.slice(acoes.indexOf("export async function createProperty"), acoes.indexOf("export async function", acoes.indexOf("export async function createProperty") + 10));
  assert.match(criar, /const erroNivelNovo = erroTituloNivel\(input\.title \?\? "", null\);\s*if \(erroNivelNovo\) return \{ ok: false, error: erroNivelNovo \};/);
  const salvar = acoes.slice(acoes.indexOf("export async function updateProperty"));
  assert.match(salvar, /from\("imovel_nivel"\)\.select\("nivel"\)\.eq\("property_id", id\)[\s\S]{0,200}if \(erroNivel\) return \{ ok: false, error: erroNivel \};/);
});
