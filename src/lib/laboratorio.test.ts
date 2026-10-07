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
  assert.doesNotMatch(wf, /secrets\./);
  assert.match(wf, /NEXT_PUBLIC_SUPABASE_URL: http:\/\/127\.0\.0\.1:54321/);
  assert.match(wf, /INTEGRACOES_SIMULADAS: "on"/);
  assert.match(wf, /alinhar-producao\.sql/);
  assert.match(wf, /cron: "0 6 \* \* \*"/);
});
