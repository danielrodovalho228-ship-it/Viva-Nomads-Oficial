/*
  Ordem 12a8086d, item 4: "links de aprovação de uso único (72 h) que abrem a tela autenticada".
  O e-mail/push do Moacir já tinha o link assinado (avisos-daniel.ts), mas a tela que o consome não existia
  (TELA_APROVAR_EXISTE = false) e o link caía na Central sem nada de uso único.
  Roda: node --test src/lib/agentes/link-aprovacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { linkAssinadoAprovar, linkDecisao, TELA_APROVAR_EXISTE } from "./avisos-daniel.ts";
import { conferirLinkAprovacao, consumirLinkAprovacao, lerLinkAprovacao, MENSAGEM_LINK, ROTA_LINK_APROVAR, type BancoLinks } from "./link-aprovacao.ts";

const SEGREDO = "segredo-de-teste";
const RONDA = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-11-11T12:00:00Z");

function params(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams);
}

test("o link do aviso agora vai para a tela de aprovação (não mais só para a Central)", () => {
  assert.equal(TELA_APROVAR_EXISTE, true);
  const url = new URL(linkDecisao(RONDA, AGORA, "https://vivanomads.com.br", SEGREDO));
  assert.equal(url.pathname, ROTA_LINK_APROVAR);
  assert.equal(ROTA_LINK_APROVAR, "/admin/agentes/aprovar");
});

test("lerLinkAprovacao: só aceita ronda uuid, prazo inteiro e assinatura de 32 hex", () => {
  const p = params(linkAssinadoAprovar(RONDA, AGORA, "https://x", SEGREDO));
  assert.ok(lerLinkAprovacao(p));
  assert.equal(lerLinkAprovacao({}), null);
  assert.equal(lerLinkAprovacao({ ...p, r: "não-é-uuid" }), null);
  assert.equal(lerLinkAprovacao({ ...p, e: "12.5" }), null);
  assert.equal(lerLinkAprovacao({ ...p, s: "ZZ" }), null);
  assert.equal(lerLinkAprovacao({ ...p, s: [p.s, p.s] }), null);
});

test("conferirLinkAprovacao: válido até 72 h; depois 'expirado'; assinatura trocada 'invalido'", () => {
  const l = lerLinkAprovacao(params(linkAssinadoAprovar(RONDA, AGORA, "https://x", SEGREDO)))!;
  assert.equal(conferirLinkAprovacao(l, new Date(AGORA.getTime() + 71 * 3600_000), SEGREDO), "valido");
  assert.equal(conferirLinkAprovacao(l, new Date(AGORA.getTime() + 73 * 3600_000), SEGREDO), "expirado");
  assert.equal(conferirLinkAprovacao(l, AGORA, "outro-segredo"), "invalido");
  assert.equal(conferirLinkAprovacao({ ...l, expira: l.expira + 3600 }, AGORA, SEGREDO), "invalido");
  assert.equal(conferirLinkAprovacao(null, AGORA, SEGREDO), "invalido");
});

function bancoFalso(): BancoLinks & { linhas: Map<string, string> } {
  const linhas = new Map<string, string>();
  return {
    linhas,
    async inserir(assinatura, expiraEm) {
      if (linhas.has(assinatura)) return { codigo: "23505" };
      linhas.set(assinatura, expiraEm);
      return { codigo: null };
    },
    async limparVencidos() {},
  };
}

test("consumirLinkAprovacao: a 1ª abertura passa; a mesma assinatura de novo é recusada (uso único)", async () => {
  const l = lerLinkAprovacao(params(linkAssinadoAprovar(RONDA, AGORA, "https://x", SEGREDO)))!;
  const b = bancoFalso();
  assert.equal(await consumirLinkAprovacao(b, l), "ok");
  assert.equal(await consumirLinkAprovacao(b, l), "usado");
  assert.equal(b.linhas.size, 1);
  assert.equal(b.linhas.get(l.assinatura), new Date(l.expira * 1000).toISOString());
});

test("consumirLinkAprovacao: erro do banco não abre a tela (falha fechada)", async () => {
  const l = lerLinkAprovacao(params(linkAssinadoAprovar(RONDA, AGORA, "https://x", SEGREDO)))!;
  const b: BancoLinks = { inserir: async () => ({ codigo: "XX000" }), limparVencidos: async () => {} };
  assert.equal(await consumirLinkAprovacao(b, l), "erro");
  const lanca: BancoLinks = { inserir: async () => { throw new Error("rede"); }, limparVencidos: async () => {} };
  assert.equal(await consumirLinkAprovacao(lanca, l), "erro");
});

test("mensagens em português, sem detalhe interno", () => {
  assert.match(MENSAGEM_LINK.usado, /já foi usado/);
  assert.match(MENSAGEM_LINK.expirado, /72 h/);
  for (const m of Object.values(MENSAGEM_LINK)) assert.doesNotMatch(m, /23505|erro interno|supabase|sql/i);
});

test("a tela só consome o link depois de conferir sessão, papel admin e duas etapas", () => {
  const pagina = "src/app/(dashboard)/admin/agentes/aprovar/page.tsx";
  assert.ok(existsSync(pagina), "falta a tela /admin/agentes/aprovar");
  const src = readFileSync(pagina, "utf8");
  const iUser = src.indexOf("auth.getUser(");
  const iAdmin = src.indexOf("ehAdmin(");
  const iConsumir = src.indexOf("consumirLinkAprovacao(");
  assert.ok(iUser > 0 && iAdmin > 0 && iConsumir > 0);
  assert.ok(iUser < iConsumir && iAdmin < iConsumir, "consome antes de conferir o admin");
  // ehAdmin já exige AAL2 (duas etapas): papel admin E sessaoAal2.
  assert.match(readFileSync("src/lib/data/admin-guard.ts", "utf8"), /return sessaoAal2\(supabase\);/);
  assert.match(src, /HREF_APROVACOES/);
  assert.match(src, /force-dynamic/);
  assert.match(src, /PageTitle/);
  assert.match(src, /Panel/);
  assert.match(src, /CRON_SECRET/);
});

test("migração 0340: tabela só do servidor (RLS ligada, sem grant ao navegador), idempotente, com aplicar e rollback", () => {
  const mig = "supabase/migrations/0340_aprovacoes_links_usados.sql";
  assert.ok(existsSync(mig), "falta a migração 0340");
  const sql = readFileSync(mig, "utf8");
  assert.match(sql, /create table if not exists public\.aprovacoes_links_usados/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.aprovacoes_links_usados from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant [a-z, ]+ to (anon|authenticated)/i);
  assert.doesNotMatch(sql, /\bdrop\b/i);
  const aplicar = readFileSync("supabase/producao/aplicar-0340.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /'20261111000340', '0340_aprovacoes_links_usados'/);
  assert.match(aplicar, /where not exists/);
  const rb = readFileSync("supabase/producao/rollback/0340_rollback.sql", "utf8");
  assert.match(rb, /drop table if exists public\.aprovacoes_links_usados/);
  assert.match(rb, /version = '20261111000340'/);
});
