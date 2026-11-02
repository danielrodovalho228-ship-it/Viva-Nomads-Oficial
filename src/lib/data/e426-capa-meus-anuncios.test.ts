/* Roda: node --test src/lib/data/e426-capa-meus-anuncios.test.ts — E426 (reprova 02/11): em produção, 1 rascunho tinha fotos
   reais só no draft_data e Meus anúncios mostrava o espaço vazio (o Início já usava o draft_data desde o E308). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Meus anúncios cai no draft_data para o rascunho sem capa (só arquivo existente)", () => {
  const src = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function listMyProperties"), src.indexOf("export async function listMyProperties") + 4000);
  assert.match(fn, /p\.status === "draft" && !\(p\.photos \?\? \[\]\)\.some\(ehUrlDeImagem\)/);
  assert.match(fn, /supabase\.rpc\("property_private_details", \{ prop_id: p\.id \}\)/);
  assert.match(fn, /capaDoDraftData\(row\?\.draft_data \?\? null, user\.id, existentes\)/);
  assert.ok(fn.indexOf("arquivosDoDono") < fn.indexOf("capaDoDraftData"), "existentes calculado antes");
});
