/* Roda: node --test src/components/busca/e457-paineis-fecham.test.ts
  E457 (rodada pública 02/11): em Tipo/Preço (e Nível) escolher aplicava na hora, mas o painel continuava aberto sobre o
  resultado — a pessoa fechava à mão; Ordenar já fechava. No Datas, a ação de aplicar se chamava só "Fechar".
  Padrão: painel de escolha única → escolheu, aplica e fecha (mostra o resultado); painel de vários campos (Datas, Local)
  → o botão tem nome de ação: "Ver resultados".
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("./barra-pilulas.tsx", import.meta.url), "utf8");

test("E457: Tipo e Preço (alterna) aplicam e fecham o painel", () => {
  assert.match(s, /const alterna = [^\n]*=> \{\s*p\.aplicar\(\{ \.\.\.f, \[k\]: f\[k\] === v \? vazio : v \}\);\s*setAberto\(null\);\s*\};/);
});

test("E457: Nível aplica e fecha o painel", () => {
  assert.match(s, /\(\) => \{\s*p\.aplicar\(\{ \.\.\.f, nivelMin: f\.nivelMin === v \? "" : v \}\);\s*setAberto\(null\);\s*\}/);
});

test("E457: Ordenar continua aplicando e fechando", () => {
  assert.match(s, /p\.onOrdem\(v\);\s*setAberto\(null\);/);
});

test("E457: o botão do pé do painel tem nome de ação ('Ver resultados'), não 'Fechar'", () => {
  const pe = s.slice(s.indexOf('data-testid="painel-pilula-fechar"') - 300, s.indexOf('data-testid="painel-pilula-fechar"') + 200);
  assert.match(pe, /Ver resultados/);
  assert.doesNotMatch(pe, />\s*Fechar\s*</);
});
