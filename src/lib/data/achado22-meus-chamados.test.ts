/*
  Achado nº 22 (erros/estados vazios) — Central de Ajuda → "Meus chamados": na falha de leitura, a lista virava
  "Você ainda não abriu nenhum chamado." e a pessoa abriria outro igual. Agora a leitura LANÇA com `exigir` e a tela
  avisa, com "Tentar de novo".
  Roda: node --test src/lib/data/achado22-meus-chamados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("meusChamados lança na falha quando a tela exige", () => {
  const f = ler("src/lib/data/atendimento-actions.ts");
  assert.match(f, /export async function meusChamados\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(f, /if \(error && opcoes\.exigir\) throw new Error\("Não foi possível ler os seus chamados agora\."\)/);
});

test("a Central de Ajuda avisa a falha antes do 'nenhum chamado'", () => {
  const c = ler("src/components/ajuda/central-ajuda.tsx");
  assert.match(c, /meusChamados\(\{ exigir: true \}\)/);
  assert.doesNotMatch(c, /meusChamados\(\)\.then\(setLista\)\.catch\(\(\) => setLista\(\[\]\)\)/);
  const i = c.indexOf("{listaFalhou ? (");
  assert.ok(i > 0 && i < c.indexOf("Você ainda não abriu nenhum chamado."), "o aviso vem antes do estado vazio");
  assert.match(c, /data-testid="meus-chamados-erro"[\s\S]{0,200}Tentar de novo/);
});
