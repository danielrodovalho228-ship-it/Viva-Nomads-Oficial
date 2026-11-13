/*
  E808 — RELATORIO-010 citou em /como-funciona: "Se não receber o valor, a Viva informa o proprietário em até 7 dias"
  (prazo que para no aviso). A frase não existe no código, nem em nenhum commit do repositório; o cartão "Pagamentos"
  diz o fluxo real (direto ao proprietário, registrado na plataforma, nada passa pela Viva). Este teste trava as duas
  coisas: o cartão segue dizendo o fluxo real e o prazo solto não aparece em página pública.
  Roda: node --test src/lib/e808-pagamentos-sem-prazo-solto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { achadosProibidos } from "./frases-proibidas.ts";

const CAMINHO = "src/app/(public)/como-funciona/page.tsx";
const pagina = readFileSync(new URL("../app/(public)/como-funciona/page.tsx", import.meta.url), "utf8");

test("o cartão Pagamentos diz o fluxo real, sem prazo de aviso", () => {
  const i = pagina.indexOf('title: "Pagamentos"');
  assert.ok(i > 0, "o cartão Pagamentos existe");
  const cartao = pagina.slice(i, pagina.indexOf("}", i));
  assert.match(cartao, /Vão direto ao proprietário e ficam registrados na plataforma\. Nada passa pela Viva Nomads\./);
  assert.doesNotMatch(cartao, /\d+ dias|informa o proprietário|Se não receber/);
});

test("nenhuma página pública promete 'se não receber, a Viva informa em até N dias'", () => {
  assert.doesNotMatch(pagina, /Se não receber o valor/);
  const reportada = "Se não receber o valor, a Viva informa o proprietário em até 7 dias.";
  assert.ok(achadosProibidos(reportada, CAMINHO).some((a) => a.id === "prazo-de-aviso-sem-passo-seguinte"), "a regra pega a frase reportada");
  assert.deepEqual(achadosProibidos(pagina, CAMINHO).filter((a) => a.id === "prazo-de-aviso-sem-passo-seguinte"), []);
  // Prazos reais de outros fluxos (ex.: "aceite ou recuse em até 7 dias", no e-mail do aditivo) não são pegos.
  assert.deepEqual(achadosProibidos("Aceite ou recuse em até 7 dias pela página da estadia.", CAMINHO), []);
});
