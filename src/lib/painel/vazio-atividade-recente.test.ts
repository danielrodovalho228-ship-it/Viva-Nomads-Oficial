/*
  Início do proprietário, painel "Atividade recente": fora da demonstração ele não tem feed e dizia sempre "Sem
  atividade recente ainda." — mesmo com interessados, propostas e visitas. Agora diz onde as novidades chegam
  (Notificações) e leva até lá. O título do painel fica (é âncora de outras guardas).
  Roda: node --test src/lib/painel/vazio-atividade-recente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/visao-geral-client.tsx", import.meta.url), "utf8");

test("'Atividade recente' sem a frase genérica fixa: aponta para Notificações, com link", () => {
  assert.match(tela, /<Panel title="Atividade recente">/);
  assert.doesNotMatch(tela, /Sem atividade recente ainda\./);
  const bloco = tela.slice(tela.indexOf('<Panel title="Atividade recente">'));
  assert.match(bloco, /data-testid="atividade-recente-vazia"/);
  assert.match(bloco, /interessados, propostas, visitas e avisos/);
  assert.match(bloco, /<Link href="\/dashboard\/notificacoes"/);
});
