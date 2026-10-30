/* Roda: node --test src/lib/anuncio/e257-descricao-cartoes.test.ts — E257 (QA de 29/10): dentro de cada grupo de
   cartões do assistente, ou todos têm a descrição curta, ou o grupo é só título — nunca misturado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("(a) Pronto para trabalhar: só título (os subtítulos Essenciais/Opcionais já classificam)", () => {
  const b = ler("src/components/anuncio/blocos-cadastro.tsx");
  assert.doesNotMatch(b, /dica=\{essencial \? "Essencial"/);
  assert.match(b, /Essenciais · contam para a etiqueta/);
});

test("(b) Regras do topo: os quatro cartões com descrição", () => {
  const e = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  const regras = e.slice(e.indexOf('if (p.parte === "regras")'), e.indexOf('if (p.parte === "descricao")'));
  const toggles = regras.match(/<Toggle\b[\s\S]*?\/>/g) ?? [];
  assert.equal(toggles.length, 4);
  for (const t of toggles) assert.match(t, /hint="[^"]+"/, t.slice(0, 80));
});

test("(c) Privacidade: as duas declarações com descrição", () => {
  const p = ler("src/components/anuncio/privacidade-campos.tsx");
  const decl = p.slice(p.indexOf('testid="declaracao-sem-cameras"'), p.indexOf('data-testid="tipo-acesso"'));
  assert.equal((decl.match(/dica="/g) ?? []).length, 2);
});

test("(d) Comodidade vista na foto: o mesmo cartão da grade (sem borda tracejada nem link no meio)", () => {
  const e = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  const grupo = e.slice(e.indexOf("function GrupoComodidades"));
  assert.doesNotMatch(grupo, /border-dashed|Confirme/);
  assert.match(grupo, /sug \|\| detectada \? Sparkles/);
});
