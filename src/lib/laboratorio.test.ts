/*
  Laboratório de testes: o modo simulado nunca vale em produção, o seed só
  aceita banco local e o workflow não usa nenhum segredo.
  Roda: node --test src/lib/laboratorio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { integracoesSimuladas } from "./integracoes.ts";

const raiz = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("INTEGRACOES_SIMULADAS só liga fora de produção", () => {
  const antes = { s: process.env.INTEGRACOES_SIMULADAS, v: process.env.VERCEL_ENV };
  process.env.INTEGRACOES_SIMULADAS = "on";
  delete process.env.VERCEL_ENV;
  assert.equal(integracoesSimuladas(), true);
  process.env.VERCEL_ENV = "preview";
  assert.equal(integracoesSimuladas(), true);
  process.env.VERCEL_ENV = "production";
  assert.equal(integracoesSimuladas(), false);
  process.env.INTEGRACOES_SIMULADAS = "off";
  delete process.env.VERCEL_ENV;
  assert.equal(integracoesSimuladas(), false);
  if (antes.s === undefined) delete process.env.INTEGRACOES_SIMULADAS; else process.env.INTEGRACOES_SIMULADAS = antes.s;
  if (antes.v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = antes.v;
});

test("build de produção com o modo simulado ligado falha (next.config)", () => {
  assert.match(raiz("next.config.ts"), /LABORATORIO && process\.env\.VERCEL_ENV === "production"[\s\S]*throw new Error/);
});

test("todas as integrações passam pelo modo simulado (nada sai para a rede)", () => {
  for (const [arquivo, chave] of [
    ["src/lib/notifications/email.ts", "RESEND_API_KEY"],
    ["src/lib/notifications/whatsapp.ts", "ZAPI_TOKEN"],
    ["src/lib/payments/asaas.ts", "ASAAS_API_KEY"],
    ["src/lib/integrations/zapsign.ts", "ZAPSIGN_API_TOKEN"],
    ["src/lib/integrations/caf.ts", "CAF_API_TOKEN"],
  ]) {
    assert.match(raiz(arquivo), new RegExp(`process\\.env\\.${chave}[^\\n]*&& !integracoesSimuladas\\(\\)`), arquivo);
  }
  assert.match(raiz("src/lib/atendimento/viva-servidor.ts"), /ANTHROPIC_API_KEY && !integracoesSimuladas\(\)/);
  assert.match(raiz("src/app/api/ai/anuncio/route.ts"), /\|\| integracoesSimuladas\(\)/);
  // WhatsApp: o registro guarda só o tamanho da mensagem, nunca telefone nem texto.
  assert.match(raiz("src/lib/notifications/whatsapp.ts"), /registrarSimulado\("whatsapp", \{ tamanho: params\.message\.length \}\)/);
});

test("seed do laboratório: só 127.0.0.1/localhost, senha da noite, e-mails .test", () => {
  const seed = raiz("scripts/lab/seed-lab.mjs");
  assert.match(seed, /\["127\.0\.0\.1", "localhost"\]\.includes\(host\)/);
  assert.match(seed, /LAB_SENHA/);
  const emails = [...seed.matchAll(/email: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(emails.length >= 9);
  assert.ok(emails.every((e) => e.endsWith("@lab.vivanomads.test")), emails.join(", "));
});

test("seed do laboratório: a limpeza das personas só roda depois da trava de banco local", () => {
  const seed = raiz("scripts/lab/seed-lab.mjs");
  const trava = seed.indexOf("process.exit(1)");
  const chamada = seed.indexOf("await limparPersonas()");
  assert.ok(trava > 0 && chamada > trava, "limparPersonas() precisa vir depois da recusa de host não local");
  // Só apaga e-mails do domínio reservado do laboratório.
  assert.match(seed, /u\.email\.endsWith\("@lab\.vivanomads\.test"\)/);
  assert.match(seed, /emails\.has\(u\.email\)/);
});

test("workflow do laboratório: sem segredos, banco local, modo simulado", () => {
  const wf = raiz(".github/workflows/laboratorio.yml");
  // Única exceção (ordem 225d0648): o passo final "Registrar no banco" usa SUPABASE_DB_URL para gravar o RESUMO
  // (contagens e títulos) em lab_execucoes. Nada antes dele (build, site, testes) vê segredo, e ele nunca roda em PR.
  const [antes, passo] = wf.split("- name: Registrar no banco");
  assert.ok(passo, "passo Registrar no banco existe");
  assert.doesNotMatch(antes, /secrets\./);
  assert.deepEqual([...wf.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]), ["SUPABASE_DB_URL"]);
  assert.match(passo.split("- name:")[0], /github\.event_name != 'pull_request'/);
  assert.match(wf, /push:\s+branches: \[main\]/);
  assert.match(wf, /NEXT_PUBLIC_SUPABASE_URL: http:\/\/127\.0\.0\.1:54321/);
  assert.match(wf, /INTEGRACOES_SIMULADAS: "on"/);
  assert.match(wf, /alinhar-producao\.sql/);
  assert.match(wf, /cron: "0 6 \* \* \*"/);
});

test("workflow do laboratório: run de PR nunca cancela a run da main", () => {
  const wf = raiz(".github/workflows/laboratorio.yml");
  const grupo = wf.match(/^\s+group: (.+)$/m)?.[1] ?? "";
  // O grupo precisa separar por evento e por ref, senão o PR cai no mesmo grupo da main.
  assert.match(grupo, /github\.event_name/);
  assert.match(grupo, /github\.head_ref \|\| github\.ref/);
  assert.doesNotMatch(grupo, /^laboratorio$/);
  // Cancelar só vale para pull_request.
  assert.match(wf, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});

test("seed do laboratório liga os alertas operacionais da admin (senão o e-mail do chamado à equipe não sai — t24/t30)", () => {
  const seed = raiz("scripts/lab/seed-lab.mjs");
  assert.match(seed, /p\.role === "admin" \? \{ recebe_alertas_operacionais: true \}/);
  // avisarEquipe só escreve para quem tem a marca ligada
  assert.match(raiz("src/lib/notifications/destinatarios-admin.ts"), /recebe_alertas_operacionais === true/);
});

test("alinhar-producao: políticas que citam profiles.role são recriadas ao trocar o tipo (0136 quebrou o lab inteiro)", () => {
  const sql = raiz("supabase/lab/alinhar-producao.sql");
  // O Postgres recusa `alter column role type` com política dependente (emails_teste_admin_le, 0136):
  // o script precisa achar essas políticas, apagar antes do alter e recriar depois.
  const apagar = sql.indexOf("drop policy %I");
  const alterar = sql.indexOf("alter table public.profiles alter column role type text");
  const recriar = sql.indexOf("execute comando");
  assert.ok(apagar > 0, "apaga as políticas dependentes");
  assert.ok(alterar > apagar, "o alter vem depois de apagar as políticas");
  assert.ok(recriar > alterar, "recria as políticas depois do alter");
  assert.match(sql, /pg_policy/);
  assert.match(sql, /replace\([^)]*'::user_role', '::text'\)/);
  // Já em texto (produção/2ª execução): não faz nada.
  assert.match(sql, /= 'text' then\s+return;/);
});
