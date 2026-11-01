/*
  E336 — a Action "Aplicar e-mails de conta no Supabase" grava SÓ os 6 modelos (assunto + corpo). Remetente e validade
  do código (mailer_otp_exp) não vão no PATCH: são só lidos e comparados. O teste roda o script de verdade com um
  Supabase falso (fetch trocado antes do script) e confere o corpo exato do PATCH, sem rede e sem segredo real.
  Roda: node --test src/lib/notifications/e336-action-so-modelos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configEsperadaAuth, corpoConfigAuth, corpoModelosAuth } from "./supabase-auth-config.ts";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const PROIBIDOS = ["smtp_admin_email", "smtp_sender_name", "mailer_otp_exp"];

test("E336: o corpo da Action tem só os 12 campos dos modelos; remetente e validade ficam de fora", () => {
  const corpo = corpoModelosAuth();
  assert.equal(Object.keys(corpo).length, 12);
  for (const k of Object.keys(corpo)) assert.match(k, /^mailer_(subjects_\w+|templates_\w+_content)$/, k);
  for (const k of PROIBIDOS) assert.ok(!(k in corpo), `${k} não pode ir no PATCH`);
  // O retrato esperado completo segue igual ao de antes (modelos + remetente + validade), para testes e LEIA-ME.
  assert.deepEqual(Object.keys(configEsperadaAuth()).sort(), [...PROIBIDOS].sort());
  assert.deepEqual(corpoConfigAuth(), { ...configEsperadaAuth(), ...corpo });
});

function rodarScript(lido: (enviado: Record<string, unknown>) => Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "e336-"));
  const log = join(dir, "pedidos.json");
  const resumo = join(dir, "resumo.md");
  const resposta = join(dir, "resposta.json");
  // O "Supabase" falso: grava os pedidos e responde a leitura com o que o teste mandar.
  const falso = `
    import { writeFileSync, readFileSync, existsSync } from "node:fs";
    const pedidos = [];
    globalThis.fetch = async (url, init = {}) => {
      const metodo = init.method ?? "GET";
      const corpo = init.body ? JSON.parse(init.body) : null;
      pedidos.push({ url: String(url), metodo, corpo });
      writeFileSync(${JSON.stringify(log)}, JSON.stringify(pedidos));
      if (metodo === "PATCH") return new Response("{}", { status: 200 });
      const enviado = pedidos.find((p) => p.metodo === "PATCH")?.corpo ?? {};
      const extra = existsSync(${JSON.stringify(resposta)}) ? JSON.parse(readFileSync(${JSON.stringify(resposta)}, "utf8")) : {};
      return new Response(JSON.stringify({ ...enviado, ...extra }), { status: 200 });
    };`;
  const pre = join(dir, "fetch-falso.mjs");
  writeFileSync(pre, falso);
  writeFileSync(resposta, JSON.stringify(lido({})));
  const r = spawnSync(process.execPath, ["--import", pre, join(RAIZ, "scripts/aplicar-templates-supabase.ts")], {
    cwd: RAIZ,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: "token-de-teste", SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst", GITHUB_STEP_SUMMARY: resumo },
    encoding: "utf8",
  });
  const pedidos = JSON.parse(readFileSync(log, "utf8")) as { url: string; metodo: string; corpo: Record<string, unknown> | null }[];
  return { r, pedidos, resumo: readFileSync(resumo, "utf8") };
}

test("E336: o script grava só os modelos e só LÊ remetente e validade (iguais → diz que batem)", () => {
  const { r, pedidos, resumo } = rodarScript(() => configEsperadaAuth());
  assert.equal(r.status, 0, r.stderr);
  const patches = pedidos.filter((p) => p.metodo === "PATCH");
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].corpo, corpoModelosAuth());
  for (const k of PROIBIDOS) assert.ok(!(k in (patches[0].corpo ?? {})), `${k} foi no PATCH`);
  assert.ok(pedidos.every((p) => p.url === "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth"));
  assert.doesNotMatch(r.stdout + r.stderr, /token-de-teste/, "o segredo nunca é impresso");
  assert.match(resumo, /Nada além dos modelos foi gravado/);
  assert.match(resumo, /só lidos, não gravados/);
});

test("E336: remetente ou validade diferentes no Supabase viram aviso, sem gravação nem erro", () => {
  const { r, pedidos, resumo } = rodarScript(() => ({ ...configEsperadaAuth(), mailer_otp_exp: 3600, smtp_sender_name: "Outro nome" }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(pedidos.filter((p) => p.metodo === "PATCH").length, 1);
  assert.match(resumo, /Aviso \(não alterado pela Action\): smtp_sender_name, mailer_otp_exp/);
  assert.match(r.stdout, /não alterado/);
});
