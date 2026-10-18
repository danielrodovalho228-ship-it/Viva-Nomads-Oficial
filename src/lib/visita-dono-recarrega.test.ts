/*
  Estático: depois que o dono responde um pedido de visita, os botões somem na hora e a lista recarrega (lab t168).
  Roda: node --experimental-strip-types --test src/lib/visita-dono-recarrega.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const acoes = readFileSync(new URL("../app/(dashboard)/dashboard/visitas/acoes-visita.tsx", import.meta.url), "utf8");

test("visitas do dono: após o sucesso esconde as ações e chama router.refresh()", () => {
  assert.match(acoes, /setRespondido\(true\);[\s\S]*router\.refresh\(\)/);
  assert.match(acoes, /respondido\) return null/);
});
