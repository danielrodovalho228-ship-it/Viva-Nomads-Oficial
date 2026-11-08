/*
  E237 (E231-B do coordenador) — GUARDA da varredura de rotas: toda rota de API (todo route.ts em src/app/api) precisa de
  quem a chame no código do app (tela, ação, outra rota, e-mail, script, função do Supabase) ou no vercel.json (crons).
  Falha se surgir uma rota sem chamador fora da lista de exceções, cada uma com o motivo. Saíram por esta varredura:
  /api/assinatura, /api/app/ponte, /api/app/ponte/entrar e /api/admin/agentes/anexos (com o bucket central-anexos, 0255).
  Roda: node --test src/lib/rotas-sem-chamador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;
const existe = (p: string) => existsSync(join(RAIZ, p));

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, nome);
    if (statSync(join(RAIZ, p)).isDirectory()) arquivos(p, out);
    else out.push(p);
  }
  return out;
}

/** Rotas que ninguém do app chama, de propósito. */
const EXCECOES: Record<string, string> = {
  "/api/webhooks/asaas": "webhook: quem chama é o Asaas (URL cadastrada no painel do Asaas), não o app",
  "/api/lab/mensagens-programadas": "rota do laboratório: só os specs E2E a chamam, e ela recusa fora do lab",
};

/** "/api/x/[id]/y" a partir de "src/app/api/x/[id]/y/route.ts" (grupos "(…)" não entram na URL). */
function urlDaRota(arquivo: string): string {
  return "/" + arquivo.replace(/^src\/app\//, "").replace(/\/route\.tsx?$/, "").split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/");
}

function rotasSemChamador(): string[] {
  const rotas = arquivos("src/app/api").filter((f) => /\/route\.tsx?$/.test(f));
  const fontes = [
    ...arquivos("src"),
    ...(existe("supabase/functions") ? arquivos("supabase/functions") : []),
    ...(existe("scripts") ? arquivos("scripts") : []),
    ...["vercel.json", "next.config.ts"].filter(existe),
  ].filter((f) => /\.(ts|tsx|mjs|js|json)$/.test(f) && !/\.(test|spec)\./.test(f));
  const textos = fontes.map((f) => [f, readFileSync(join(RAIZ, f), "utf8")] as const);
  const orfas: string[] = [];
  for (const r of rotas) {
    const url = urlDaRota(r);
    const fixo = url.split("/[")[0];
    const chama = url.includes("/[")
      ? (t: string) => t.includes(`${fixo}/`) || t.includes(`${fixo}\``)
      : (t: string) => new RegExp(`${fixo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w/-])`).test(t);
    if (!textos.some(([f, t]) => f !== r && chama(t))) orfas.push(url);
  }
  return orfas.sort();
}

test("urlDaRota: grupos e segmentos dinâmicos", () => {
  assert.equal(urlDaRota("src/app/api/cron/vistoria/route.ts"), "/api/cron/vistoria");
  assert.equal(urlDaRota("src/app/api/vistoria/laudo/[id]/route.ts"), "/api/vistoria/laudo/[id]");
});

test("VARREDURA: nenhuma rota de API sem chamador fora das exceções (com motivo)", () => {
  const orfas = rotasSemChamador();
  assert.deepEqual(orfas.filter((u) => !(u in EXCECOES)), [], "rota nova sem quem a chame: ligue a uma tela ou ponha na lista com o motivo");
  // A lista não guarda exceção velha: cada uma ainda existe e ainda não tem chamador.
  assert.deepEqual(Object.keys(EXCECOES).filter((u) => !orfas.includes(u)), []);
});

test("E237: as 4 rotas e o que só elas usavam saíram; o que fica, fica", () => {
  for (const p of [
    "src/app/api/assinatura/route.ts",
    "src/app/api/app/ponte/route.ts",
    "src/app/api/app/ponte/entrar/route.ts",
    "src/app/api/admin/agentes/anexos/route.ts",
    "src/lib/app/ponte.ts",
    "src/lib/agentes/anexos.ts",
    "src/lib/agentes/anexos-servico.ts",
  ])
    assert.equal(existe(p), false, p);
  assert.doesNotMatch(readFileSync(join(RAIZ, "src/lib/payments/asaas.ts"), "utf8"), /createSubscription|SubscriptionResult|BillingType/);
  // Não mexer: webhook do Asaas, e-mail subscription_status, login social do app Expo, crons, rota do lab.
  for (const p of ["src/app/api/webhooks/asaas/route.ts", "src/app/api/app/login-social/route.ts", "src/app/api/lab/mensagens-programadas/route.ts"])
    assert.equal(existe(p), true, p);
  assert.match(readFileSync(join(RAIZ, "vercel.json"), "utf8"), /"\/api\/cron\//);
  assert.doesNotMatch(readFileSync(join(RAIZ, "src/config/retencao.ts"), "utf8"), /central-anexos/);
});

test("0255: o bucket central-anexos só sai VAZIO (aborta com objeto), com aplicar idempotente e rollback", () => {
  const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
  const mig = ler("supabase/migrations/0255_central_anexos_sai.sql");
  const aplicar = ler("supabase/producao/aplicar-0255.sql");
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /select count\(\*\) into n from storage\.objects where bucket_id = 'central-anexos';\s*if n > 0 then\s*raise exception '0255: o bucket central-anexos tem % objeto\(s\); nada foi apagado/);
    // A liberação do DELETE vem DEPOIS da contagem, e vale só na transação (set_config local).
    assert.ok(sql.indexOf("if n > 0") < sql.indexOf("set_config('storage.allow_delete_query', 'true', true)"));
    assert.match(sql, /delete from storage\.buckets where id = 'central-anexos';/);
    assert.doesNotMatch(sql, /delete from storage\.objects/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261029000255', '0255_central_anexos_sai'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261029000255'\)/);
  const volta = ler("supabase/producao/rollback/0255_rollback.sql");
  assert.match(volta, /'central-anexos', 'central-anexos', false, 20971520,/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261029000255';/);
});
