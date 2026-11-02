/*
  Frente 1 (erros e estados vazios), rodada 1 — achado 116 (ALTA): gravarChacara lia detalhes_anuncio sem conferir o
  erro. Na falha, "atual" virava {} e o update reescrevia o jsonb inteiro só com o grupo da chácara — apagando os outros
  grupos do anúncio. Agora a leitura que falha (ou sem linha) não grava nada.
  Roda: node --test src/lib/anuncio/achado116-chacara.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./chacara-servidor.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function gravarChacara"));

test("gravarChacara não grava sem ler os detalhes (nunca apaga os outros grupos)", () => {
  const leitura = fn.indexOf('.select("detalhes_anuncio")');
  const guarda = fn.indexOf("if (error || !data) {");
  const gravacao = fn.indexOf(".update({ detalhes_anuncio:");
  assert.ok(leitura > 0 && guarda > leitura && gravacao > guarda, "a guarda fica entre a leitura e a gravação");
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("properties"\)\.select\("detalhes_anuncio"\)/);
  assert.match(fn, /const atual = normalizarDetalhes\(data\.detalhes_anuncio\) \?\? \{\};/);
});
