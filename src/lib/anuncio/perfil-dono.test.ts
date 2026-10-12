/* Roda: node --test src/lib/anuncio/perfil-dono.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { perfilDonoCompleto } from "./perfil-dono.ts";

test("F45: perfil completo = nome e telefone válidos", () => {
  assert.equal(perfilDonoCompleto({ full_name: "Maria Souza", phone: "(62) 99999-1234" }), true);
});

test("F45: sem telefone, sem nome ou sem perfil não publica", () => {
  assert.equal(perfilDonoCompleto({ full_name: "Maria Souza", phone: "" }), false);
  assert.equal(perfilDonoCompleto({ full_name: "", phone: "(62) 99999-1234" }), false);
  assert.equal(perfilDonoCompleto(null), false);
});

test("F45: createProperty e updateProperty checam o perfil no servidor ao publicar", () => {
  const src = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  assert.equal((src.match(/perfilDonoCompleto\(/g) ?? []).length >= 2, true);
});
