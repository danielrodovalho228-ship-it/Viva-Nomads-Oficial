/*
  E642 — garantia ÚNICA (Lei 8.245/91, art. 37): caução OU seguro-fiança, nunca os dois. O seletor, a gravação (contratos.garantia)
  e a trava do banco (0076) já existem. Faltava a maquinaria da CAUÇÃO (E637: prazos, parecer, devolução, bloqueio de anúncio) respeitar
  isso: contrato com seguro-fiança NÃO tem caução, então não ganha prazo de devolução, aviso de liberação nem pendência do dia 30.
  Roda: node --test src/lib/caucao/e642-garantia-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contratoTemCaucao } from "./prazos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("só o contrato com caução entra nos prazos da caução", () => {
  assert.equal(contratoTemCaucao("caucao"), true);
  assert.equal(contratoTemCaucao("seguro_fianca"), false);
  // contrato antigo, sem a coluna preenchida, é caução (o padrão do banco, 0076)
  assert.equal(contratoTemCaucao(null), true);
  assert.equal(contratoTemCaucao(undefined), true);
});

test("a rotina diária não cria linha de prazos para contrato com seguro-fiança", () => {
  const s = ler("src/lib/caucao/prazos-servidor.ts");
  assert.match(s, /\.select\("id, tenant_id, property_id, garantia, properties/);
  assert.match(s, /contratoTemCaucao\(c\.garantia\)/);
});
