/*
  E391 (2) — a trava do roteiro de carga: nunca produção, nunca sem a confirmação do Supabase separado.
  Roda: node --test scripts/carga/e391-carga.test.mjs
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { motivoParaNaoRodar, percentil } from "./e391-carga.mjs";

test("trava: sem BASE_URL, domínio de produção ou sem a confirmação, não roda", () => {
  assert.match(motivoParaNaoRodar("", {}), /BASE_URL/);
  assert.match(motivoParaNaoRodar("https://vivanomads.com.br", { CONFIRMO_SUPABASE_SEPARADO: "1" }), /produção/);
  assert.match(motivoParaNaoRodar("https://www.vivanomads.com.br", { CONFIRMO_SUPABASE_SEPARADO: "1" }), /produção/);
  assert.match(motivoParaNaoRodar("https://x-preview.vercel.app", {}), /Supabase de produção/);
  assert.equal(motivoParaNaoRodar("https://x-preview.vercel.app", { CONFIRMO_SUPABASE_SEPARADO: "1" }), null);
});

test("percentil", () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentil(v, 50), 50);
  assert.equal(percentil(v, 95), 95);
  assert.equal(percentil([], 95), 0);
});
