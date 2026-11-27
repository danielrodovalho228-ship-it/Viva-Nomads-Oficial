/*
  E1087 (ORDEM-DUET-432, classe B): as notificações push nunca mostravam os botões de ação ("Responder", "Ver proposta",
  "Ver visita", "Assinar") porque o servidor não enviava o `categoryId` (montarMensagens). O app (Viva-Nomads-App,
  src/push.ts › CATEGORIAS) já regista as categorias "mensagem", "proposta", "visita" e "assinatura"; os botões só
  ABREM a tela da decisão (data.url) — nenhuma decisão na notificação.
  O servidor passa a enviar o categoryId pelo evento (mensagem, proposta, visita); evento sem categoria: sem campo (só o
  toque, como antes). Vale também para os pushes adiados pelo silêncio (a categoria vem do evento original).
  Roda: node --test src/lib/notifications/e1087-botoes-do-push.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS_DO_APP, categoriaDoEvento, montarMensagens } from "./expo-push.ts";

test("E1087: as categorias são as que o app regista (mensagem, proposta, visita, assinatura)", () => {
  assert.deepEqual([...CATEGORIAS_DO_APP], ["mensagem", "proposta", "visita", "assinatura"]);
});

test("E1087: o evento escolhe a categoria — mensagem, proposta, visita; o resto fica sem botão", () => {
  assert.equal(categoriaDoEvento("new_message"), "mensagem");
  assert.equal(categoriaDoEvento("proposta_recebida"), "proposta");
  assert.equal(categoriaDoEvento("proposta_vencendo"), "proposta");
  assert.equal(categoriaDoEvento("visita_pedida"), "visita");
  assert.equal(categoriaDoEvento("visita_remarcada"), "visita");
  assert.equal(categoriaDoEvento("manutencao_nova"), null);
  assert.equal(categoriaDoEvento("adiado"), null);
  assert.equal(categoriaDoEvento(undefined), null);
});

test("E1087: a mensagem da Expo leva o categoryId quando há categoria; sem categoria, nenhum campo", () => {
  const [m] = montarMensagens(["ExponentPushToken[a]"], { title: "T", body: "B", url: "/dashboard/mensagens", categoria: "mensagem" });
  assert.equal(m.categoryId, "mensagem");
  assert.equal(m.data.url, "/dashboard/mensagens");
  const [s] = montarMensagens(["ExponentPushToken[a]"], { title: "T", body: "B", url: "/dashboard" });
  assert.equal("categoryId" in s, false);
});

test("E1087: o envio passa a categoria do evento — também no adiado (pela categoria guardada do evento original)", () => {
  const srv = readFileSync("src/lib/notifications/push-servidor.ts", "utf8");
  assert.match(srv, /sendPush\(\{ userId: p\.userId, title, body, url, evento: p\.event, categoria: categoriaDoEvento\(p\.event\) \}\)/);
  assert.match(srv, /select\("id, user_id, evento, titulo, corpo, url"\)/);
  assert.match(srv, /evento: "adiado", categoria: categoriaDoEvento\(l\.evento\)/);
  const push = readFileSync("src/lib/notifications/push.ts", "utf8");
  assert.match(push, /categoria\?: string \| null;/);
});
