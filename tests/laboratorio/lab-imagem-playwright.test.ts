/*
  E1037 (ORDEM-DUET-212/213; desenho na peça 33): o laboratório deixa de instalar navegadores com apt em tempo de execução.
  O espelho do Ubuntu, lento, matava tentativas (o Chromium chegou a 28,8 min; o WebKit esgotou as 2 × 240 s nas fatias 20
  das corridas 44429658751 e 44567713288, e os 10 testes de celular caíam com "Executable doesn't exist").
  Desenho do coordenador: a imagem Docker OFICIAL do Playwright, da MESMA versão do projeto. Forma: só o passo dos testes
  corre na imagem, com `--network host` (o Supabase local e o `next start` seguem no runner, em localhost).
  Roda: node --test tests/laboratorio/lab-imagem-playwright.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const versao = (JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")) as { version: string }).version;
const IMAGEM = `mcr.microsoft.com/playwright:v${versao}-noble`;
const fatias = yml.slice(yml.indexOf("\n  laboratorio:\n"), yml.indexOf("\n  construir:\n") > yml.indexOf("\n  laboratorio:\n") ? yml.indexOf("\n  construir:\n") : undefined);
const passoDaSuite = fatias.slice(fatias.indexOf("- name: Rodar a suíte E2E"), fatias.indexOf("- name: Guardar relatório"));

test("as fatias não instalam navegadores com apt: sem `playwright install` no job das fatias", () => {
  assert.doesNotMatch(fatias, /playwright install/);
  assert.doesNotMatch(fatias, /- name: Instalar (Chromium|WebKit) do Playwright/);
});

test("a imagem é a oficial do Playwright, na MESMA versão do @playwright/test instalado", () => {
  assert.ok(fatias.includes(IMAGEM), `falta ${IMAGEM}`);
  for (const m of fatias.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g)) assert.equal(m[1], versao, "a imagem e o pacote não podem desalinhar");
});

test("a imagem é baixada num passo próprio, com tentativas, antes da suíte", () => {
  const baixar = fatias.slice(fatias.indexOf("- name: Baixar a imagem do Playwright"), fatias.indexOf("- name: Rodar a suíte E2E"));
  assert.ok(baixar.length > 40, "existe o passo de baixar a imagem");
  assert.match(baixar, /docker pull/);
  assert.ok(fatias.indexOf("- name: Baixar a imagem do Playwright") < fatias.indexOf("- name: Rodar a suíte E2E"));
});

test("todo `npx playwright` da suíte corre na imagem, com a rede do runner, como o utilizador do runner", () => {
  // As linhas de comando ficam iguais (outros testes prendem-nas); a função `npx` do passo manda só `npx playwright …` à imagem.
  assert.match(passoDaSuite, /npx\(\) \{\n\s+if \[ "\$\{1:-\}" != playwright \]; then command npx "\$@"; return; fi/);
  assert.match(passoDaSuite, /docker run --rm --network host --ipc host --user "\$\(id -u\):\$\(id -g\)"/);
  assert.ok(passoDaSuite.indexOf("npx() {") < passoDaSuite.indexOf("npx playwright test"), "a função vem antes das chamadas");
  assert.ok((passoDaSuite.match(/npx playwright test/g) ?? []).length >= 4, "as 4 formas da fatia (quarentena, 25, gerais, varredura)");
});
