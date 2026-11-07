/*
  Auditoria de erros e estados vazios, achado nº 177 (registrarContrato): a falha de LEITURA de "já existe contrato deste
  lead?" virava "não existe" e a ação seguia para CRIAR o contrato — podendo duplicá-lo. Agora lê o erro e para com
  "Não foi possível conferir o contrato agora." antes de qualquer criação.
  Roda: node --test src/lib/data/achado177-leitura-contrato-existente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf('from("contratos").select("id").eq("lead_id", lead.id)');
const trecho = fonte.slice(i - 80, i + 900);

test("177: registrarContrato — falha ao ler o contrato existente não vira 'não existe' e não cria outro", () => {
  assert.ok(i > 0, "a leitura do contrato existente continua lá");
  assert.match(trecho, /const \{ data: existente, error: erroExistente \}/);
  assert.match(trecho, /if \(erroExistente\) return \{ ok: false, error: "Não foi possível conferir o contrato agora\. Tente de novo\." \};/);
  assert.ok(trecho.indexOf("if (erroExistente)") < trecho.indexOf("if (existente)"), "o erro vem antes de decidir que não existe");
});
