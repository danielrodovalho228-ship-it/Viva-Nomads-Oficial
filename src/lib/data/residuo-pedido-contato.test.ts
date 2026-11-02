import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o pedido de contato/candidatura nunca cria lead duplicado (nem pula o teto por hora)
 * por leitura falha — leads não tem índice único em (imóvel, interessado).
 */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function requestLead(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("requestLead: contagem da última hora com erro para antes de gravar", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroContagem) return { ok: false, error: MSG_CONTATO_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("LEAD_LIMITE_HORA"));
});

test("requestLead: leitura do lead existente com erro não vira 'contato novo'", () => {
  const g = f.indexOf("if (erroExistente) return { ok: false, error: MSG_CONTATO_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("novoContato = !existing;"));
  assert.ok(g < f.indexOf('.from("leads")\n        .insert('));
  assert.match(fonte, /const MSG_CONTATO_SEM_LEITURA = "Não foi possível enviar agora\. Tente de novo em instantes\.";/);
});
