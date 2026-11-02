/*
  Resíduo da varredura de funções — relerArquivo (Caixa dos sócios, baixo): "Reler" o arquivo de um item gravava o
  resultado mesmo quando o download do Storage falhava. A falha virava extracao_status 'falhou' e texto_extraido
  null, APAGANDO o texto já extraído de um arquivo que estava bom. Agora: a falha do download (ou da leitura do item)
  devolve "tente de novo" sem gravar nada; só a extração que de fato rodou é gravada.
  Roda: node --test src/lib/socios/residuo-reler-arquivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./caixa-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function relerArquivo"), src.indexOf("/**", src.indexOf("export async function relerArquivo")));

test("download que falha não grava (o texto já extraído fica)", () => {
  assert.match(fn, /const \{ data: blob, error: erroDownload \} = await s\.supabase\.storage\.from\(BUCKET_CAIXA\)\.download\(r\.arquivo_path\);/);
  const guarda = fn.indexOf("if (erroDownload || !blob) return");
  const grava = fn.indexOf('.from("caixa_socios").update(');
  assert.ok(guarda > 0 && guarda < grava, "a guarda vem antes de gravar");
  assert.doesNotMatch(fn, /status: "falhou" as const, texto: null/);
});

test("leitura do item que falha não vira 'Item sem arquivo'", () => {
  assert.match(fn, /const \{ data: r, error: erroItem \} = await s\.supabase\.from\("caixa_socios"\)/);
  assert.ok(fn.indexOf("if (erroItem) return") < fn.indexOf('"Item sem arquivo."'));
});
