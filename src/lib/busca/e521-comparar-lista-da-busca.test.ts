/*
  E521 (reprova de 05/11): /comparar com 2 imóveis nunca abria a tabela na rodada de retestes. A busca mostra os anúncios
  de teste à conta de TESTE logada (E571: listProperties({ incluirTeste })), mas /comparar lia a lista pública — os
  marcados não eram achados e a página caía no estado vazio. Agora /comparar lê a MESMA lista da busca.
  Roda: node --test src/lib/busca/e521-comparar-lista-da-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("/comparar lê a mesma lista da busca (com os anúncios de teste para a conta de teste)", () => {
  const c = ler("app/(public)/comparar/page.tsx");
  const b = ler("app/(public)/buscar/page.tsx");
  assert.match(b, /listProperties\(\{ incluirTeste \}\)/);
  assert.match(c, /const incluirTeste = ids\.length \? await buscaComAnunciosDeTeste\(\) : false;/);
  assert.match(c, /await listProperties\(\{ incluirTeste \}\)/);
  assert.doesNotMatch(c, /await listProperties\(\)/);
});
