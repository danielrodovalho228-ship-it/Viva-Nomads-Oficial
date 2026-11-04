/*
  E533 (GRAVE) — sino: cobertura dos eventos e "marcar como lida".
  Diagnóstico (produção, leitura): desde que a tabela de avisos existe (02/11 18:11), 13 de 13 e-mails com destinatário
  viraram aviso; os ~11 que faltaram no QA de 02/11 foram enviados ANTES do sino existir. O que seguia quebrado:
  1. não havia "Marcar todas como lidas" (só o clique em um aviso);
  2. ler a conversa não baixava o aviso de mensagem nova (o aviso nem guardava a conversa);
  3. um aviso marcado lido "voltava" quando uma leitura em curso chegava depois (estado velho por cima);
  4. "pedido moderado" saía sem o id do destinatário (nunca virava aviso).
  Roda: node --test src/lib/notifications/e533-sino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("marcar todas: rota aceita { todos: true }, ação do servidor e botões no sino e na lista", () => {
  const rota = ler("src/app/api/painel/avisos/route.ts");
  assert.match(rota, /corpo\?\.todos === true/);
  assert.match(rota, /marcarTodosAvisosLidos\(\)/);
  const sino = ler("src/components/painel/sino-avisos.tsx");
  assert.match(sino, /export function marcarTodosLidos\(/);
  assert.match(sino, /JSON\.stringify\(\{ todos: true \}\)/);
  assert.match(sino, /data-testid=\{`sino-\$\{px\}-marcar-todas`\}/);
  assert.match(ler("src/components/account/lista-avisos.tsx"), /data-testid="avisos-marcar-todas"/);
});

test("leitura em curso não desfaz o que acabou de ser marcado (versão do estado)", () => {
  const sino = ler("src/components/painel/sino-avisos.tsx");
  assert.match(sino, /let versao = 0;/);
  assert.match(sino, /const v = versao;/);
  assert.match(sino, /if \(v !== versao\) return;/);
  assert.ok((sino.match(/versao\+\+;/g) ?? []).length >= 2, "marcar um e marcar todas mudam a versão");
});

test("mensagem nova: o aviso guarda a conversa e abrir a conversa marca esses avisos como lidos", () => {
  const acoes = ler("src/lib/data/actions.ts");
  const i = acoes.indexOf('event: "new_message"');
  assert.match(acoes.slice(i, i + 600), /refId: conversationId,/);
  const aberta = ler("src/lib/data/conversa-aberta-actions.ts");
  assert.match(aberta, /from\("avisos"\)\.update\(\{ lido_em: agora \}\)\.eq\("usuario_id", user\.id\)\.eq\("evento", "new_message"\)\.eq\("ref_id", conversationId\)\.is\("lido_em", null\)/);
});

test("pedido moderado chega ao sino (com o id do morador)", () => {
  const p = ler("src/lib/data/pedidos-admin.ts");
  const i = p.indexOf('event: "pedido_moderado"');
  assert.match(p.slice(i, i + 300), /userId: pedido\.inquilino_id as string,/);
});
