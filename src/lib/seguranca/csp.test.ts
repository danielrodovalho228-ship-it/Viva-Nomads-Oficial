/*
  CSP: sem 'unsafe-eval' em produção (ordem d2463a31); mantém frame-ancestors, Turnstile e Mapbox.
  E1095 (ORDEM-DUET-451): a política passou de observada (Report-Only) a APLICADA, e cobre o que as telas usam de fato
  (o Supabase desta instalação — no laboratório, o local —, a medição de internet, o vídeo e o PDF do armazenamento).
  Roda: node --test src/lib/seguranca/csp.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Cabecalho = { key: string; value: string };
let n = 0;
async function cabecalhos(ambiente: string, env: Record<string, string | undefined> = {}): Promise<Cabecalho[]> {
  const antes = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, VERCEL_ENV: process.env.VERCEL_ENV };
  const novo: Record<string, string | undefined> = { NODE_ENV: ambiente, NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co", VERCEL_ENV: undefined, ...env };
  const por = (e: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(e)) {
      if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string>)[k] = v;
    }
  };
  por(novo);
  try {
    const { default: cfg } = await import(`../../../next.config.ts?caso=${n++}`);
    const regras = await cfg.headers!();
    return regras[0].headers as Cabecalho[];
  } finally {
    por(antes);
  }
}
async function csp(ambiente: string, env: Record<string, string | undefined> = {}): Promise<string> {
  const h = (await cabecalhos(ambiente, env)).find((x) => x.key === "Content-Security-Policy");
  assert.ok(h, "sem o cabeçalho Content-Security-Policy");
  return h.value;
}
const diretiva = (c: string, nome: string) => c.split("; ").find((d) => d.startsWith(`${nome} `)) ?? "";

test("E1095: a política é APLICADA — o cabeçalho é Content-Security-Policy; o de observação saiu", async () => {
  for (const ambiente of ["production", "development"]) {
    const chaves = (await cabecalhos(ambiente)).map((h) => h.key);
    assert.ok(chaves.includes("Content-Security-Policy"), ambiente);
    assert.ok(!chaves.includes("Content-Security-Policy-Report-Only"), `${ambiente}: ainda em observação`);
  }
  assert.doesNotMatch(readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8"), /key: "Content-Security-Policy-Report-Only"/);
});

test("produção não permite unsafe-eval", async () => {
  assert.ok(!(await csp("production")).includes("unsafe-eval"));
});

test("desenvolvimento ainda permite unsafe-eval (hot reload)", async () => {
  assert.ok((await csp("development")).includes("'unsafe-eval'"));
});

test("produção mantém frame-ancestors, Turnstile, Mapbox e worker blob", async () => {
  const c = await csp("production");
  for (const parte of [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "https://api.mapbox.com",
    "worker-src 'self' blob:",
  ]) {
    assert.ok(c.includes(parte), parte);
  }
});

test("E1095: produção, diretiva a diretiva — nada mais largo do que as telas usam", async () => {
  const c = await csp("production");
  assert.deepEqual(c.split("; "), [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    // + speed.cloudflare.com: a medição de internet no navegador (antes, a política aplicada a bloquearia).
    "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://viacep.com.br https://brasilapi.com.br https://speed.cloudflare.com",
    // + o vídeo do imóvel e o áudio do armazenamento (antes caíam no default-src 'self').
    "media-src 'self' blob: https://*.supabase.co",
    // + o PDF do armazenamento que o admin confere num quadro.
    "frame-src 'self' https://player.vimeo.com https://www.youtube.com https://challenges.cloudflare.com https://*.supabase.co",
  ]);
  // Nada de curinga geral nem de http: em produção.
  assert.doesNotMatch(c, /(^|[ ;])\*([ ;]|$)/);
  assert.doesNotMatch(c, /http:/);
  assert.doesNotMatch(c, /vercel\.live/, "a barra da Vercel é só das prévias");
});

test("E1095: o Supabase que não é *.supabase.co (o laboratório, um domínio próprio) entra pela origem configurada", async () => {
  const lab = await csp("production", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" });
  for (const d of ["connect-src", "img-src", "media-src", "frame-src"]) {
    assert.ok(diretiva(lab, d).split(" ").includes("http://127.0.0.1:54321"), `${d} sem o Supabase do laboratório`);
  }
  // Só a origem: sem caminho, sem credenciais.
  const proprio = await csp("production", { NEXT_PUBLIC_SUPABASE_URL: "https://dados.exemplo.com.br/rest/v1?x=1" });
  assert.ok(diretiva(proprio, "connect-src").split(" ").includes("https://dados.exemplo.com.br"));
  assert.doesNotMatch(proprio, /rest\/v1|x=1/);
  // Sem a variável (ou com lixo): a política continua válida, só com o domínio do serviço.
  for (const url of [undefined, "isto não é url"]) {
    const c = await csp("production", { NEXT_PUBLIC_SUPABASE_URL: url });
    assert.equal(diretiva(c, "media-src"), "media-src 'self' blob: https://*.supabase.co");
  }
});

test("E1095: a barra de comentários da Vercel só entra nas prévias (VERCEL_ENV=preview)", async () => {
  const previa = await csp("production", { VERCEL_ENV: "preview" });
  for (const d of ["script-src", "connect-src", "frame-src", "font-src"]) assert.match(diretiva(previa, d), /https:\/\/vercel\.live/, d);
  for (const env of ["production", "development", undefined]) assert.doesNotMatch(await csp("production", { VERCEL_ENV: env }), /vercel\.live|pusher/);
});

test("E1095: a tela dos códigos de recuperação não puxa o node:crypto para o navegador", () => {
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const tela = ler("src/components/seguranca/codigos-recuperacao.tsx");
  assert.match(tela, /^"use client";/);
  assert.match(tela, /from "@\/lib\/seguranca\/codigos-recuperacao-aviso"/);
  assert.doesNotMatch(tela, /from "@\/lib\/seguranca\/codigos-recuperacao"/, "esse arquivo importa node:crypto");
  assert.doesNotMatch(ler("src/lib/seguranca/codigos-recuperacao-aviso.ts"), /^import /m, "o arquivo do aviso não importa nada");
});
