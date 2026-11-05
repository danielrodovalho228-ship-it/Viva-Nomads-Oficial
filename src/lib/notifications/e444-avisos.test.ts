/*
  E444 (Relay 57, itens 1 e 2 — Pista B): a caixa de avisos do site.
  1. Tabela de avisos (0286) com RLS: cada um lê e marca só os seus; gravada pelo notify() junto do e-mail/push, do
     catálogo de eventos (fonte única); prioridade da tabela evento × papel; título sem contato nem dado sensível.
  2. Não lidas + maior prioridade pendente; marcar lido / marcar todas; crítico "resolvido" quando a ação é feita.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEMPLATES, type NotificationEvent } from "./eventos-email.ts";
import {
  ACAO_RESOLVE,
  EVENTOS_CRITICOS,
  EVENTOS_URGENTES,
  PRIORIDADE_POR_PAPEL,
  prioridadeDoAviso,
  resumoDosAvisos,
  tituloDoAviso,
  urlDoAviso,
} from "./avisos.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const EVENTOS = Object.keys(TEMPLATES) as NotificationEvent[];

test("todo evento do catálogo tem prioridade válida (fonte única); listas só com eventos que existem", () => {
  for (const e of EVENTOS) assert.ok(["critico", "urgente", "normal"].includes(prioridadeDoAviso(e)), e);
  for (const e of [...EVENTOS_CRITICOS, ...EVENTOS_URGENTES, ...Object.keys(PRIORIDADE_POR_PAPEL), ...Object.keys(ACAO_RESOLVE)]) {
    assert.ok(e in TEMPLATES, `evento fora do catálogo: ${e}`);
  }
  assert.equal(new Set(EVENTOS_CRITICOS).size + new Set(EVENTOS_URGENTES).size, new Set([...EVENTOS_CRITICOS, ...EVENTOS_URGENTES]).size, "evento em duas colunas");
});

test("tabela evento × papel: o papel muda a prioridade só onde está escrito", () => {
  assert.equal(prioridadeDoAviso("proposta_recebida"), "critico");
  assert.equal(prioridadeDoAviso("new_message"), "urgente");
  assert.equal(prioridadeDoAviso("boas_vindas"), "normal");
  assert.equal(prioridadeDoAviso("manutencao_nova", "dono"), "critico");
  assert.equal(prioridadeDoAviso("manutencao_nova", "morador"), "normal");
  assert.equal(prioridadeDoAviso("manutencao_nova"), "urgente");
  assert.equal(prioridadeDoAviso("parceiro_pedido_novo", "parceiro"), "critico");
  // Todo evento crítico com ação definida resolve por "assinou", "respondeu" ou "confirmou".
  for (const [e, a] of Object.entries(ACAO_RESOLVE)) assert.ok(["assinou", "respondeu", "confirmou"].includes(a!), e);
});

test("título só do catálogo (sem contato nem texto do usuário) e destino só interno", () => {
  for (const e of EVENTOS) {
    const t = tituloDoAviso(TEMPLATES[e].subject);
    assert.ok(t.length > 0 && t.length <= 160, e);
    assert.doesNotMatch(t, /@|https?:|\(\d{2}\)\s?\d|\d{4,}-?\d{4}|<|>/, e);
  }
  assert.equal(tituloDoAviso("  <b>Oi</b>\n"), "b Oi /b");
  assert.equal(urlDoAviso("/dashboard/propostas/1"), "/dashboard/propostas/1");
  for (const ruim of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", null, ""]) assert.equal(urlDoAviso(ruim as string | null), null, String(ruim));
});

test("resumo: não lidas e a maior prioridade ainda pendente (resolvido não conta para a prioridade)", () => {
  assert.deepEqual(resumoDosAvisos([]), { naoLidas: 0, maiorPrioridade: null });
  assert.deepEqual(
    resumoDosAvisos([
      { prioridade: "normal", lido_em: null, resolvido_em: null },
      { prioridade: "critico", lido_em: null, resolvido_em: "2026-11-02T10:00:00Z" },
      { prioridade: "urgente", lido_em: null, resolvido_em: null },
      { prioridade: "critico", lido_em: "2026-11-02T09:00:00Z", resolvido_em: null },
    ]),
    { naoLidas: 3, maiorPrioridade: "urgente" },
  );
  assert.deepEqual(resumoDosAvisos([{ prioridade: "critico", lido_em: null, resolvido_em: null }]), { naoLidas: 1, maiorPrioridade: "critico" });
});

test("notify grava o aviso do mesmo evento, com o título do catálogo; avisos internos não entram", () => {
  const idx = ler("./index.ts");
  assert.match(idx, /params\.userId && !params\.interno && !EVENTOS_INTERNOS\.has\(params\.event\)\s*\? comLimite\(gravarAviso\(/);
  const srv = ler("./avisos-servidor.ts");
  assert.match(srv, /titulo: p\.titulo \? tituloDoAviso\(guardContactInfo\(p\.titulo\)\.text\) : tituloDoAviso\(base\.subject\)/);
  assert.match(srv, /prioridade: p\.prioridade \?\? prioridadeDoAviso\(p\.evento, p\.papel\)/);
  assert.doesNotMatch(srv, /p\.subject|detailsText|\bemail\s*:|telefone|phone/);
});

test("crítico resolvido quando a ação é feita: assinou, respondeu, confirmou", () => {
  const assinar = ler("../data/contrato-assinar-actions.ts");
  assert.match(assinar, /resolverAvisos\(\{ usuarioId: user\.id, eventos: \["contract_status"\], refId: c\.id \}\)/);
  const prop = ler("../data/propostas-actions.ts");
  assert.equal((prop.match(/resolverAvisos\(\{ usuarioId: s\.user\.id, eventos: EVENTOS_RESPONDER, refId: p\.id \}\)/g) ?? []).length, 3, "recusar, aceitar, contrapropor");
  assert.match(prop, /refId: p\.id,/);
  const visita = ler("../data/visitas-video-actions.ts");
  assert.match(visita, /if \(quem === "dono"\) after\(\(\) => resolverAvisos\(\{ usuarioId: user\.id, eventos: \["visita_pedida"\], refId: v\.id as string \}\)\)/);
  assert.match(ler("../data/actions.ts"), /refId: contratoNovoId,/);
  assert.match(ler("../../app/api/cron/automacoes/route.ts"), /refId: a\.refId,/);
});

test("ações do sino: leitura que falha lança; marcar lido só os próprios", () => {
  const acoes = ler("../data/avisos-actions.ts");
  assert.match(acoes, /^"use server";/);
  assert.equal((acoes.match(/if \(error\) throw new Error\(MSG_AVISOS_SEM_LEITURA\);/g) ?? []).length, 2);
  assert.equal((acoes.match(/\.eq\("usuario_id", s\.userId\)/g) ?? []).length, 4);
});

test("migração 0286: RLS, só lido_em editável pela pessoa, url interna, aplicar idempotente e rollback", () => {
  const mig = ler("../../../supabase/migrations/0286_avisos_site.sql");
  const apl = ler("../../../supabase/producao/aplicar-0286.sql");
  const rb = ler("../../../supabase/producao/rollback/0286_rollback.sql");
  for (const sql of [mig, apl]) {
    assert.match(sql, /create table if not exists public\.avisos/);
    assert.match(sql, /prioridade in \('critico', 'urgente', 'normal'\)/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /using \(usuario_id = auth\.uid\(\)\)/);
    assert.match(sql, /grant update \(lido_em\) on public\.avisos to authenticated;/);
    assert.match(sql, /url like '\/%' and url not like '\/\/%'/);
  }
  assert.match(apl, /^begin;/m);
  assert.match(apl, /^commit;/m);
  assert.match(apl, /'0286_avisos_site'/);
  assert.match(rb, /drop table if exists public\.avisos;/);
});
