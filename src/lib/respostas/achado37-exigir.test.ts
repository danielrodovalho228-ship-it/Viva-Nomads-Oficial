/*
  Achado 37 (frente erros/estados vazios): /dashboard/respostas-rapidas não pode dizer "Nenhuma resposta salva ainda"
  quando a leitura falha — o dono recriaria respostas que já tem. A página lê com `exigir`; o erro cai no error.tsx
  do painel ("Tentar de novo"). O seletor da conversa segue sem exigir (vazio lá é inofensivo).
  Roda: node --test src/lib/respostas/achado37-exigir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("minhasRespostas aceita exigir e lança no erro", () => {
  const s = ler("../data/respostas-actions.ts");
  assert.match(s, /export async function minhasRespostas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(s, /if \(error && opcoes\.exigir\) throw new Error/);
  assert.match(s, /respostasDaConversa\(await minhasRespostas\(\),/);
});

test("a página pede exigir e o painel tem 'Tentar de novo'", () => {
  assert.match(ler("../../app/(dashboard)/dashboard/respostas-rapidas/page.tsx"), /minhasRespostas\(\{ exigir: true \}\)/);
  assert.match(ler("../../app/(dashboard)/dashboard/error.tsx"), /Tentar de novo/);
});
