/*
  Garantias e Ferramentas do painel (varredura de texto, ordens 0569d129 e b68f4ede/#141): o que o dono lê não cita
  "Lei 8.245"/"art. 38", não diz "aluguéis" (é "valor mensal") nem afirma que seguro incêndio é "obrigatório pela
  Lei do Inquilinato" (o recurso ainda está em estruturação).
  Roda: node --test src/lib/textos-garantias-ferramentas.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ARQUIVOS = [
  "src/app/(dashboard)/dashboard/garantias/garantias-client.tsx",
  "src/app/(dashboard)/dashboard/ferramentas/page.tsx",
];

/** Tira comentários; o que sobra é código + texto de tela. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}()])\/\/[^\n]*/g, "$1");
}

const PROIBIDOS: Array<[string, RegExp]> = [
  ["Lei 8.245", /8\.?245/],
  ["art. 38", /\bart\.?\s*38\b/i],
  ["aluguéis", /\balugu[eé]is\b/i],
  ["Lei do Inquilinato", /Lei do Inquilinato/i],
  ["o aluguel", /\b(?:cobre|do|o) aluguel\b/i],
];

for (const arq of ARQUIVOS) {
  for (const [nome, re] of PROIBIDOS) {
    test(`sem "${nome}" em texto visível: ${arq}`, () => {
      assert.doesNotMatch(semComentarios(readFileSync(arq, "utf8")), re);
    });
  }
}
