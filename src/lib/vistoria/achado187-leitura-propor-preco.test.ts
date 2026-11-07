import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 187 (varredura "leitura que falha não vira outra resposta"): proporPrecoEPrazo (o avaliador aceita propondo
 * valor e prazo) lia o pedido e gravava a aceitação sem olhar o erro — a falha virava "A proposta deste pedido já foi
 * enviada." ou "O prazo de 24 horas para responder já passou.", e o avaliador achava que tinha perdido o pedido.
 */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function proporPrecoEPrazo(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("proporPrecoEPrazo: leitura do pedido com erro não vira 'a proposta já foi enviada'", () => {
  assert.match(f, /const \{ data: ref, error: erroRef \} = await c\.admin\.from\("vistoria_pedidos"\)/);
  const g = f.indexOf("if (erroRef) return { ok: false, erro: MSG_VISTORIA_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("A proposta deste pedido já foi enviada."));
});

test("proporPrecoEPrazo: erro ao gravar a aceitação não vira 'o prazo de 24 horas já passou'", () => {
  assert.match(f, /const \{ data, error: erroAceite \} = await c\.admin\.from\("vistoria_designacoes"\)\.update/);
  const g = f.indexOf("if (erroAceite) return { ok: false, erro: MSG_VISTORIA_SEM_LEITURA };");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("O prazo de 24 horas para responder já passou."));
});
