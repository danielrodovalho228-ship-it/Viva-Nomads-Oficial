import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Achado 183 (varredura "leitura que falha não vira outra resposta"): em pedirVisita e responderVisita, a leitura do
 * imóvel / do pedido sem olhar o erro virava "Imóvel não encontrado ou indisponível." / "Pedido não encontrado.".
 */
const fonte = readFileSync(new URL("./visitas-video-actions.ts", import.meta.url), "utf8");
const pedir = fonte.slice(fonte.indexOf("export async function pedirVisita("), fonte.indexOf("export async function listVisitasDono("));
const responder = fonte.slice(fonte.indexOf("export async function responderVisita("), fonte.indexOf("export async function visitaDaConversa("));

test("pedirVisita: leitura do imóvel com erro não vira 'Imóvel não encontrado ou indisponível'", () => {
  assert.match(pedir, /const \{ data: prop, error: erroImovel \} = await supabase\.from\("properties"\)/);
  const g = pedir.indexOf("if (erroImovel)");
  assert.ok(g >= 0);
  assert.match(pedir.slice(g, g + 150), /Não foi possível ler o imóvel agora/);
  assert.ok(g < pedir.indexOf("Imóvel não encontrado ou indisponível."));
});

test("responderVisita: leitura do pedido com erro não vira 'Pedido não encontrado'", () => {
  assert.match(responder, /const \{ data: v, error: erroPedido \} = await admin\s*\.from\("visitas_video"\)/);
  const g = responder.indexOf("if (erroPedido)");
  assert.ok(g >= 0);
  assert.match(responder.slice(g, g + 150), /Não foi possível ler o pedido agora/);
  assert.ok(g < responder.indexOf("if (!v) return"));
});
