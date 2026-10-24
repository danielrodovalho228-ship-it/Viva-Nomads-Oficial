/*
  49-C1 — guarda dos modelos de conta: o 1º e-mail da conta nova ("Confirm signup") e o de quem já tem conta
  ("Magic link") trazem SÓ o código, sem botão nem link de entrada; e a validade escrita nos e-mails, na tela e no
  corpo enviado ao Supabase sai da mesma constante (VALIDADE_CODIGO_MIN). Roda: node --test src/lib/notifications/modelos-codigo-49c1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templatesSupabase } from "./templates-supabase.ts";
import { CAMPO_DO_MODELO, corpoConfigAuth } from "./supabase-auth-config.ts";
import { TEXTO_VALIDADE_CODIGO, VALIDADE_CODIGO_MIN, VALIDADE_CODIGO_S } from "../seguranca/codigo-acesso.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const COM_CODIGO = ["Confirm signup", "Magic link"];
/** Os únicos links aceitos num e-mail de código: o rodapé institucional (nenhum entra na conta). */
const RODAPE = /^https:\/\/(vivanomads\.com\.br(\/(ajuda|seguranca|dashboard\/notificacoes))?|www\.instagram\.com\/vivanomads\/)$/;

function linksDe(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

/** O que torna um modelo "de link": botão, link de confirmação ou variável de URL do Supabase. */
function problemasDeLink(html: string): string[] {
  const p: string[] = [];
  if (/ConfirmationURL|TokenHash|RedirectTo|\{\{\s*\.SiteURL\s*\}\}/.test(html)) p.push("variável de link do Supabase");
  if (/\/auth\/(confirm|callback)/.test(html)) p.push("link de confirmação");
  if (/background:#1c6b3a;"[^>]*>\s*<a /.test(html)) p.push("botão");
  for (const l of linksDe(html)) if (!RODAPE.test(l)) p.push(`link fora do rodapé: ${l}`);
  return p;
}

test("Confirm signup e Magic link: só o código ({{ .Token }}), sem botão nem link de entrada", () => {
  const modelos = templatesSupabase().filter((t) => COM_CODIGO.includes(t.modelo));
  assert.equal(modelos.length, 2);
  for (const t of modelos) {
    assert.match(t.html, /\{\{ \.Token \}\}/, t.modelo);
    assert.deepEqual(problemasDeLink(t.html), [], t.modelo);
    // O arquivo gerado (o que se cola no painel) também.
    assert.deepEqual(problemasDeLink(ler(`supabase/templates/${t.arquivo}`)), [], t.arquivo);
  }
});

test("a guarda pega o modelo antigo (botão de confirmação) — prova de que ela falharia", () => {
  const antigo = `<a href="{{ .ConfirmationURL }}">Confirmar e-mail</a>`;
  assert.ok(problemasDeLink(antigo).length > 0);
  assert.ok(problemasDeLink(`<a href="https://vivanomads.com.br/auth/confirm?token_hash=x&type=signup">Entrar</a>`).length > 0);
});

test("validade única: 10 minutos na tela, nos 2 modelos com código e no mailer_otp_exp", () => {
  assert.equal(VALIDADE_CODIGO_MIN, 10);
  assert.equal(VALIDADE_CODIGO_S, VALIDADE_CODIGO_MIN * 60);
  assert.equal(TEXTO_VALIDADE_CODIGO, "10 minutos");
  assert.equal(corpoConfigAuth().mailer_otp_exp, VALIDADE_CODIGO_S);
  for (const t of templatesSupabase()) {
    // Nenhum modelo de conta fala em outra validade.
    for (const m of t.html.matchAll(/(\d+)\s*minutos/g)) assert.equal(Number(m[1]), VALIDADE_CODIGO_MIN, `${t.modelo}: "${m[0]}"`);
    if (COM_CODIGO.includes(t.modelo)) assert.ok(t.html.includes(TEXTO_VALIDADE_CODIGO), t.modelo);
  }
  // A tela lê a constante (nada de "10 minutos" escrito à mão).
  const tela = ler("src/components/auth/login-por-codigo.tsx");
  assert.match(tela, /TEXTO_VALIDADE_CODIGO/);
  assert.doesNotMatch(tela, /\d+\s*minutos/);
});

test("o corpo enviado ao Supabase leva os 2 modelos de código com o mesmo HTML do repositório", () => {
  const corpo = corpoConfigAuth();
  for (const t of templatesSupabase().filter((x) => COM_CODIGO.includes(x.modelo))) {
    assert.equal(corpo[`mailer_templates_${CAMPO_DO_MODELO[t.modelo]}_content`], t.html);
  }
});
