import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  t271 × t25 (ORDEM-DUET-350/352): a fatia 9 do laboratório passou a correr a t25 antes da t271 (os specs novos de 20/11
  deslocaram as fronteiras das fatias). A t25 abria um chamado — o dono pela /ajuda, a equipe responde — e não o apagava:
  o chamado ficava na fila do admin e /admin/atendimento trocava o "Nada pendente." da imagem de referência pela tabela
  (70848 px a 1280 e 45175 px a 390, iguais ao pixel nas corridas 3044, 3047 e 3049). A t25 passa a apagar o que criou,
  como a própria t271 apaga o contrato dela. A referência e a guarda visual não mudam.
  Roda: node --test tests/laboratorio/t271-t25-apaga-o-chamado.test.ts
*/
const t25 = readFileSync(new URL("../e2e/specs/t25-chamado-resumo.spec.ts", import.meta.url), "utf8");

test("t25: guarda o id do chamado que abre, fora do teste, para o afterAll o achar mesmo se o teste falhar", () => {
  assert.match(t25, /let chamadoId: string \| undefined;/);
  assert.match(t25, /chamadoId = c\?\.id as string \| undefined;/);
});

test("t25: o afterAll apaga as mensagens, os eventos e o chamado que o spec criou (nada fica na fila do admin)", () => {
  const fim = t25.slice(t25.indexOf("test.afterAll("));
  assert.ok(t25.includes("test.afterAll("), "a t25 tem afterAll");
  assert.match(fim, /from\("chamado_mensagens"\)\.delete\(\)\.eq\("chamado_id", chamadoId\)/);
  assert.match(fim, /from\("chamado_eventos"\)\.delete\(\)\.eq\("chamado_id", chamadoId\)/);
  assert.match(fim, /from\("chamados"\)\.delete\(\)\.eq\("id", chamadoId\)/);
});

test("t27 (o resíduo de 390 px): apaga o chamado que resolve — a fila vazia volta a dizer 'Nenhuma decisão registrada'", () => {
  const t27 = readFileSync(new URL("../e2e/specs/t27-agentes-ao-vivo.spec.ts", import.meta.url), "utf8");
  assert.match(t27, /let chamadoId: string \| undefined;/);
  assert.match(t27, /chamadoId = ch\?\.id as string \| undefined;/);
  const fim = t27.slice(t27.indexOf("test.afterAll("));
  assert.ok(t27.includes("test.afterAll("), "a t27 tem afterAll");
  assert.match(fim, /from\("chamados"\)\.delete\(\)\.eq\("id", chamadoId\)/);
});

test("t271: a imagem de referência de /admin/atendimento e a guarda visual ficam como estavam", () => {
  const t271 = readFileSync(new URL("../e2e/specs/t271-admin-visual.spec.ts", import.meta.url), "utf8");
  assert.match(t271, /"\/admin\/atendimento"/);
  assert.match(t271, /maxDiffPixelRatio: 0\.03/);
  assert.doesNotMatch(t271, /admin-fila|chamado-linha/, "sem máscara nem altura fixa para a fila");
});
