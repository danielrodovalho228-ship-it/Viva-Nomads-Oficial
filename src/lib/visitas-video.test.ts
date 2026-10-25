/*
  Visita por vídeo (ordem 6f964617, telas 8 e 9): horários, link da chamada, transições e RLS da migração 0148.
  Roda: node --experimental-strip-types --test src/lib/visitas-video.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  JANELA_DIAS,
  MAX_HORARIOS,
  podeTransicionar,
  statusAposAcao,
  validarHorarios,
  validarLinkChamada,
} from "./visitas-video.ts";

const agora = new Date("2026-10-17T12:00:00.000Z");
const emHoras = (h: number) => new Date(agora.getTime() + h * 3600_000).toISOString();

test("horários: aceita de 1 a 3 dentro dos próximos 7 dias, ordenados e sem repetir", () => {
  const r = validarHorarios([emHoras(50), emHoras(2), emHoras(2)], agora);
  assert.ok(r.ok);
  assert.deepEqual(r.horarios, [emHoras(2), emHoras(50)]);
  assert.equal(MAX_HORARIOS, 3);
  assert.equal(JANELA_DIAS, 7);
});

test("horários: recusa vazio, mais de 3, passado, depois de 7 dias e lixo", () => {
  assert.equal(validarHorarios([], agora).ok, false);
  assert.equal(validarHorarios([emHoras(1), emHoras(2), emHoras(3), emHoras(4)], agora).ok, false);
  assert.equal(validarHorarios([emHoras(-1)], agora).ok, false);
  assert.equal(validarHorarios([emHoras(24 * 7 + 1)], agora).ok, false);
  assert.equal(validarHorarios(["amanhã"], agora).ok, false);
  assert.equal(validarHorarios("2026-10-18T10:00:00Z", agora).ok, false);
  assert.equal(validarHorarios([42], agora).ok, false);
});

test("link da chamada: só https de Meet, Zoom, Teams ou chamada do WhatsApp (nunca wa.me, que expõe o número)", () => {
  for (const ok of [
    "https://meet.google.com/abc-defg-hij",
    "https://us02web.zoom.us/j/123456789",
    "https://zoom.us/j/1",
    "https://teams.microsoft.com/l/meetup-join/xyz",
    "https://call.whatsapp.com/video/AbCd123",
  ])
    assert.equal(validarLinkChamada(ok).ok, true, ok);
  for (const ruim of [
    "http://meet.google.com/abc",
    "https://wa.me/5534999999999",
    "https://api.whatsapp.com/send?phone=5534999999999",
    "https://meet.google.com.golpe.com/x",
    "https://evil.com/?u=https://meet.google.com/x",
    "javascript:alert(1)",
    "meet.google.com/abc",
    "https://user:senha@meet.google.com/abc",
    "",
  ])
    assert.equal(validarLinkChamada(ruim).ok, false, ruim);
});

test("transições: dono confirma e conclui; morador só cancela; estados finais não mudam", () => {
  assert.equal(podeTransicionar("pedido", "confirmado", "dono"), true);
  assert.equal(podeTransicionar("confirmado", "feito", "dono"), true);
  assert.equal(podeTransicionar("pedido", "cancelado", "morador"), true);
  assert.equal(podeTransicionar("confirmado", "cancelado", "morador"), true);
  assert.equal(podeTransicionar("pedido", "cancelado", "dono"), true);
  assert.equal(podeTransicionar("pedido", "confirmado", "morador"), false);
  assert.equal(podeTransicionar("confirmado", "feito", "morador"), false);
  assert.equal(podeTransicionar("pedido", "feito", "dono"), false);
  assert.equal(podeTransicionar("feito", "cancelado", "dono"), false);
  assert.equal(podeTransicionar("cancelado", "confirmado", "dono"), false);
});

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const semComentario = (s: string) => s.replace(/^--.*$/gm, "");

test("0148 (RLS): leitura só das partes e do admin; tenant_id fora do grant; sem escrita para o usuário", () => {
  const sql = semComentario(ler("supabase/migrations/0148_visitas_video.sql"));
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.visitas_video from anon, authenticated/);
  const grant = sql.match(/grant select \(([^)]*)\)\s+on public\.visitas_video to authenticated/);
  assert.ok(grant, "grant por coluna");
  assert.doesNotMatch(grant[1], /tenant_id/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
  assert.match(sql, /tenant_id = \(select auth\.uid\(\)\) or owner_id = \(select auth\.uid\(\)\) or \(select public\.is_admin\(\)\)/);
  assert.doesNotMatch(sql, /to anon/);
});

test("0148: aplicar idempotente, begin/commit, registra em schema_migrations, com rollback", () => {
  const ap = ler("supabase/producao/aplicar-0148.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /to_regclass\('public\.visitas_video'\) is null/);
  assert.match(ap, /'0148_visitas_video'/);
  assert.match(ap, /not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.match(ler("supabase/producao/rollback/0148_rollback.sql"), /drop table if exists public\.visitas_video/);
});

import { formatarHorario } from "./visitas-video.ts";
test("formatarHorario usa o fuso de Brasília", () => {
  assert.match(formatarHorario("2026-10-18T17:30:00.000Z"), /18\/10 às 14:30/);
  assert.equal(formatarHorario("lixo"), "");
});

test("t168 — mudança de status: dono confirma (horário na janela + link válido) e o status vira 'confirmado'", async () => {
  const { mudancaDeStatus } = await import("./visitas-video.ts");
  const agora = new Date("2026-10-18T12:00:00Z");
  const ok = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: "2026-10-20T12:00:00Z", link: "https://meet.google.com/abc-defg-hij" }, agora);
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.campos.status, "confirmado");
  assert.equal(ok.ok && ok.campos.horario_confirmado, "2026-10-20T12:00:00.000Z");
  assert.equal(ok.ok && ok.campos.link_chamada, "https://meet.google.com/abc-defg-hij");
  // Morador não confirma; link fora da lista e horário no passado/fora da janela são recusados.
  assert.equal(mudancaDeStatus("pedido", "morador", { acao: "confirmar", horario: "2026-10-20T12:00:00Z", link: "https://meet.google.com/x" }, agora).ok, false);
  assert.equal(mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: "2026-10-20T12:00:00Z", link: "https://wa.me/5534999999999" }, agora).ok, false);
  assert.equal(mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: "2026-10-17T12:00:00Z", link: "https://meet.google.com/x" }, agora).ok, false);
  assert.equal(mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: "2026-11-30T12:00:00Z", link: "https://meet.google.com/x" }, agora).ok, false);
  // Depois de confirmado: concluir (dono) e cancelar (os dois); feito/cancelado não mudam mais.
  assert.equal(mudancaDeStatus("confirmado", "dono", { acao: "concluir" }, agora).ok && "feito", "feito");
  assert.equal(mudancaDeStatus("confirmado", "morador", { acao: "cancelar" }, agora).ok, true);
  assert.equal(mudancaDeStatus("feito", "dono", { acao: "cancelar" }, agora).ok, false);
});

test("t168 — a ação grava, confere a linha gravada e revalida /dashboard/visitas (a tela não volta com o status antigo)", () => {
  const src = readFileSync(new URL("./data/visitas-video-actions.ts", import.meta.url), "utf8");
  assert.match(src, /mudancaDeStatus\(/);
  assert.match(src, /revalidatePath\("\/dashboard\/visitas"\)/);
  assert.match(src, /\.update\(campos\)[\s\S]{0,120}\.select\("id"\)/);
});

test("t168: a tela troca a etiqueta na hora com o status da ação, sem esperar o recarregamento", () => {
  assert.equal(statusAposAcao("confirmar"), "confirmado");
  assert.equal(statusAposAcao("concluir"), "feito");
  assert.equal(statusAposAcao("cancelar"), "cancelado");
  // Prompt 23: Remarcar e aceitar o novo horário também.
  assert.equal(statusAposAcao("remarcar"), "remarcar");
  assert.equal(statusAposAcao("aceitar_remarcacao"), "confirmado");
  // O cartão da visita (Visitas e conversa) aplica o status na hora.
  const cartao = readFileSync("src/components/visitas/cartao-visita.tsx", "utf8");
  assert.match(cartao, /onStatus\?\.\(statusAposAcao\(acao\.acao\)\)/);
  assert.match(cartao, /data-testid="visita-status"[^>]*>\s*\{passou \? HORARIO_PASSOU : STATUS_VISITA_ROTULO\[status\]\}/);
});
