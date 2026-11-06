/*
  E632: na leitura do e-mail da proposta ORC-2026-0013 (05/11) o HTML exibia um bloco "Sua visita é hoje". Conferência
  pelo catálogo (as mesmas funções da produção): o e-mail de proposta NÃO tem bloco de visita — o "Sua visita é hoje"
  existe só nos modelos de visita (véspera). O que misturava era a TELA do leitor de QA: ela guarda o HTML de VÁRIOS
  e-mails na mesma página (um iframe por e-mail), então quem lia o DOM da página atribuía o bloco de um e-mail a outro.
  Agora cada versão HTML é rotulada com o assunto do próprio e-mail.
  Roda: node --test src/lib/notifications/e632-proposta-sem-bloco-de-visita.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogoEmails } from "./catalogo-emails.ts";

const SITE = "https://vivanomads.com.br";
const todos = catalogoEmails(SITE);
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const texto = (e: { html: string; text?: string }) => `${e.html} ${e.text ?? ""}`;

test("nenhum e-mail de proposta do catálogo carrega bloco, assunto ou texto de visita", () => {
  const propostas = todos.filter((e) => e.chave.startsWith("proposta:") || e.chave === "proposta_recebida" || e.chave === "proposta_aceita" || e.chave === "proposta_recusada");
  assert.ok(propostas.length >= 6, "o catálogo cobre os e-mails de proposta");
  for (const e of propostas) {
    assert.doesNotMatch(texto(e), /Sua visita é (hoje|amanhã)/i, `${e.chave}: bloco de visita`);
    assert.doesNotMatch(e.assunto ?? "", /visita/i, `${e.chave}: assunto de visita`);
  }
});

test('"Sua visita é hoje/amanhã" só nasce nos modelos de visita (véspera)', () => {
  const comBloco = todos.filter((e) => /Sua visita é (hoje|amanhã)/i.test(texto(e)) || /Sua visita é (hoje|amanhã)/i.test(e.assunto ?? ""));
  for (const e of comBloco) assert.match(e.chave, /^visita/, `${e.chave} tem o bloco da véspera`);
});

test("o leitor de QA rotula a versão HTML de cada e-mail com o assunto dele (uma leitura do DOM não mistura e-mails)", () => {
  const l = ler("components/admin/lista-emails-teste.tsx");
  assert.match(l, /title=\{`Versão HTML do e-mail: \$\{l\.assunto\}`\}/);
  assert.match(l, /data-email-id=\{l\.id\}/);
});
