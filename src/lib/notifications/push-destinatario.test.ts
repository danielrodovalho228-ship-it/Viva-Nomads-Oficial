/*
  Regra da coordenação (24/10, resposta sobre o #1245): o canal push obedece à preferência de quem RECEBE.
  • Push de equipe (pushParaCeo e afins): vale a chave do admin destinatário, nunca a da pessoa assunto do aviso.
  • Push de decisão/segurança para o próprio usuário: sem isenção escondida — respeita o push desligado dele.
  Roda: node --test src/lib/notifications/push-destinatario.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o filtro do push é pela lista de DESTINATÁRIOS (quem recebe), para todo envio", () => {
  const push = ler("src/lib/notifications/push.ts");
  // sendPushParaUsuarios filtra os próprios userIds que vai notificar — não recebe "assunto".
  assert.match(push, /export async function sendPushParaUsuarios\(\s*userIds: string\[\],/);
  assert.match(push, /userIds = await comPushLigado\(admin, userIds\);/);
  assert.doesNotMatch(push, /assunto|sobreQuem|subjectId/i);
});

test("push de equipe: vai aos admins pela marca deles; a preferência que vale é a do admin", () => {
  const equipe = ler("src/lib/notifications/push-admins.ts");
  assert.match(equipe, /const ids = \(await adminsPorAviso\("ceo"\)\)\.map\(\(a\) => a\.id\);\s*const r = await sendPushParaUsuarios\(ids, c\);/);
});

test("decisão e segurança não furam o push desligado (a isenção é só das categorias)", () => {
  const push = ler("src/lib/notifications/push.ts");
  assert.doesNotMatch(push, /decisao|seguranca/, "nenhuma exceção por categoria no filtro do canal push");
  const idx = ler("src/lib/notifications/index.ts");
  // As categorias com interruptor (mensagens, lembretes, outros) são as únicas que a pessoa desliga por tipo.
  assert.match(idx, /eventoDesligadoPelaPessoa\(event, \["mensagens", "lembretes", "outros"\]\)/);
});
