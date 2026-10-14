import test from "node:test";
import assert from "node:assert/strict";
import { normalizarRegrasPets, linhasRegrasPets, compatibilidadePets } from "./pets-regras.ts";

const boa = { especies: ["cao", "gato"], porteMax: "M", qtdMax: 2, reforcoCaucao: 500, regrasCondominio: "Só no elevador de serviço" };

test("regras válidas passam e são normalizadas", () => {
  const r = normalizarRegrasPets(boa);
  assert.deepEqual(r?.especies, ["cao", "gato"]);
  assert.equal(r?.porteMax, "M");
  assert.equal(r?.reforcoCaucao, 500);
});

test("servidor recusa forma inválida", () => {
  assert.equal(normalizarRegrasPets(null), null);
  assert.equal(normalizarRegrasPets({ ...boa, especies: [] }), null);
  assert.equal(normalizarRegrasPets({ ...boa, especies: ["dragao"] }), null);
  assert.equal(normalizarRegrasPets({ ...boa, porteMax: "GG" }), null);
  assert.equal(normalizarRegrasPets({ ...boa, qtdMax: 9 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, qtdMax: 0 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: -1 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: 1e9 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, regrasCondominio: "x".repeat(201) }), null);
});

test("texto do condomínio perde caracteres de controle", () => {
  const r = normalizarRegrasPets({ ...boa, regrasCondominio: "a\u0000b\n\nc" });
  assert.equal(r?.regrasCondominio, "a b c");
});

test("linhas do anúncio mostram espécies, porte, quantidade e Caução", () => {
  const l = linhasRegrasPets(normalizarRegrasPets(boa)!).join(" | ");
  assert.match(l, /Aceita: cão e gato/);
  assert.match(l, /Porte máximo: médio/);
  assert.match(l, /Até 2 animais/);
  assert.match(l, /Reforço de Caução por pet: R\$ 500,00/);
  assert.doesNotMatch(l, /vistoria|temporada/i);
});

test("compatibilidade: porte, espécie, quantidade e imóvel sem pet", () => {
  const r = normalizarRegrasPets(boa);
  assert.equal(compatibilidadePets(true, r, [{ especie: "cao", porte: "P" }]).ok, true);
  const grande = compatibilidadePets(true, r, [{ especie: "cao", porte: "G" }]);
  assert.equal(grande.ok, false);
  assert.match(grande.motivos[0], /porte máximo/);
  assert.equal(compatibilidadePets(true, r, [{ especie: "outro", porte: "P" }]).ok, false);
  assert.equal(compatibilidadePets(true, r, Array(3).fill({ especie: "gato", porte: "P" })).ok, false);
  assert.equal(compatibilidadePets(false, null, [{ especie: "gato", porte: "P" }]).ok, false);
  assert.equal(compatibilidadePets(true, null, [{ especie: "gato", porte: "G" }]).ok, true);
  assert.equal(compatibilidadePets(false, null, []).ok, true);
});

test("ligações: servidor valida ao gravar, anúncio mostra, migração é idempotente", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  assert.match(ler("src/lib/data/actions.ts"), /normalizarRegrasPets\(input\.petsRegras\)/);
  assert.match(ler("src/components/property/stay-rules.tsx"), /linhasRegrasPets\(property\.petsRegras\)/);
  const sql = ler("supabase/producao/aplicar-0119.sql");
  assert.match(sql, /add column if not exists pets_regras/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /0119_pets_regras/);
});
