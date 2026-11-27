/*
  Estados vazios (E255 em Ganhos): "Você entra na regra nova?" lia os contratos e os imóveis com .catch(() => []) e sem
  `exigir` — uma falha de leitura virava "R$ 0 na Viva" e "não entra", uma resposta errada sobre a regra fiscal. Agora
  as duas leituras exigem o banco e, se falham, o cartão diz que não deu para calcular (e o aviso não aparece).
  Roda: node --test src/lib/reforma/enquadramento-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(dashboard)/dashboard/ganhos/page.tsx", "utf8");
const fn = pagina.slice(pagina.indexOf("async function dadosDaReforma"));

test("as leituras do enquadramento exigem o banco (falha não vira lista vazia)", () => {
  assert.match(fn, /getMeusContratos\(\{ exigir: true \}\)/);
  assert.match(fn, /listMyProperties\(\{ exigir: true \}\)/);
  assert.doesNotMatch(fn, /\.catch\(\(\) => \[\]\)/);
  assert.match(fn, /return \{ indisponivel: true \}/);
});

test("a tela diz que não calculou — sem números zerados e sem o aviso", () => {
  assert.match(pagina, /data-testid="enquadramento-reforma-indisponivel"/);
  assert.match(pagina, /Não conseguimos ler seus contratos e imóveis agora/);
  assert.match(pagina, /reforma && "numeros" in reforma && <EnquadramentoReforma \{\.\.\.reforma\.numeros\} \/>/);
  assert.match(pagina, /reforma && "aviso" in reforma && reforma\.aviso/);
});
