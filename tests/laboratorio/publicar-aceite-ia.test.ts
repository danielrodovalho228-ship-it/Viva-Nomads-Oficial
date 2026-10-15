import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Ordem 16be0f78 (t79 teste 2 estourava 120 s): o botão Publicar do editor só habilita depois do aceite
 * do termo de IA. Se o editor exige o aceite, o apoio do laboratório (publicarPeloEditor) tem de marcá-lo.
 */
test("publicarPeloEditor marca o aceite da IA quando o editor o exige", () => {
  const editor = readFileSync("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", "utf8");
  const apoio = readFileSync("tests/e2e/fixtures/laboratorio.ts", "utf8");
  const trecho = apoio.slice(apoio.indexOf("export async function publicarPeloEditor"), apoio.indexOf("export async function apagarContas"));
  assert.match(editor, /data-testid="aceite-ia"/);
  assert.match(editor, /disabled=\{[^}]*!aceitouIa/);
  assert.match(trecho, /aceite-ia/);
  assert.doesNotMatch(trecho, /networkidle/);
});
