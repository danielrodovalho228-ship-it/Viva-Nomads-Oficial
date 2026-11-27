/*
  E744, triagem da noturna de 16/11 (corrida 43892951951, fatia 4): a t198 passou a falhar em "conta: último botão livre
  acima da barra de abas" com "Execution context was destroyed, most likely because of a navigation".

  Causa: a sessão gravada no login traz o cookie da largura de uma tela larga. A 390 px o servidor manda /dashboard/conta
  para o Perfil (E798) e a casca, ao ver a tela estreita, corrige o cookie e volta para o menu da Conta (E979, 16/11): uma
  troca de página cerca de 1 s depois de a primeira tela aparecer, no meio da medição do teste. O produto está como o
  E979 decidiu; quem tem de esperar a tela assentar é o teste.

  Guarda: a t198 espera o endereço pedido antes de procurar o título e de medir. Nenhuma asserção saiu.
  Roda: node --test tests/laboratorio/e744-t198-conta-assenta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync("tests/e2e/specs/t198-rodape-painel-390.spec.ts", "utf8");

test("t198: espera a tela assentar no endereço pedido antes do título e da medição", () => {
  const abrir = spec.indexOf('await page.goto(rota, { waitUntil: "domcontentloaded" });');
  const assentar = spec.indexOf("await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe(rota);");
  const titulo = spec.indexOf('await expect(page.locator("h1:visible").first()).toBeVisible(');
  const medir = spec.indexOf("await page.evaluate(");
  assert.ok(abrir > 0, "abre a rota");
  assert.ok(assentar > abrir, "espera o endereço pedido depois de abrir");
  assert.ok(titulo > assentar, "só procura o título com a tela assentada");
  assert.ok(medir > titulo, "só mede depois do título");
});

test("t198: as três telas e as três asserções de antes continuam lá", () => {
  for (const rota of ['["conta", "/dashboard/conta"]', '["imoveis", "/dashboard/imoveis"]', '["mensagens", "/dashboard/mensagens"]']) assert.ok(spec.includes(rota), rota);
  assert.match(spec, /expect\(r\.fundo, `nenhum controle em \$\{rota\}`\)\.not\.toBeNull\(\);/);
  assert.match(spec, /expect\(r\.fundo!, `último controle "\$\{r\.nome\}" fica embaixo de algo fixo em \$\{rota\}`\)\.toBeLessThanOrEqual\(r\.topoFixos\);/);
  assert.match(spec, /document\.documentElement\.scrollWidth - window\.innerWidth\)\)\.toBeLessThanOrEqual\(1\);/);
  assert.doesNotMatch(spec, /test\.(skip|fixme|fail)\((?!!hasAccount)/, "sem teste pulado nem falha esperada (fora a conta de teste ausente)");
});
