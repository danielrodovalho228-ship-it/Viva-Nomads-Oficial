/*
  E551 (desenho aprovado E445) — mensagens: "visto", anexo e o estado lido/não lido na lista de conversas.
  O "Visto" (E445 item 4) e o anexo de foto/PDF até 10 MB (E445 item 5) já estavam na main; faltava a LISTA mostrar
  quais conversas têm mensagem recebida não lida (o servidor já contava `naoLidas` pelo lido_em, a tela não usava).
  Roda: node --test src/lib/messages/e551-nao-lidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const tela = ler("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx");

test("lista de conversas: selo com o número de não lidas, nome em negrito e estado lido/não lido", () => {
  assert.match(tela, /data-lida=\{c\.naoLidas \? "nao" : "sim"\}/);
  assert.match(tela, /data-testid="mensagens-nao-lidas"/);
  assert.match(tela, /\{c\.naoLidas > 99 \? "99\+" : c\.naoLidas\}/);
  assert.match(tela, /c\.naoLidas \? "font-semibold" : "font-medium"/);
});

test("abrir a conversa a marca como lida: servidor grava lido_em e o selo some na hora", () => {
  assert.match(tela, /marcarConversaAberta\(conversaAbertaId\)/);
  // Com o E481 (Pista C) na main: a lista zera a conversa aberta pela mesma troca, junto do aviso ao sino.
  assert.match(tela, /c\.id === conversaAbertaId && c\.naoLidas \? \{ \.\.\.c, naoLidas: 0 \} : c/);
  assert.match(ler("src/lib/data/conversa-aberta-actions.ts"), /update\(\{ lido_em: new Date\(\)\.toISOString\(\) \}\)\.eq\("conversation_id", conversationId\)\.eq\("receiver_id", user\.id\)\.is\("lido_em", null\)/);
  assert.match(ler("src/lib/data/messages.ts"), /if \(!mine && m\.lido_em === null\) conv\.naoLidas = \(conv\.naoLidas \?\? 0\) \+ 1;/);
});

test("o resto do desenho segue: 'Visto' na última mensagem lida e o botão de anexo (foto/PDF)", () => {
  assert.match(tela, /m\.from === "me" && m\.visto && m\.id === ultimaMinhaVista/);
  assert.match(tela, /BotaoAnexar/);
});
