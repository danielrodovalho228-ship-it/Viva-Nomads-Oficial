/*
  Manutenção — F27/F28 (ordem dd8422ce) e critérios de aceite do Daniel
  (ordens b9e73a4b e 48f96269): contrato ativo, prazo visível por prioridade,
  os dois lados, status + histórico + réplica, notificações ligadas por padrão.
  Roda: node --test src/lib/manutencao-solicitacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  camposTransicao,
  contratoPermiteManutencao,
  linhaParaOrdem,
  MSG_SEM_CONTRATO_MANUTENCAO,
  prazoDaOrdem,
  proximosStatus,
  STATUS_CONTRATO_COM_MANUTENCAO,
  textoEvento,
  validarMensagem,
} from "./manutencao-solicitacoes.ts";
import { EXEMPLOS_MANUTENCAO, PRAZO_MANUTENCAO_H, frasePrazosManutencao, responderAte } from "../config/atendimento.ts";
import { FAQ, respostaPara } from "./atendimento/faq.ts";
import { notificacaoLigada } from "./notifications/preferencias.ts";
import { imoveisPublicados, imovelPublicado } from "./anuncio/publicados.ts";
import { nextStatus, SO_STATUS_META } from "./service-orders.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const raiz = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-10-12T20:00:00Z"); // 17:00 em Brasília

test("linha do banco vira ServiceOrder; valores desconhecidos caem no padrão seguro", () => {
  const o = linhaParaOrdem({ id: "1", category: "hidraulica", priority: "urgente", description: "Vazamento", status: "visto", opened_at: "2026-10-12T10:00:00Z", first_response_at: "2026-10-12T11:00:00Z", resolved_at: null, properties: { title: "Studio Centro" }, tenant_name: "Ana" });
  assert.deepEqual([o.property, o.tenantName, o.category, o.priority, o.status, o.firstResponseAt], ["Studio Centro", "Ana", "hidraulica", "urgente", "visto", "2026-10-12T11:00:00Z"]);
  const x = linhaParaOrdem({ id: "2", category: "<script>", priority: "???", description: "d", status: "lixo", opened_at: "2026-10-12T10:00:00Z", first_response_at: null, resolved_at: null });
  assert.deepEqual([x.category, x.priority, x.status, x.property], ["outros", "media", "aberto", "Imóvel"]);
});

test("critério 1: manutenção só com contrato/imóvel ativo do inquilino (desde o #416) — tela e servidor", () => {
  assert.deepEqual([...STATUS_CONTRATO_COM_MANUTENCAO], ["ativo", "encerrado_em_acerto"]);
  assert.match(MSG_SEM_CONTRATO_MANUTENCAO, /contrato ativo/);
  const ui = ler("app/(dashboard)/dashboard/solicitacoes/page.tsx");
  assert.match(ui, /data-testid="manutencao-sem-contrato"/);
  assert.match(ui, /href="\/ajuda"/);
  assert.match(ui, /disabled=\{semContrato\}/);
  // O servidor confere o contrato: é do inquilino e está ativo (o RLS "inquilino abre chamado", F1, também).
  const srv = ler("lib/atendimento/servidor.ts");
  const criar = srv.slice(srv.indexOf("export async function criarOrdemManutencao"));
  assert.match(criar, /ct\.tenant_id !== input\.tenantId \|\| !contratoPermiteManutencao\(ct/);
});

test("critério 2: prazo por prioridade (4/24/72 h) com 'responder até' em data/hora de Brasília", () => {
  assert.deepEqual(PRAZO_MANUTENCAO_H, { urgente: 4, media: 24, baixa: 72 });
  assert.equal(responderAte("urgente", AGORA), "responder até 12/10/2026, 21:00 (horário de Brasília)");
  assert.equal(responderAte("media", AGORA), "responder até 13/10/2026, 17:00 (horário de Brasília)");
  assert.equal(responderAte("baixa", AGORA), "responder até 15/10/2026, 17:00 (horário de Brasília)");
  const base = { priority: "urgente" as const, openedAt: AGORA.toISOString(), status: "aberto" as const };
  assert.equal(prazoDaOrdem(base, new Date(AGORA.getTime() + 3 * 3_600_000)).estado, "no_prazo");
  assert.equal(prazoDaOrdem(base, new Date(AGORA.getTime() + 5 * 3_600_000)).estado, "vencido");
  assert.equal(prazoDaOrdem({ ...base, firstResponseAt: AGORA.toISOString() }, new Date(AGORA.getTime() + 9e7)).estado, "respondida");
  assert.match(prazoDaOrdem(base, AGORA).texto, /^Responder até 12\/10\/2026, 21:00 \(horário de Brasília\)$/);
});

test("critério 2: exemplos do FAQ no seletor — uma fonte só (config/atendimento.ts)", () => {
  assert.equal(EXEMPLOS_MANUTENCAO.urgente, "sem água, sem luz, vazamento");
  const faq = FAQ.find((p) => p.id === "manutencao")!;
  for (const perfil of ["visitante", "sem_contrato", "com_contrato"] as const) {
    const r = respostaPara(faq, perfil);
    assert.ok(r.includes(frasePrazosManutencao()), `FAQ (${perfil}) usa a frase única`);
    for (const ex of Object.values(EXEMPLOS_MANUTENCAO)) assert.ok(r.includes(ex));
  }
  // Nenhum número de prazo escrito à mão fora da config.
  assert.doesNotMatch(ler("lib/atendimento/faq.ts"), /4 horas em urg/);
  assert.doesNotMatch(ler("lib/atendimento/viva-prompt.ts"), /PRAZO_MANUTENCAO_H\.urgente\} horas/);
  const cartao = ler("components/manutencao/cartao-ordem.tsx");
  assert.match(cartao, /EXEMPLOS_MANUTENCAO\[p\]/);
  assert.match(cartao, /PRAZO_MANUTENCAO_H\[p\]/);
  assert.match(cartao, /data-testid="prazo-previsto"/);
  assert.match(cartao, /data-testid="prazo-ordem"/);
});

test("critério 3: a mesma ordem aparece no painel do proprietário e no do inquilino", () => {
  const ui = ler("app/(dashboard)/dashboard/solicitacoes/page.tsx");
  assert.match(ui, /<CartaoOrdem key=\{o\.id\} o=\{o\} papel="proprietario"/);
  assert.match(ui, /papel="inquilino"/);
  assert.match(ui, /minhasSolicitacoes\(\)/);
  assert.match(ui, /abrirChamado\(\{[\s\S]*categoria: "manutencao"[\s\S]*contratoId: alvo/);
  const submit = ui.slice(ui.indexOf("async function submit"));
  assert.ok(submit.indexOf("return;") < submit.indexOf("const novo: ServiceOrder"), "ramo real retorna antes do exemplo local");
});

test("critério 4: status Aberta → Em atendimento → Resolvida, por lado", () => {
  assert.deepEqual(proximosStatus("aberto", "proprietario"), ["em_andamento", "resolvido"]);
  assert.deepEqual(proximosStatus("em_andamento", "proprietario"), ["resolvido"]);
  assert.deepEqual(proximosStatus("visto", "proprietario"), ["resolvido"]); // estado antigo = em atendimento
  assert.deepEqual(proximosStatus("aberto", "inquilino"), ["resolvido"]);
  assert.deepEqual(proximosStatus("resolvido", "inquilino"), []);
  assert.deepEqual(proximosStatus("resolvido", "proprietario"), []);
  assert.equal(SO_STATUS_META.em_andamento.label, "Em atendimento");
  assert.equal(SO_STATUS_META.visto.label, "Em atendimento");
  assert.equal(nextStatus("aberto"), "em_andamento");
  assert.equal(nextStatus("visto"), "resolvido");
});

test("critério 4: carimbos — 1ª ação do proprietário = primeira resposta; inquilino não volta status", () => {
  const iso = AGORA.toISOString();
  assert.deepEqual(camposTransicao("aberto", "em_andamento", "proprietario", null, AGORA), { status: "em_andamento", first_response_at: iso });
  assert.deepEqual(camposTransicao("em_andamento", "resolvido", "proprietario", "x", AGORA), { status: "resolvido", resolved_at: iso });
  assert.deepEqual(camposTransicao("aberto", "resolvido", "inquilino", null, AGORA), { status: "resolvido", resolved_at: iso });
  assert.equal(camposTransicao("aberto", "em_andamento", "inquilino", null, AGORA), null);
  assert.equal(camposTransicao("resolvido", "em_andamento", "proprietario", "x", AGORA), null);
  assert.equal(camposTransicao("em_andamento", "aberto", "proprietario", "x", AGORA), null);
});

test("critério 4: histórico com data/hora de Brasília e réplica validada", () => {
  assert.equal(textoEvento({ tipo: "aberto", papel: "inquilino", statusPara: "aberto", criadoEm: AGORA.toISOString() }), "12/10/2026, 17:00 — Inquilino abriu a ordem");
  assert.equal(textoEvento({ tipo: "status", papel: "proprietario", statusPara: "em_andamento", criadoEm: AGORA.toISOString() }), "12/10/2026, 17:00 — Proprietário mudou para Em atendimento");
  assert.deepEqual(validarMensagem("  oi  "), { ok: true, texto: "oi" });
  assert.equal(validarMensagem("   ").ok, false);
  assert.equal(validarMensagem("x".repeat(2001)).ok, false);
  assert.equal(validarMensagem(42).ok, false);
});

test("ações do servidor: sessão, UUID, só as partes (RLS), dono grava pelo RLS, inquilino só 'resolvida'", () => {
  const a = ler("lib/data/manutencao-actions.ts");
  assert.match(a, /^"use server";/);
  for (const fn of ["detalheSolicitacao", "mudarStatusSolicitacao", "responderSolicitacao"]) {
    const corpo = a.slice(a.indexOf(`export async function ${fn}`));
    assert.match(corpo, /if \(!UUID_RE\.test\(id \?\? ""\)\)/, fn);
    assert.match(corpo, /Sessão expirada/, fn);
    assert.match(corpo, /await ordemDaParte\(s, id\)/, fn);
  }
  // A ordem é lida pelo cliente da sessão (RLS "chamados das partes"), não pelo service role.
  const parte = a.slice(a.indexOf("async function ordemDaParte"), a.indexOf("async function avisarOutraParte"));
  assert.match(parte, /s\.supabase\.from\("service_orders"\)/);
  assert.doesNotMatch(parte, /admin/);
  const mudar = a.slice(a.indexOf("export async function mudarStatusSolicitacao"), a.indexOf("export async function responderSolicitacao"));
  assert.match(mudar, /camposTransicao\(atual, novo, papel/);
  assert.match(mudar, /s\.supabase\.from\("service_orders"\)\.update\(campos\)\.eq\("id", id\)\.eq\("owner_id", s\.uid\)\.eq\("status", atual\)/);
  assert.match(mudar, /admin\.from\("service_orders"\)\.update\(campos\)\.eq\("id", id\)\.eq\("tenant_id", s\.uid\)\.eq\("status", atual\)/);
  assert.match(mudar, /service_order_eventos/);
  const resp = a.slice(a.indexOf("export async function responderSolicitacao"));
  assert.match(resp, /validarMensagem\(texto\)/);
  assert.match(resp, /consumirLimite\(`manutencao-msg:\$\{s\.uid\}`/);
  assert.match(resp, /guardContactInfo\(v\.texto\)/);
  assert.match(a, /avisarOutraParte\(ordem, papel, "manutencao_atualizada"\)/);
  assert.match(a, /avisarOutraParte\(alvo\.ordem, alvo\.papel, "manutencao_mensagem"\)/);
});

test("critério 5: notificações ligadas por padrão e /dashboard/notificacoes existe", () => {
  assert.equal(notificacaoLigada(undefined), true);
  assert.equal(notificacaoLigada(null), true);
  assert.equal(notificacaoLigada(true), true);
  assert.equal(notificacaoLigada(false), false);
  assert.match(ler("lib/data/pedidos-actions.ts"), /email: notificacaoLigada\(data\?\.notif_email\)/);
  assert.match(ler("lib/atendimento/servidor.ts"), /notificacaoLigada\(dono\.notif_email/);
  const pagina = ler("app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(pagina, /<PageTitle/);
  assert.match(pagina, /<StatCard/);
  assert.match(pagina, /<NotificationsPanel \/>/);
  assert.match(ler("components/account/conta-menu.tsx"), /href: "\/dashboard\/notificacoes"/);
  const sql = raiz("supabase/migrations/0109_manutencao_historico.sql");
  assert.match(sql, /alter column notif_email set default true/);
  assert.match(sql, /alter column notif_whatsapp set default true/);
});

test("migração 0109: produção = migração, idempotente, sem NOTICE, com rollback, sem mexer na F1", () => {
  const mig = raiz("supabase/migrations/0109_manutencao_historico.sql");
  const prod = raiz("supabase/producao/aplicar-0109.sql");
  const corpo = (s: string) => s.split("\n").filter((l) => !l.startsWith("-- Viva Nomads") && !/^-- (Idempotente|Produção|Aplicada|Rollback)/.test(l)).join("\n");
  assert.ok(corpo(prod).includes(corpo(mig).trim()), "aplicar-0109 traz o corpo inteiro da 0109");
  assert.match(prod, /^begin;$/m);
  assert.match(prod, /^commit;$/m);
  assert.match(prod, /'20261012000109', '0109_manutencao_historico'/);
  assert.doesNotMatch(mig, /if not exists public\.|create table if not exists|drop policy if exists/i);
  assert.match(mig, /to_regclass\('public\.service_order_eventos'\) is null/);
  assert.doesNotMatch(mig, /inquilino abre chamado|proprietário atualiza status/);
  assert.match(mig, /revoke insert, update, delete on public\.service_order_messages from authenticated/);
  assert.ok(existsSync(new URL("../../supabase/producao/rollback/0109_rollback.sql", import.meta.url)));
});

test("F31: Visão geral usa a mesma consulta e a mesma regra de 'publicado' de Meus imóveis", () => {
  assert.equal(imovelPublicado({ status: "active" }), true);
  assert.equal(imovelPublicado({ status: "draft" }), false);
  assert.deepEqual(imoveisPublicados([{ status: "active" }, { status: "paused" }]), [{ status: "active" }]);
  const pagina = ler("app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /await listMyProperties\(\)/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/page.tsx"), /listMyProperties\(\)/);
  const visao = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.match(visao, /imoveisPublicados\(demo \? DEMO_PROPERTIES : imoveisDono\)/);
  assert.doesNotMatch(visao, /useProperties\("\/api\/properties\/mine"\)/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /imovelPublicado\(p\)/);
});

test("textos: imóveis mobiliados, Caução; nunca 'vistoria' nas telas novas", () => {
  for (const f of [
    "components/manutencao/cartao-ordem.tsx",
    "app/(dashboard)/dashboard/notificacoes/page.tsx",
    "app/(dashboard)/dashboard/solicitacoes/page.tsx",
  ]) {
    assert.doesNotMatch(ler(f), /vistoria/i, f);
  }
});

test("F27 (a8905671): 'ativo' no banco não basta — só contrato Em vigência (ou em acerto) aceita manutenção", () => {
  const ass = { assinado_proprietario_em: "2026-10-01T10:00:00Z", assinado_inquilino_em: "2026-10-02T10:00:00Z" };
  const pago = [{ tipo: "aluguel", confirmado_pelo_inquilino: true }];
  // Aguardando assinatura (o caso do QA): status ativo, sem assinaturas.
  assert.equal(contratoPermiteManutencao({ status: "ativo", pagamentos_bloco: [] }), false);
  assert.equal(contratoPermiteManutencao({ status: "ativo", assinado_proprietario_em: ass.assinado_proprietario_em, pagamentos_bloco: pago }), false);
  // Assinado, mas sem o 1º pagamento confirmado: aguardando pagamento.
  assert.equal(contratoPermiteManutencao({ status: "ativo", ...ass, pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: false }] }), false);
  assert.equal(contratoPermiteManutencao({ status: "ativo", ...ass, pagamentos_bloco: [{ tipo: "caucao", confirmado_pelo_inquilino: true }] }), false);
  // Em vigência e em acerto de saída: pode.
  assert.equal(contratoPermiteManutencao({ status: "ativo", ...ass, pagamentos_bloco: pago }), true);
  assert.equal(contratoPermiteManutencao({ status: "encerrado_em_acerto" }), true);
  // Outros status: não.
  for (const status of ["cancelado", "concluido", "encerrado_sem_renovacao", null]) assert.equal(contratoPermiteManutencao({ status, ...ass, pagamentos_bloco: pago }), false);
});

test("F27: servidor, formulário, Viva e Central usam a MESMA regra (contratoPermiteManutencao)", () => {
  for (const f of ["lib/atendimento/servidor.ts", "lib/data/manutencao-actions.ts", "lib/data/atendimento-actions.ts", "lib/atendimento/viva-servidor.ts"]) {
    assert.match(ler(f), /contratoPermiteManutencao/, f);
  }
  const srv = ler("lib/atendimento/servidor.ts");
  const criar = srv.slice(srv.indexOf("export async function criarOrdemManutencao"), srv.indexOf("export async function avisarProprietarioManutencao"));
  assert.doesNotMatch(criar, /includes\(ct\.status/); // o status sozinho não decide mais
  assert.match(criar, /contratoPermiteManutencao\(c as ContratoParaManutencao\)/); // nem na escolha do contrato único
});

test("F27 parte 2: a ordem nasce vinculada ao contrato (contrato_id, migração 0118) com backfill seguro e rollback", () => {
  assert.match(ler("lib/atendimento/servidor.ts"), /contrato_id: ct\.id/);
  const mig = raiz("supabase/migrations/0118_service_orders_contrato.sql");
  assert.match(mig, /add column if not exists contrato_id uuid references public\.contratos/);
  assert.match(mig, /having count\(\*\) = 1/);
  const prod = raiz("supabase/producao/aplicar-0118.sql");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /commit;\s*$/);
  assert.match(prod, /0118_service_orders_contrato/);
  assert.match(raiz("supabase/producao/rollback/0118_rollback.sql"), /drop column if exists contrato_id/);
});
