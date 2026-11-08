/*
  Erros/estados vazios (rodada 11) — visitas (vídeo/presencial): falha de LEITURA não vira "Imóvel não encontrado ou
  indisponível" nem "Pedido não encontrado". Roda: node --test src/lib/data/e293-leituras-visitas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/visitas-video-actions.ts", import.meta.url), "utf8");

test("mensagem própria de falha de leitura, constante não exportada (arquivo use server)", () => {
  assert.match(s, /^const MSG_VISITA_SEM_LEITURA = "[^"]+";/m);
  assert.doesNotMatch(s, /export const MSG_VISITA_SEM_LEITURA/);
});

test("pedir a visita: erro ao ler o imóvel não vira 'Imóvel não encontrado ou indisponível'", () => {
  assert.match(s, /const \{ data: prop, error: erroImovel \} = await supabase\.from\("properties"\)/);
  assert.ok(s.indexOf("if (erroImovel) return { ok: false, error: MSG_VISITA_SEM_LEITURA };") < s.indexOf("Imóvel não encontrado ou indisponível."));
});

test("responder ao pedido: erro ao ler o pedido não vira 'Pedido não encontrado'", () => {
  assert.match(s, /const \{ data: v, error: erroPedido \} = await admin/);
  assert.match(s, /if \(erroPedido\) return \{ ok: false, error: MSG_VISITA_SEM_LEITURA \};\s*\n\s*if \(!v\) return \{ ok: false, error: "Pedido não encontrado\." \};/);
});
