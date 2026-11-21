import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 188 (varredura "leitura que falha não vira outra resposta"): papelNoImovel lia o imóvel e o contrato sem olhar o
 * erro — a falha virava "null" e as duas ações de medição respondiam "Só o proprietário do imóvel (ou o morador…) mede a
 * internet", dizendo ao próprio dono que ele não podia medir.
 */
const fonte = readFileSync(new URL("./internet-medida-servidor.ts", import.meta.url), "utf8");
const papel = fonte.slice(fonte.indexOf("async function papelNoImovel("), fonte.indexOf("\n}\n", fonte.indexOf("async function papelNoImovel(")) + 2);

test("papelNoImovel distingue 'não é parte' de 'não deu para ler'", () => {
  assert.match(papel, /Promise<"dono" \| "morador" \| null \| "falhou">/);
  assert.match(papel, /const \{ data: p, error: erroImovel \} = await admin\.from\("properties"\)/);
  assert.match(papel, /if \(erroImovel\) return "falhou";/);
  assert.match(papel, /const \{ data: c, error: erroContrato \} = await admin\.from\("contratos"\)/);
  assert.match(papel, /if \(erroContrato\) return "falhou";/);
});

test("as duas ações de medição respondem 'não foi possível' (e não 'só o proprietário') quando a leitura falha", () => {
  const usos = fonte.match(/if \(papel === "falhou"\) return \{ ok: false, erro: MSG_MEDICAO_SEM_LEITURA \};/g) ?? [];
  assert.equal(usos.length, 2);
  assert.match(fonte, /const MSG_MEDICAO_SEM_LEITURA = "Não foi possível conferir o imóvel agora\. Tente de novo\."/);
  assert.equal((fonte.match(/Só o proprietário do imóvel \(ou o morador/g) ?? []).length, 2);
});
