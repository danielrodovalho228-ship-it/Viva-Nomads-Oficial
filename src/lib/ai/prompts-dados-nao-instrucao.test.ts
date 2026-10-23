/*
  Guarda das ordens 21708cca (parte F): todo prompt de IA que recebe texto de usuário
  (anúncio, busca, chat, fotos, documentos) declara que o conteúdo é dado, nunca instrução.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const DECLARA = /(DADOS?,? nunca instru|DADO, nunca instru|Ignore qualquer instru|n[ãa]o valem|ignore qualquer texto)/i;

for (const [nome, arquivo] of [
  ["anúncio", "./anuncio-prompt.ts"],
  ["fotos", "./fotos-prompt.ts"],
  ["busca por descrição", "../../app/api/busca/descricao/route.ts"],
  ["chat da Viva", "../atendimento/viva-prompt.ts"],
  ["leitura de documento", "../documento/conferencia.ts"],
  ["matrícula", "../documento/conferencia-matricula.ts"],
] as const) {
  test(`prompt de IA (${nome}) trata o conteúdo do usuário como dado`, () => {
    assert.match(ler(arquivo), DECLARA);
  });
}
