/* Roda: node --test src/lib/data/blocks-idempotente-e137.test.ts
   E137/E138: bloquear o mesmo período duas vezes (toque duplo, dois envios) não cria um segundo bloqueio — o addBlock
   procura o bloqueio com o mesmo início e fim ANTES de inserir e devolve o id dele. Na tela, o dia já bloqueado nem
   chega a ser selecionado de novo (abre as opções do dia — t471). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./blocks-actions.ts", import.meta.url), "utf8");
const corpo = src.slice(src.indexOf("export async function addBlock"), src.indexOf("export async function removeBlock"));

test("addBlock: procura o mesmo início e fim no mesmo imóvel e devolve o bloqueio que existe", () => {
  assert.match(corpo, /\.from\("property_blocks"\)\s*\.select\("id"\)\s*\.eq\("property_id", propertyId\)\s*\.eq\("inicio", inicio\)\s*\.eq\("fim", fim\)/);
  assert.match(corpo, /if \(igual\?\.id\) return \{ ok: true, id: String\(igual\.id\) \};/);
});

test("addBlock: a procura vem ANTES do insert (senão o segundo envio já teria duplicado)", () => {
  const procura = corpo.indexOf('.eq("inicio", inicio)');
  const insere = corpo.indexOf(".insert(");
  assert.ok(procura > 0 && insere > procura);
});
