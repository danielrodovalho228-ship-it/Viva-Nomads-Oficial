/*
  Achado nº 21 (erros/estados vazios) — os documentos do morador de uma candidatura aceita: na falha de leitura, o dono
  via "O morador ainda não enviou os documentos" e o morador via tudo "pendente" (e reenviaria). Agora a leitura LANÇA
  com `exigir` e a tela avisa, com "Tentar de novo".
  Roda: node --test src/lib/data/achado21-docs-inquilino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a leitura dos documentos do morador lança na falha quando a tela exige", () => {
  const f = ler("src/lib/data/documentos-inquilino-actions.ts");
  assert.match(f, /export async function listarDocsInquilino\(leadId: string, opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(f, /if \(error && opcoes\.exigir\) throw new Error\(/);
});

test("a tela pede exigir e mostra o aviso com tentar de novo (nunca 'ainda não enviou' na falha)", () => {
  const c = ler("src/components/documentos-inquilino.tsx");
  assert.match(c, /listarDocsInquilino\(leadId, \{ exigir: true \}\)/);
  assert.doesNotMatch(c, /\.catch\(\(\) => setDocs\(\[\]\)\)/);
  assert.match(c, /\.catch\(\(\) => setFalhou\(true\)\)/);
  const i = c.indexOf("if (falhou)");
  assert.ok(i > 0 && i < c.indexOf("if (docs === null) return null;"), "o aviso vem antes do estado vazio");
  assert.match(c, /data-testid="docs-inquilino-erro"[\s\S]{0,200}Tentar de novo/);
});
