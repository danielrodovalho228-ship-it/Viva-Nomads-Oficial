/*
  Achado 29 (frente erros/estados vazios): a "Solução no prazo por proprietário" (/admin/solicitacoes)
  não pode dizer "Nenhum proprietário com 3 ou mais chamados resolvidos" quando a leitura falhou.
  Roda: node --test src/lib/data/achado29-taxa-solucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("taxasDeSolucaoDosDonos lança nas duas leituras", () => {
  const s = ler("./admin-prazos-59.ts");
  const corpo = s.slice(s.indexOf("export async function taxasDeSolucaoDosDonos"));
  assert.match(corpo, /if \(error\) throw/);
  assert.match(corpo, /if \(erroPerfis\) throw/);
});

test("a página avisa a falha em vez de mostrar a lista vazia", () => {
  const p = ler("../../app/(dashboard)/admin/solicitacoes/page.tsx");
  assert.match(p, /taxasDeSolucaoDosDonos\(admin, agora\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(p, /taxasDeSolucaoDosDonos\(admin, agora\)\.catch\(\(\) => \[\]\)/);
  assert.match(p, /taxas === null \?/);
  assert.match(p, /data-testid="taxa-solucao-erro"/);
  assert.match(p, /Não foi possível carregar a taxa de solução/);
});
