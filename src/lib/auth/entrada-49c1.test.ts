/*
  49-C1 — cadastro com UM e-mail só (código), sem tela órfã, links antigos e saúde dos modelos no /admin.
  Roda: node --test src/lib/auth/entrada-49c1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoDoLink } from "./entrada.ts";
import { CHAVE_ENTROU, mesmaConta } from "./sessao-entre-abas.ts";
import { AVISO_DESATUALIZADO, lerExecucoes, saudeModelosEmail, ultimaMudancaDosArquivos } from "./saude-modelos-email.ts";
import { emailComCodigo } from "../notifications/templates-supabase.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("link antigo de cadastro continua valendo e cai no destino da entrada por código (intenção)", () => {
  assert.equal(destinoDoLink("signup", "/dashboard"), "/auth/intencao?redirect=%2Fdashboard");
  assert.equal(destinoDoLink("magiclink", "/buscar"), "/auth/intencao?redirect=%2Fbuscar");
  assert.equal(destinoDoLink("email", "/dashboard"), "/auth/intencao?redirect=%2Fdashboard");
  // Trocar e-mail e convite não mudam (redefinir senha vai sempre a /auth/reset, na própria rota).
  assert.equal(destinoDoLink("email_change", "/dashboard"), "/dashboard");
  assert.equal(destinoDoLink("invite", "/dashboard"), "/dashboard");
  const rota = ler("src/app/auth/confirm/route.ts");
  assert.match(rota, /type === "recovery" \? "\/auth\/reset" : destinoDoLink\(type, safeInternalPath/);
});

test("sem tela órfã: a tela do código escuta a sessão (evento, outra aba, volta à aba e conferência local) e nunca reenvia sozinha", () => {
  assert.equal(mesmaConta(" Ana@Ex.com ", "ana@ex.com"), true);
  assert.equal(mesmaConta("outra@ex.com", "ana@ex.com"), false);
  assert.equal(mesmaConta(null, "ana@ex.com"), false);
  const tela = ler("src/components/auth/login-por-codigo.tsx");
  assert.match(tela, /onAuthStateChange/);
  assert.match(tela, /addEventListener\("storage"/);
  assert.match(tela, /visibilitychange/);
  assert.match(tela, /localStorage\.setItem\(CHAVE_ENTROU/);
  assert.match(tela, /Você já entrou\. Continuando…/);
  assert.equal(CHAVE_ENTROU, "vn-entrou");
  // O único caminho para "Reenviar código" é o toque no botão, que espera os 60 s.
  assert.equal((tela.match(/onClick=\{\(\) => pedirCodigo\(\)\}/g) ?? []).length, 1);
  assert.match(tela, /disabled=\{carregando \|\| espera > 0/);
  // A escuta da sessão nunca chama o envio.
  const escuta = tela.slice(tela.indexOf("49-C1: sem tela órfã"), tela.indexOf("}, [enviadoEm]);"));
  assert.doesNotMatch(escuta, /enviar\(|pedirCodigo\(/);
});

test("nenhum envio de link de cadastro sobrou no código (resend, signUp, emailRedirectTo)", () => {
  for (const f of ["src/lib/atendimento/viva-servidor.ts", "src/app/api/auth/codigo/route.ts", "src/app/auth/page.tsx", "src/components/auth/login-por-codigo.tsx"]) {
    assert.doesNotMatch(ler(f), /auth\.resend\(|auth\.signUp\(|emailRedirectTo/, f);
  }
});

test("o e-mail com código montado aqui é o mesmo modelo do Supabase, com o código e sem link", () => {
  const novo = emailComCodigo(true, "123456");
  const existente = emailComCodigo(false, "654321");
  assert.equal(novo.assunto, "Seu código de acesso · Viva Nomads");
  assert.match(novo.html, /123456/);
  assert.match(existente.html, /654321/);
  for (const e of [novo, existente]) {
    assert.doesNotMatch(e.html, /\{\{|\/auth\/confirm|ConfirmationURL/);
    assert.match(e.html, /10 minutos/);
  }
  assert.throws(() => emailComCodigo(true, "12a456"));
  // No laboratório a rota manda este e-mail (Confirm signup para conta nova, Magic link para a existente).
  assert.match(ler("src/app/api/auth/codigo/route.ts"), /enviarCodigoPorEmail\(admin, email, !error\)/);
});

test("saúde dos modelos no /admin: em dia, desatualizado (mudou depois da última aplicação), nunca aplicado, falhou", () => {
  const ok = { em: "2026-10-19T12:00:00Z", ok: true };
  assert.equal(saudeModelosEmail([ok], "2026-10-18T10:00:00Z").estado, "em_dia");
  const velho = saudeModelosEmail([ok], "2026-10-22T10:00:00Z");
  assert.equal(velho.estado, "desatualizado");
  assert.equal(velho.texto, AVISO_DESATUALIZADO);
  assert.equal(velho.ultimaAplicacao, ok.em);
  assert.equal(saudeModelosEmail([], "2026-10-22T10:00:00Z").estado, "nunca");
  assert.equal(saudeModelosEmail(null, null).estado, "sem_leitura");
  // A mais recente falhou: a última que conferiu continua sendo a referência, e a falha aparece.
  const falhou = saudeModelosEmail([{ em: "2026-10-23T15:00:00Z", ok: false }, ok], "2026-10-18T10:00:00Z");
  assert.equal(falhou.estado, "em_dia");
  assert.equal(falhou.ultimaFalhou, true);
  // Rodando agora não conta como aplicada nem como falha.
  assert.equal(saudeModelosEmail([{ em: "2026-10-23T15:00:00Z", ok: false, rodando: true }, ok], null).ultimaFalhou, false);
});

test("leitura das respostas do GitHub (sem confiar no formato)", () => {
  const runs = lerExecucoes({
    workflow_runs: [
      { created_at: "2026-10-19T12:00:00Z", status: "completed", conclusion: "success" },
      { created_at: "2026-10-23T15:00:00Z", status: "in_progress", conclusion: null },
      { lixo: true },
    ],
  });
  assert.deepEqual(runs, [
    { em: "2026-10-23T15:00:00Z", ok: false, rodando: true },
    { em: "2026-10-19T12:00:00Z", ok: true, rodando: false },
  ]);
  assert.deepEqual(lerExecucoes(null), []);
  assert.equal(ultimaMudancaDosArquivos([[{ commit: { committer: { date: "2026-10-20T10:00:00Z" } } }], [{ commit: { committer: { date: "2026-10-22T09:00:00Z" } } }], [], "x"]), "2026-10-22T09:00:00Z");
  assert.equal(ultimaMudancaDosArquivos([]), null);
});

test("o /admin/sistema mostra o cartão (ADMIN-3) e o PR que muda os modelos lembra de rodar a Action", () => {
  assert.match(ler("src/app/(dashboard)/admin/sistema/page.tsx"), /<CartaoEntradaEmail \/>/);
  const lembrete = ler(".github/workflows/lembrete-emails-supabase.yml");
  assert.match(lembrete, /templates-supabase\.ts/);
  assert.match(lembrete, /codigo-acesso\.ts/);
  assert.match(lembrete, /Aplicar e-mails de conta no Supabase/);
});
