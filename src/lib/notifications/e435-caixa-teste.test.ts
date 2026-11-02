/*
  E435 (auditoria de links dos e-mails, 02/11) — caixa de e-mails de teste:
  (a) paginação (antes só os 100 mais recentes de 213); (b) a versão HTML também é guardada (sem links com token de
  ACESSO, E163); (c) o leitor de QA vê o link de descadastro com token e o destinatário por extenso; (d) o assunto não
  é cortado na lista (o nome inteiro do imóvel vai na linha abaixo, como na caixa da própria conta — E322).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { descadastroDoEmail, faixaDaPagina, htmlParaCaixa, montarRegistroEmailTeste, paginaDaUrl, POR_PAGINA, totalDePaginas } from "./caixa-teste.ts";

const U = "7216d0e9-6246-482a-a1de-524fd5231dc2";
const DESC = `https://vivanomads.com.br/avisos/desligar?u=${U}&t=abcDEF_123-x`;

test("(a) paginação: 213 e-mails = 3 páginas de 100; a URL escolhe a página", () => {
  assert.equal(POR_PAGINA, 100);
  assert.equal(totalDePaginas(213), 3);
  assert.equal(totalDePaginas(0), 1);
  assert.deepEqual(faixaDaPagina(1), { de: 0, ate: 99 });
  assert.deepEqual(faixaDaPagina(3), { de: 200, ate: 299 });
  assert.equal(paginaDaUrl("2"), 2);
  for (const ruim of [undefined, "0", "-1", "abc", "1.5"]) assert.equal(paginaDaUrl(ruim as string | undefined), 1, String(ruim));
});

test("(b)(c) o registro guarda HTML sem token de acesso, o destinatário por extenso e o descadastro com token", () => {
  const html = `<p>Olá</p><a href="https://vivanomads.com.br/auth/confirm?token_hash=SEGREDO&amp;type=email">Entrar</a><a href="${DESC.replace("&", "&amp;")}">Não quero mais receber</a>`;
  const r = montarRegistroEmailTeste({ evento: "pedido_compativel", assunto: "Imóvel novo", texto: "Olá", para: "QA.Muse@vivanomads.com.br", usuarioId: U, html, descadastroUrl: descadastroDoEmail("", html) });
  assert.ok(r.html && r.html.includes("<p>Olá</p>"));
  assert.doesNotMatch(r.html ?? "", /SEGREDO|token_hash/);
  assert.equal(r.destinatario, "qa.muse@vivanomads.com.br");
  assert.match(r.destinatario_mascarado, /•••/);
  assert.equal(r.descadastro_url, DESC);
  assert.equal(descadastroDoEmail(`Não quero mais receber: ${DESC}`), DESC);
  assert.equal(descadastroDoEmail("sem link"), null);
  assert.equal(htmlParaCaixa(null), null);
});

test("captura: o envio passa o HTML e a caixa extrai o descadastro antes de limpar os links", () => {
  const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
  assert.match(email, /html: params\.html,/);
  const caixa = readFileSync(new URL("./caixa-teste.ts", import.meta.url), "utf8");
  assert.match(caixa, /descadastroUrl: descadastroDoEmail\(p\.texto, p\.html\)/);
});

test("tela do leitor de QA: paginada, com HTML isolado, destinatário, descadastro e o imóvel por extenso", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/qa/emails/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /select\("id, criado_em, evento, assunto, corpo, destinatario_mascarado, html, destinatario, descadastro_url", \{ count: "exact" \}\)/);
  assert.match(pagina, /\.range\(de, ate\)/);
  assert.doesNotMatch(pagina, /\.limit\(LISTA_MAX\)/);
  assert.match(pagina, /<ListaEmailsTeste\s+qa\s+rodape=\{navegacao\}/);
  const lista = readFileSync(new URL("../../components/admin/lista-emails-teste.tsx", import.meta.url), "utf8");
  assert.match(lista, /<iframe title="Versão HTML do e-mail" sandbox="" srcDoc=\{l\.html\}/);
  assert.match(lista, /data-testid="emails-teste-descadastro"/);
  assert.equal((lista.match(/qa && l\.destinatario \? l\.destinatario : l\.destinatario_mascarado/g) ?? []).length, 2, "celular e computador");
  assert.equal((lista.match(/<ImovelPorExtenso corpo=\{l\.corpo\} \/>/g) ?? []).length, 2, "celular e computador");
  assert.doesNotMatch(lista, /truncate|line-clamp/);
  // A lista do ADMIN continua sem as colunas novas (mascarada).
  const admin = readFileSync(new URL("../../components/admin/emails-teste-lista.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(admin, /destinatario,|descadastro_url|html,/);
});

test("migração 0284: as três colunas, idempotente", () => {
  const m = readFileSync(new URL("../../../supabase/producao/aplicar-0284.sql", import.meta.url), "utf8");
  for (const c of ["html", "destinatario", "descadastro_url"]) assert.match(m, new RegExp(`add column if not exists ${c} text`));
  assert.match(m, /0284_emails_teste_html_destinatario/);
});
