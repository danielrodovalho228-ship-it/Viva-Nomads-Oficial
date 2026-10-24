/*
  Push respeita a preferência da tela Conta › Notificações (A6, perfil-06): "Notificação no celular (push)" desligada
  = nenhum push sai para a pessoa. A tela grava user_metadata.notif_push; o envio lê antes de buscar os aparelhos.
  Roda: node --test src/lib/notifications/push-preferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pushLigado } from "./preferencias.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("só um false gravado desliga o push (sem preferência = ligado)", () => {
  assert.equal(pushLigado({ notif_push: false }), false);
  assert.equal(pushLigado({ notif_push: true }), true);
  assert.equal(pushLigado({}), true);
  assert.equal(pushLigado(null), true);
  assert.equal(pushLigado(undefined), true);
  assert.equal(pushLigado({ notif_push: "false" }), true, "só booleano conta, como na tela");
});

test("a tela grava a mesma chave que o envio lê", () => {
  assert.match(ler("src/lib/data/canais-actions.ts"), /updateUser\(\{ data: \{ notif_push: c\.push \} \}\)/);
  assert.match(ler("src/lib/notifications/preferencias.ts"), /meta\?\.notif_push/);
});

test("sendPushParaUsuarios filtra quem desligou ANTES de ler os aparelhos, e tudo passa por ele", () => {
  const push = ler("src/lib/notifications/push.ts");
  const corpo = push.slice(push.indexOf("export async function sendPushParaUsuarios"));
  const filtro = corpo.indexOf("userIds = await comPushLigado(admin, userIds);");
  assert.ok(filtro > 0, "filtro da preferência no envio");
  assert.ok(filtro < corpo.indexOf('from("push_tokens")'), "o filtro vem antes da leitura dos tokens");
  assert.match(push, /admin\.auth\.admin\.getUserById\(id\)/);
  assert.match(push, /return pushLigado\(data\.user\.user_metadata/);
  // sendPush (notify e adiados das 7h) e o push da equipe usam sendPushParaUsuarios: nenhum caminho por fora.
  assert.match(push, /export async function sendPush\([\s\S]*?return sendPushParaUsuarios\(\[params\.userId\], params\);/);
  assert.match(ler("src/lib/notifications/push-servidor.ts"), /enviarPushAdiados[\s\S]*?sendPush\(\{ userId: l\.user_id/);
  assert.match(ler("src/lib/notifications/push-admins.ts"), /sendPushParaUsuarios\(ids, c\)/);
  for (const arq of ["src/lib/notifications/push-servidor.ts", "src/lib/notifications/push-admins.ts", "src/lib/data/push-actions.ts"]) {
    assert.doesNotMatch(ler(arq), /enviarExpo|enviarFcm|exp\.host|fcm\.googleapis/, `${arq} não envia por fora`);
  }
});

test("teste do admin com push desligado diz onde ligar", () => {
  assert.match(ler("src/lib/data/push-actions.ts"), /O push está desligado em Conta › Notificações/);
});
