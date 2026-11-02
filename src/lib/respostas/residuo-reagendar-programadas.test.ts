import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: lista ilegível nunca vira "nada a reagendar" em silêncio depois do aditivo. */
const fonte = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function reagendarProgramadas(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("reagendarProgramadas: erro de leitura lança antes de calcular", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (error) throw new Error(");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("reagendar(("), "antes de calcular o que mudar");
});

test("reagendarProgramadas: a falha avisa a equipe (P2) sem lançar", () => {
  const captura = f.slice(f.indexOf("} catch (e) {"));
  assert.match(captura, /from\("avisos_daniel"\)\s*\.insert\(/);
  assert.match(captura, /prioridade: "P2"/);
  assert.match(captura, /\.then\(undefined, \(\) => \{\}\)/);
  assert.match(captura, /return 0;/);
});
