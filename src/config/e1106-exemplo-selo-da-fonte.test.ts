/*
  ORDEM-DUET-485/486 (resíduo do E1105/E1106): os proprietários FICTÍCIOS dos anúncios de exemplo mostravam o selo
  "Identidade verificada" — texto literal, que não é o da fonte única da identidade. O exemplo mostra ao visitante o
  texto que o dono real verá: o selo de identidade dos exemplos passa a ser a constante da fonte (a conferência da
  equipa, TEXTO_CONFERIDA_EQUIPE — o estado que um dono novo realmente tem). O texto antigo não volta como selo.
  Só código de exemplo: nada vai para o banco.
  Roda: node --test src/config/e1106-exemplo-selo-da-fonte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_CONFERIDA_EQUIPE } from "../lib/identidade/estado.ts";
import { PROPRIETARIOS_EXEMPLO } from "./exemplo-proprietarios.ts";

test("os selos de identidade dos exemplos são o texto da fonte única, nunca o antigo 'Identidade verificada'", () => {
  const todos = PROPRIETARIOS_EXEMPLO.flatMap((p) => p.selos);
  assert.ok(!todos.includes("Identidade verificada"), "o texto antigo não volta como selo de exemplo");
  assert.ok(todos.includes(TEXTO_CONFERIDA_EQUIPE), "algum exemplo mostra o selo da fonte");
  for (const p of PROPRIETARIOS_EXEMPLO) for (const s of p.selos) assert.doesNotMatch(s, /^Identidade /, `${p.id}: selo de identidade fora da fonte`);
});

test("o ficheiro de exemplo usa a constante da fonte (não escreve o texto à mão)", () => {
  const src = readFileSync(new URL("./exemplo-proprietarios.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /"Identidade verificada"/);
  assert.match(src, /import \{ TEXTO_CONFERIDA_EQUIPE \} from "\.\.\/lib\/identidade\/estado\.ts";/);
  assert.match(src, /selos: \["E-mail confirmado", "Telefone verificado", TEXTO_CONFERIDA_EQUIPE\]/);
});
