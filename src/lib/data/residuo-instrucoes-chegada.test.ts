import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: salvar instruções com leitura falha nunca leva o "Como entrar" do contrato ao imóvel. */
const fonte = readFileSync(new URL("./estadia-actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function salvarInstrucoes(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("salvarInstrucoes: erro ao ler o check-in do contrato ou as instruções do imóvel para antes de gravar", () => {
  assert.ok(i >= 0);
  assert.match(f, /\{ data: ck, error: erroCk \}, \{ data: atual, error: erroAtual \}/);
  const g = f.indexOf("if (erroCk || erroAtual) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("separarSalvamento("), "antes de decidir o destino");
  assert.ok(g < f.indexOf('.from("imovel_instrucoes_chegada")\n    .upsert('), "antes do upsert do imóvel");
});
