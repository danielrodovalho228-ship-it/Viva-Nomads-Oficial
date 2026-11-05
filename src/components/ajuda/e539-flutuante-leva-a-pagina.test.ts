/*
  E539 (v) — no painel, o botão flutuante "Fale com a Viva" abria uma janela com o MESMO chat que a página dedicada
  (/ajuda/fale-com-a-viva) já tem: duas telas para a mesma conversa. Correção: no painel (/dashboard) o botão leva à
  página dedicada (o chat e o "Abrir chamado" num lugar só) em vez de abrir a janela. No site público nada muda.
  Roda: node --test src/components/ajuda/e539-flutuante-leva-a-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flutuanteLevaAPagina } from "../../lib/atendimento/flutuante-visivel.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("no painel o flutuante leva à página; no site público abre o chat", () => {
  assert.equal(flutuanteLevaAPagina("/dashboard"), true);
  assert.equal(flutuanteLevaAPagina("/dashboard/estadia/abc"), true);
  assert.equal(flutuanteLevaAPagina("/"), false);
  assert.equal(flutuanteLevaAPagina("/imoveis/x"), false);
  assert.equal(flutuanteLevaAPagina("/dashboardx"), false);
});

test("o clique no painel navega para a página dedicada, sem abrir a janela do chat", () => {
  const src = ler("components/ajuda/viva-chat.tsx");
  const corpo = src.slice(src.indexOf("export function VivaChatFlutuante"), src.indexOf("function PainelChat"));
  assert.match(corpo, /const levaAPagina = flutuanteLevaAPagina\(pathname\);/);
  assert.match(corpo, /if \(levaAPagina\) return router\.push\(HREF_FALE_COM_A_VIVA\);\s*setAberto\(\(v\) => !v\);/);
  assert.match(corpo, /aria-expanded=\{levaAPagina \? undefined : aberto\}/);
});
