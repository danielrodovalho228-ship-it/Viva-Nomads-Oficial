import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: contagem ilegível nunca fura o limite diário de medições de internet. */
const fonte = readFileSync(new URL("./internet-medida-servidor.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.search(new RegExp(`(export )?async function ${nome}\\(`));
  assert.ok(i >= 0, nome);
  return fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);
}

test("medicoesHoje devolve null (não 0) na falha de leitura", () => {
  const f = corpo("medicoesHoje");
  assert.match(f, /Promise<number \| null>/);
  assert.match(f, /if \(error\) return null;/);
});

test("registrarMedicao: contagem ilegível pede para tentar de novo antes de gravar", () => {
  const f = corpo("registrarMedicao");
  const g = f.indexOf("if (feitasHoje === null) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("dentroDoLimite(feitasHoje)"));
  assert.ok(g < f.indexOf('from("internet_medicoes")'), "antes do insert");
});
