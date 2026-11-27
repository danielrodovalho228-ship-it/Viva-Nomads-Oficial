/*
  E488 — a porta de QA (/qa/entrar) recusava com UMA mensagem que empilhava causas mutuamente exclusivas ("chave
  inválida (ou a porta fechada); conta que não é de teste ou com 2FA; e-mail fora do padrão") sem dizer qual valia.
  Correção: a porta devolve a causa ESPECÍFICA a quem tem a chave certa — 403 com um código (perfil, 2fa, padrao,
  admin_fechada, email) e a frase daquela causa. Sem a chave certa, segue o 404 mudo de sempre (a rota não se revela;
  E361/t596), e o formulário diz "A chave não confere": a página do formulário só existe com a porta ligada.
  Roda: node --test src/lib/qa/e488-causa-recusa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemPortaQa, MOTIVOS_COM_CAUSA } from "./mensagens-porta.ts";
import { MOTIVOS_RECUSA_QA } from "./entrar.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("cada causa tem UMA frase, só dela; nenhuma lista causas possíveis", () => {
  const frases = MOTIVOS_COM_CAUSA.map((m) => mensagemPortaQa(403, m));
  assert.equal(new Set(frases).size, frases.length, "uma frase por causa");
  assert.match(mensagemPortaQa(403, "perfil"), /não é de uma conta de teste/);
  assert.match(mensagemPortaQa(403, "2fa"), /duas etapas/);
  assert.match(mensagemPortaQa(403, "padrao"), /fora do padrão/);
  assert.match(mensagemPortaQa(403, "admin_fechada"), /admin observador/);
  assert.match(mensagemPortaQa(403, "email"), /e-mail/i);
  assert.equal(mensagemPortaQa(404), "A chave não confere. Confira a chave da QA e tente de novo.");
  for (const m of [...frases, mensagemPortaQa(404)]) assert.doesNotMatch(m, /Causas possíveis|ou a porta/);
  // Os códigos com causa são motivos conhecidos da porta, e nunca "chave"/"desligada" (essas seguem o 404 mudo).
  for (const m of MOTIVOS_COM_CAUSA) assert.ok((MOTIVOS_RECUSA_QA as readonly string[]).includes(m), m);
  assert.ok(!MOTIVOS_COM_CAUSA.includes("chave" as never) && !MOTIVOS_COM_CAUSA.includes("desligada" as never));
});

test("rota: chave certa → 403 com o código; chave errada ou porta desligada → o 404 de sempre", () => {
  const rota = ler("../../app/api/qa/entrar/route.ts");
  assert.match(rota, /if \(r\.status === 404\) return r\.motivo === "chave" \|\| r\.motivo === "desligada" \? naoEncontrado\(\) : recusada\(r\.motivo\);/);
  assert.match(rota, /status: 403/);
  const srv = ler("./entrar-servidor.ts");
  assert.match(srv, /if \(!email\) return recusa\("email"\);/);
});

test("formulário: lê o código da resposta e mostra a frase da causa", () => {
  const form = ler("../../app/qa/entrar/qa-entrar-form.tsx");
  assert.match(form, /const corpo = r && r\.status === 403 \? \(\(await r\.json\(\)\.catch\(\(\) => null\)\) as \{ motivo\?: string \} \| null\) : null;/);
  assert.match(form, /setErro\(mensagemPortaQa\(r \? r\.status : null, corpo\?\.motivo\)\);/);
});
