import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: excluir o anúncio com leitura falha nunca deixa as fotos órfãs no bucket. */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function deleteProperty(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("deleteProperty: erro ao ler o dono ou as fotos para antes de apagar", () => {
  assert.ok(i >= 0);
  // E953 (asserção alterada): a leitura e a recusa moram em excluirRascunhoDoDono (src/lib/data/excluir-rascunho-servidor.ts),
  // que deleteProperty chama; a regra é a mesma — leitura falha (agora a RPC do draft_data ou as fotos) para ANTES de apagar.
  assert.match(f, /excluirRascunhoDoDono\(supabase, user\.id, id\)/);
  const m = readFileSync(new URL("./excluir-rascunho-servidor.ts", import.meta.url), "utf8");
  const g = m.indexOf("if (privado.error || fotos.error) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < m.indexOf(".delete()"), "antes de qualquer delete");
});
