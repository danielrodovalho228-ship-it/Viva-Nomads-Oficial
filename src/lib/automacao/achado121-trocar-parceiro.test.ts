/*
  Frente 1, rodada 2 — achado 121 (média): "Trocar parceiro" (pedido automático) lia a cidade do imóvel e os parceiros
  já tentados sem conferir o erro. Na falha: a busca ia sem cidade (parceiro de outra cidade) ou o pedido voltava a quem
  já tinha recusado — e o pedido atual já tinha sido cancelado. Agora as leituras recusam antes de cancelar.
  Roda: node --test src/lib/automacao/achado121-trocar-parceiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./acoes.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function trocarParceiro"), src.indexOf("// ── Admin: rodar a automação do dia"));

test("trocar parceiro: sem a cidade ou os já tentados, recusa antes de cancelar o pedido atual", () => {
  const guarda = fn.indexOf('if (e1 || e2) return { ok: false, erro: "Não foi possível trocar o parceiro agora. Tente de novo." };');
  assert.ok(guarda > 0, "guarda existe");
  assert.ok(guarda < fn.indexOf("buscarParceiros("), "antes de buscar o próximo");
  assert.ok(guarda < fn.indexOf('status: "cancelado"'), "antes de cancelar o pedido atual");
});
