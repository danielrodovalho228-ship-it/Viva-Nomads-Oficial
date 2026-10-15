import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { perfilDonoCompleto } from "../../src/lib/anuncio/perfil-dono.ts";

/**
 * Lab cd5645b: t35/t36/t38/t45/t79 clicavam em Publicar e o anúncio ficava em "100% · Pronto para publicar".
 * Causa: updateProperty exige perfil de dono completo (nome e telefone, F45) e as contas do laboratório
 * eram criadas sem telefone. O apoio do laboratório tem de gravar um telefone que o servidor aceite.
 */
test("criarConta grava um telefone que passa na regra de perfil de dono (F45)", () => {
  const apoio = readFileSync("tests/e2e/fixtures/laboratorio.ts", "utf8");
  const tel = /export const TELEFONE_LAB = "([^"]+)"/.exec(apoio)?.[1];
  assert.ok(tel, "TELEFONE_LAB não definido");
  assert.equal(perfilDonoCompleto({ full_name: "Dono Lab", phone: tel }), true);
  const trecho = apoio.slice(apoio.indexOf("export async function criarConta"), apoio.indexOf("export async function definirPlano"));
  assert.match(trecho, /phone: TELEFONE_LAB/);
});

test("caso negativo: sem telefone o perfil não publica", () => {
  assert.equal(perfilDonoCompleto({ full_name: "Dono Lab", phone: null }), false);
});
