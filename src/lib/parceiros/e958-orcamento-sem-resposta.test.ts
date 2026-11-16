/*
  E958 (coordenador, 16/11) — a Viva não promete a resposta do dono (terceiro); implementa a CONSEQUÊNCIA:
  pedido de parceiro com orçamento sem resposta do cliente em PRAZO_CANAL.pedidoParceiro (7 dias) → encerra sozinho
  + aviso ao parceiro. Texto público só onde a regra vale: "Se o proprietário não responder em 7 dias, o pedido é
  encerrado e você é avisado."
  Roda: node --test src/lib/parceiros/e958-orcamento-sem-resposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRAZO_CANAL, TEXTO_PRAZO_PEDIDO_PARCEIRO } from "../../config/prazos-canais.ts";
import { orcamentoSemResposta } from "./pedido.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DIA = 86_400_000;
const agora = new Date("2026-11-20T12:00:00Z");
const antes = (dias: number) => new Date(agora.getTime() - dias * DIA).toISOString();

test("E958 — o prazo é um canal próprio na fonte única e o texto é o decidido", () => {
  assert.deepEqual(PRAZO_CANAL.pedidoParceiro, { dias: 7, texto: "7 dias" });
  assert.equal(TEXTO_PRAZO_PEDIDO_PARCEIRO, "Se o proprietário não responder em 7 dias, o pedido é encerrado e você é avisado.");
});

test("E958 — só o orçamento parado há 7 dias ou mais encerra; outros estados nunca", () => {
  assert.equal(orcamentoSemResposta("orcado", antes(7), agora), true);
  assert.equal(orcamentoSemResposta("orcado", antes(6.9), agora), false);
  for (const s of ["solicitado", "aceito", "agendado", "entregue", "cancelado"]) assert.equal(orcamentoSemResposta(s, antes(30), agora), false, s);
  assert.equal(orcamentoSemResposta("orcado", null, agora), false);
});

test("E958 — o cron encerra (só se ainda orçado) e avisa o PARCEIRO; o evento está no catálogo", () => {
  const cron = ler("app/api/cron/automacoes/route.ts");
  assert.match(cron, /\.in\("status", \["agendado", "entregue", "orcado"\]\)/);
  assert.match(cron, /orcamentoSemResposta\(p\.status as string, p\.atualizado_em as string \| null, agora\)/);
  assert.match(cron, /update\(\{ status: "cancelado", atualizado_em: agora\.toISOString\(\) \}\)[\s\S]{0,120}\.eq\("status", "orcado"\)/);
  assert.match(cron, /tipo: "parceiro_orcamento_vencido", usuarioId: parceiroUser/);
  assert.match(TEMPLATES.parceiro_orcamento_vencido.body("Ana"), /não respondeu ao seu orçamento em 7 dias e o pedido foi encerrado/);
});

test("E958 — o texto do prazo aparece só onde a regra vale (a tela do pedido do parceiro, no orçado)", () => {
  const tela = ler("app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.match(tela, /d\.status === "orcado" && \([\s\S]{0,120}\{TEXTO_PRAZO_PEDIDO_PARCEIRO\}/);
  // Nenhuma outra página declara este prazo (nem o número escrito à mão).
  const raiz = new URL("../../", import.meta.url).pathname;
  const usos: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && /TEXTO_PRAZO_PEDIDO_PARCEIRO|o pedido é encerrado e você é avisado/.test(readFileSync(p, "utf8"))) usos.push(p.slice(raiz.length));
    }
  };
  andar(raiz);
  assert.deepEqual(usos.sort(), ["app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx", "config/prazos-canais.ts"]);
});
