/*
  Achado 160 — conferência de entrada/saída: se a LEITURA do contrato falhava (banco fora do ar), parteDoContrato devolvia
  null e a pessoa lia "Você não faz parte deste contrato." no próprio contrato. Agora a falha de leitura tem frase própria
  ("Não foi possível ler o contrato agora. Tente de novo.") e só a ausência real da pessoa diz "não faz parte".
  Roda: node --test src/lib/data/achado160-conferencia-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./conferencia-actions.ts", import.meta.url), "utf8");

test("a leitura do contrato destrincha o erro e devolve a frase de falha, não 'não faz parte'", () => {
  const fn = src.slice(src.indexOf("async function parteDoContrato("), src.indexOf("/** Registra um item"));
  assert.match(fn, /\.maybeSingle\(\);/);
  assert.match(fn, /error: erroContrato/);
  assert.match(fn, /if \(erroContrato\)/);
  assert.match(src, /const MSG_CONFERENCIA_SEM_LEITURA = "Não foi possível ler o contrato agora\. Tente de novo\."/);
});

test("as ações com contrato usam o contexto com a frase certa (4 pontos: registrar, confortar, decidir, enviar foto)", () => {
  const usos = src.match(/const lido = await contextoDaConferencia\(/g) ?? [];
  assert.ok(usos.length >= 5, `esperava ≥5 usos, achei ${usos.length}`);
  assert.doesNotMatch(src, /const ctx = await parteDoContrato\([^)]*\);\n\s*if \(!ctx\) return erro\("Você não faz parte deste contrato\."\);/);
  assert.match(src, /if \("erro" in lido\) return erro\(lido\.erro\);/);
});
