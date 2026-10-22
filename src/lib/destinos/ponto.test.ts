/*
  Correção do /admin/destinos (22/10): ponto do destino pela busca no mapa ou colado pelo admin.
  Roda: node --experimental-strip-types --test src/lib/destinos/ponto.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { consultaDoPonto, pontoColado, pontoNoBrasil, pontosDoGoogle, pontosDoOsm } from "./ponto.ts";

test("colar 'lat, lng' (formato do Google Maps) preenche os dois campos", () => {
  assert.deepEqual(pontoColado("-18.918600, -48.277200"), { lat: "-18.918600", lng: "-48.277200" });
  assert.deepEqual(pontoColado(" -18.9186 -48.2772 "), { lat: "-18.9186", lng: "-48.2772" });
  assert.deepEqual(pontoColado("-18,9186; -48,2772"), { lat: "-18.9186", lng: "-48.2772" });
  assert.deepEqual(pontoColado("-18,9186 -48,2772"), { lat: "-18.9186", lng: "-48.2772" });
});

test("o que não é um par de coordenadas no Brasil fica como digitado", () => {
  assert.equal(pontoColado("-18.9186"), null);
  assert.equal(pontoColado("-18,9186"), null); // vírgula decimal sozinha: é só a latitude
  assert.equal(pontoColado("48.85, 2.35"), null); // Paris
  assert.equal(pontoColado("HC-UFU"), null);
  assert.ok(pontoNoBrasil(-18.9, -48.2));
  assert.ok(!pontoNoBrasil(0, 0));
});

test("busca leva a cidade e a UF do formulário, sem repetir a cidade", () => {
  assert.equal(consultaDoPonto("  Hospital de Clínicas  ", "Uberlândia", "mg"), "Hospital de Clínicas, Uberlândia, MG");
  assert.equal(consultaDoPonto("UFU Umuarama Uberlândia", "Uberlândia", "MG"), "UFU Umuarama Uberlândia, MG");
});

test("Google Places: nome + endereço, só dentro do Brasil, no máximo 5", () => {
  const r = pontosDoGoogle({
    status: "OK",
    results: [
      { place_id: "a", name: "Lugar A", formatted_address: "Rua X, Uberlândia - MG", geometry: { location: { lat: -18.91234567, lng: -48.27654321 } } },
      { place_id: "b", name: "Fora", geometry: { location: { lat: 48.85, lng: 2.35 } } },
      { name: "Sem id", geometry: { location: { lat: -18.9, lng: -48.2 } } },
    ],
  });
  assert.deepEqual(r, [{ id: "g:a", rotulo: "Lugar A — Rua X, Uberlândia - MG", lat: -18.912346, lng: -48.276543 }]);
  assert.deepEqual(pontosDoGoogle({ status: "REQUEST_DENIED" }), []);
  assert.deepEqual(pontosDoGoogle(null), []);
});

test("OpenStreetMap: display_name e lat/lon em texto viram número", () => {
  const r = pontosDoOsm([
    { place_id: 1, display_name: "Lugar B, Uberlândia, MG", lat: "-18.88", lon: "-48.25" },
    { place_id: 2, display_name: "Fora", lat: "40.7", lon: "-74" },
  ]);
  assert.deepEqual(r, [{ id: "osm:1", rotulo: "Lugar B, Uberlândia, MG", lat: -18.88, lng: -48.25 }]);
  assert.deepEqual(pontosDoOsm({ error: "x" }), []);
});

test("salvar e listar com o cliente de serviço DEPOIS do portão do admin (a RLS recusava o admin sem aal2 na sessão)", () => {
  const acoes = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /if \(!\(perfil\?\.role === "admin" && \(await sessaoAal2\(supabase\)\)\)\) return null;/);
  assert.match(acoes, /return \{ db: createAdminClient\(\) \?\? supabase, userId: user\.id \};/);
  assert.doesNotMatch(acoes, /adm\.supabase\.from\("destinos"\)/);
  // A busca do ponto também passa pelo portão; no laboratório nada sai para a rede.
  assert.match(acoes, /export async function buscarPontoDestino[\s\S]*?if \(!\(await exigirAdmin\(\)\)\) return/);
  assert.match(acoes, /if \(integracoesSimuladas\(\)\)/);
  const pagina = readFileSync(new URL("../../app/(dashboard)/admin/destinos/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /const leitor = createAdminClient\(\) \?\? supabase;/);
});
