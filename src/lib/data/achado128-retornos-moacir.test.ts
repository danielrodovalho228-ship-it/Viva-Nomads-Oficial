/*
  Frente 1, rodada 4 — achado 128 (baixa): ao abrir Admin → Agentes, o Moacir posta na conversa o retorno de cada
  ordem concluída, uma vez só (a marca "(ordem <id>)" no texto). A conferência "já postei?" não olhava o erro: na falha,
  o count vinha nulo, contava como zero e o retorno saía de novo a cada abertura da página. Agora a falha pula a ordem
  nesta abertura (a próxima tenta de novo).
  Roda: node --test src/lib/data/achado128-retornos-moacir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./agentes-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function postarRetornosDoMoacir"));

test("retorno do Moacir: sem saber se já foi postado, não posta (nada em dobro)", () => {
  const conta = fn.indexOf('const { count, error: erroJa } = await supabase.from("agentes_conversas")');
  const guarda = fn.indexOf("if (erroJa || (count ?? 0) > 0) continue;");
  const insert = fn.indexOf('.from("agentes_conversas").insert(');
  assert.ok(conta > 0, "a contagem lê o erro");
  assert.ok(guarda > conta && guarda < insert, "a falha pula antes de postar");
});
