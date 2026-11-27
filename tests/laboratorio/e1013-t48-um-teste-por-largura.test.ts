/*
  Roda: node --test tests/laboratorio/e1013-t48-um-teste-por-largura.test.ts
  E1013 (item de instabilidade, T1 do plano de 17/11): "admin: todas as telas logadas" do t48 foi instável nas 7 corridas
  completas de 16 e 17/11. Não é acaso: o teste varria todas as telas a 390 px e depois todas de novo a 1280 px dentro
  de UM teste com teto de 30 minutos. Com o servidor frio (primeira tentativa) a varredura do admin passa dos 30 minutos
  e o teste estoura; na nova tentativa, com as páginas já geradas, leva cerca de 25 e passa. A fatia do admin (a 20 naquelas
  corridas; a 24 desde a T3) gastava 55 minutos.

  A correção não aumenta o teto nem as tentativas: cada largura vira um teste próprio, com o mesmo teto de 30 minutos.
  O que é coberto não muda (as mesmas telas, nas duas larguras, para as três contas).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync("tests/e2e/specs/t48-varredura.spec.ts", "utf8");
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const bloco = spec.slice(spec.indexOf("for (const [nome, conta, extras] of ["));

test("cada conta logada tem um teste por largura, e cada teste varre uma largura só", () => {
  assert.match(bloco, /for \(const largura of \[390, 1280\] as const\) \{/);
  assert.match(bloco, /test\(`\$\{nome\}: todas as telas logadas a \$\{largura\} px`, async \(\{ browser \}\) => \{/);
  assert.equal((bloco.match(/await varrer\(/g) ?? []).length, 1, "uma varredura por teste");
  assert.match(bloco, /await varrer\(page, \[\.\.\.TELAS_LOGADAS, \.\.\.extra\], largura\);/);
  // As três contas e as telas a mais de cada uma continuam as mesmas.
  assert.match(bloco, /\["inquilino", inq, \[\] as string\[\]\],/);
  assert.match(bloco, /\["proprietário", dono, \(\) => \[`\/dashboard\/imoveis\/\$\{ids\.imovel\}\/editar`\]\],/);
  assert.match(bloco, /\["admin", \{ email: adminConta\.email \}, TELAS_ADMIN\],/);
});

test("o teto de cada teste continua em 30 minutos e nada foi pulado nem ganhou nova tentativa", () => {
  assert.equal((bloco.match(/test\.setTimeout\(1_800_000\);/g) ?? []).length, 1);
  assert.doesNotMatch(bloco, /setTimeout\((?!1_800_000)/, "o teto não subiu");
  assert.doesNotMatch(spec, /retries|\.only\(|test\.fixme\(/);
  assert.equal((spec.match(/test\.skip\(/g) ?? []).length, 1, "o único pulo é o de fora do laboratório");
});

test("a 1280 px a página é aberta já nessa largura (a de 390 px é a que o login abre)", () => {
  assert.match(bloco, /if \(largura === 1280\) await page\.setViewportSize\(\{ width: 1280, height: 900 \}\);/);
});

test("as fatias da varredura logada (22, 23 e 24 desde a T3; eram 18, 19 e 20) continuam pegando os testes de cada conta, agora os dois de cada", () => {
  // A fatia de cada conta: o número mudou com a T3 (20 fatias gerais), o --grep não.
  for (const [n, conta] of [["22", "inquilino"], ["23", "proprietário"], ["24", "admin"]]) assert.ok(yml.includes(`${n}) GREP="${conta}: todas as telas logadas" ;;`), `fatia ${n}`);
  for (const conta of ["inquilino", "proprietário", "admin"]) {
    const grep = `${conta}: todas as telas logadas`;
    assert.ok(yml.includes(`GREP="${grep}"`), grep);
    for (const largura of [390, 1280]) assert.ok(new RegExp(grep, "gi").test(`chromium t48-varredura.spec.ts T48 — Varredura do site e do app ${conta}: todas as telas logadas a ${largura} px`));
  }
});
