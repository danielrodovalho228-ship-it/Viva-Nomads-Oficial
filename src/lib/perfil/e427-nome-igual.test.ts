/* Roda: node --test src/lib/perfil/e427-nome-igual.test.ts — E427 (01/11): o nome do dono saía "Daniel P." para o morador
   (visita) e "Daniel 1." na página pública. As duas telas usam agora a MESMA regra (nomeCurto): pedaço sem letra não é
   sobrenome. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeCurto } from "./perfil-publico.ts";
import { nomeComInicial } from "../visitas/nome-visita.ts";

test("visita e página pública abreviam igual", () => {
  for (const nome of ["Daniel Pereira 1", "Daniel Pereira", "  Daniel   Pereira  2º ", "Daniel", "Ana Clara Souza", "Maria - Lima", "ana@exemplo.com", "", null]) {
    assert.equal(nomeComInicial(nome), nomeCurto(nome), String(nome));
  }
  assert.equal(nomeCurto("Daniel Pereira 1"), "Daniel P.");
  assert.equal(nomeCurto("Daniel 1"), "Daniel");
  assert.equal(nomeCurto("ana@exemplo.com"), null);
});

test("a página pública abrevia o nome completo pela mesma regra (não o nome_curto do banco)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../data/perfil-proprietario.ts", import.meta.url), "utf8");
  assert.match(src, /admin\.from\("profiles"\)\.select\("full_name"\)\.eq\("id", donoId\)\.maybeSingle\(\)/);
  assert.match(src, /nome: nomeCurto\(\(perfil\.data as \{ full_name\?: string \| null \} \| null\)\?\.full_name\) \?\? nomeCurto\(l\.nome_curto\) \?\? "Proprietário",/);
});
