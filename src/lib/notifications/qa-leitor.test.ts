/*
  QA-CAIXA-B — leitor de QA das caixas de teste (/dashboard/qa/emails, migração 0246).
  Puras (quem pode, máscara, filtros) + guardas de fonte (proxy 404, página, lista compartilhada com o admin).
  Roda: node --experimental-strip-types --test src/lib/notifications/qa-leitor.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoLeitorQa, filtroQaDaUrl, linhaParaTela, mascararEmailsNoTexto, opcoesFiltroQa, podeLerCaixasQa, rotaLeitorQa } from "./caixa-teste.ts";
import { REMETENTE } from "./remetente.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("só conta de teste COM qa_leitor abre; comum, teste sem marca e marca sem teste não abrem", () => {
  assert.equal(podeLerCaixasQa({ qa_leitor: true, is_teste: true }), true);
  for (const p of [null, undefined, {}, { qa_leitor: false, is_teste: false }, { qa_leitor: false, is_teste: true }, { qa_leitor: true, is_teste: false }, { qa_leitor: null, is_teste: true }]) {
    assert.equal(podeLerCaixasQa(p), false, JSON.stringify(p));
  }
});

test("rota do leitor: /dashboard/qa e abaixo, nada mais", () => {
  for (const p of ["/dashboard/qa", "/dashboard/qa/emails", "/dashboard/qa/emails/x"]) assert.equal(rotaLeitorQa(p), true, p);
  for (const p of ["/dashboard", "/dashboard/qaz", "/admin/emails-teste", "/qa/emails", "/dashboard/conta"]) assert.equal(rotaLeitorQa(p), false, p);
});

test("nenhum e-mail completo no texto: todo endereço vira a•••@dominio (menos o remetente público da plataforma)", () => {
  const corpo = `Remetente: ${REMETENTE}\n\nOlá, fale com ana.souza+x@lab.vivanomads.test ou ANA@Exemplo.COM.br. Já mascarado: a•••@lab.vivanomads.test.`;
  const saida = mascararEmailsNoTexto(corpo);
  assert.doesNotMatch(saida, /ana\.souza|ANA@/);
  assert.match(saida, /a•••@lab\.vivanomads\.test ou A•••@Exemplo\.COM\.br/);
  assert.ok(saida.includes(REMETENTE), "o remetente da plataforma segue legível");
  assert.equal(mascararEmailsNoTexto(saida), saida, "idempotente");
  assert.equal(mascararEmailsNoTexto("sem e-mail nenhum"), "sem e-mail nenhum");
});

test("a linha da tela passa assunto, corpo e destinatário pela máscara", () => {
  const l = linhaParaTela({ id: "1", criado_em: "2026-10-25T12:00:00Z", evento: "x", assunto: "Para joao@ex.com", corpo: "Oi maria@ex.com", destinatario_mascarado: "z•••@lab.vivanomads.test" });
  assert.equal(l.assunto, "Para j•••@ex.com");
  assert.equal(l.corpo, "Oi m•••@ex.com");
  assert.equal(l.destinatario_mascarado, "z•••@lab.vivanomads.test");
  // Linha antiga gravada antes do filtro: link com token nunca chega à tela.
  const antiga = linhaParaTela({ id: "2", criado_em: "2026-10-25T12:00:00Z", evento: "x", assunto: "a", corpo: "Entre: https://vivanomads.com.br/auth/confirm?token=abc123&type=magic", destinatario_mascarado: "•••" });
  assert.doesNotMatch(antiga.corpo, /token=|abc123/);
  assert.match(antiga.corpo, /\[link com token removido\]/);
});

test("opções dos filtros saem das próprias linhas (sem outra tabela), conta pelo destinatário mascarado", () => {
  const o = opcoesFiltroQa([
    { usuario_id: A, destinatario_mascarado: "p•••@vivanomads.com.br", evento: "proposta_recebida" },
    { usuario_id: A, destinatario_mascarado: "p•••@vivanomads.com.br", evento: "codigo" },
    { usuario_id: B, destinatario_mascarado: "i•••@vivanomads.com.br", evento: "codigo" },
    { usuario_id: null, destinatario_mascarado: "•••", evento: "lab" },
  ]);
  assert.deepEqual(o.eventos, ["codigo", "lab", "proposta_recebida"]);
  assert.deepEqual(o.contas, [
    { id: B, rotulo: "i•••@vivanomads.com.br · 22222222" },
    { id: A, rotulo: "p•••@vivanomads.com.br · 11111111" },
  ]);
});

test("filtro da URL: só conta e evento conhecidos; o resto é ignorado", () => {
  const o = { contas: [{ id: A, rotulo: "a" }], eventos: ["codigo"] };
  assert.deepEqual(filtroQaDaUrl({ conta: A, evento: "codigo" }, o), { conta: A, evento: "codigo" });
  assert.deepEqual(filtroQaDaUrl({ conta: [A, B], evento: ["codigo"] }, o), { conta: A, evento: "codigo" });
  assert.deepEqual(filtroQaDaUrl({ conta: B, evento: "outro" }, o), { conta: null, evento: null });
  assert.deepEqual(filtroQaDaUrl({ conta: "' or 1=1 --", evento: "" }, o), { conta: null, evento: null });
  assert.deepEqual(filtroQaDaUrl({}, o), { conta: null, evento: null });
});

test("E199 (opção b): leitor de QA abre; admin vai para a aba E-mails do admin; os demais, 404", () => {
  assert.deepEqual(destinoLeitorQa({ qa_leitor: true, is_teste: true, role: "tenant" }), { tipo: "abre" });
  // Leitor de QA que também fosse admin continua abrindo a área de QA (a regra de leitura não muda).
  assert.deepEqual(destinoLeitorQa({ qa_leitor: true, is_teste: true, role: "admin" }), { tipo: "abre" });
  assert.deepEqual(destinoLeitorQa({ qa_leitor: false, is_teste: false, role: "admin" }), { tipo: "admin", href: "/admin/dados-de-teste?aba=emails" });
  for (const p of [null, undefined, {}, { qa_leitor: false, is_teste: false, role: "owner" }, { qa_leitor: true, is_teste: false, role: "tenant" }, { qa_leitor: false, is_teste: true, role: null }]) {
    assert.deepEqual(destinoLeitorQa(p), { tipo: "nao_encontrado" }, JSON.stringify(p));
  }
});

test("proxy: /dashboard/qa — admin é redirecionado; sem a marca = 404 DE VERDADE (rewrite com status), depois do login", () => {
  const proxy = ler("src/proxy.ts");
  const i = proxy.indexOf("if (user && rotaLeitorQa(pathname))");
  assert.ok(i > 0);
  const bloco = proxy.slice(i, i + 1400);
  assert.match(bloco, /\.from\("profiles"\)\.select\("qa_leitor, is_teste, role"\)\.eq\("id", user\.id\)/);
  assert.match(bloco, /const destino = destinoLeitorQa\(perfilQa\);/);
  assert.match(bloco, /destino\.tipo === "admin"[\s\S]*NextResponse\.redirect\(alvo\)/);
  assert.match(bloco, /NextResponse\.rewrite\(naoEncontrado, \{ status: 404 \}\)/);
  assert.ok(proxy.indexOf("if (isProtected && !user)") < i, "sem sessão vai para o login antes");
});

test("página: fora de /admin, 404 para quem não pode, leitura pela sessão (RLS), sem chave de serviço", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/qa/emails/page.tsx");
  assert.match(pagina, /if \(destino\.tipo === "admin"\) redirect\(destino\.href\);/);
  assert.match(pagina, /if \(destino\.tipo !== "abre"\) notFound\(\);/);
  assert.match(pagina, /if \(!user\) notFound\(\);/);
  assert.match(pagina, /\.from\("profiles"\)\.select\("qa_leitor, is_teste, role"\)/);
  assert.doesNotMatch(pagina, /createAdminClient|SERVICE_ROLE|is_admin|mfa/i);
  assert.doesNotMatch(pagina, /usuario_id, destinatario_mascarado, evento"\)[^;]*\.from\("profiles"/, "opções sem ler perfis alheios");
  assert.deepEqual([...pagina.matchAll(/\.from\("(\w+)"\)/g)].map((m) => m[1]).sort(), ["emails_teste", "emails_teste", "profiles"]);
  assert.match(pagina, /<ListaEmailsTeste/);
  assert.match(pagina, /data-testid="qa-emails-conta"/);
  assert.match(pagina, /data-testid="qa-emails-evento"/);
});

test("a mesma lista em /admin/emails-teste e em /dashboard/qa/emails, sempre mascarada", () => {
  const lista = ler("src/components/admin/lista-emails-teste.tsx");
  assert.match(lista, /const itens = linhas\.map\(linhaParaTela\);/);
  assert.doesNotMatch(lista, /linhas\.map\(\(l\)/, "a tela só desenha as linhas mascaradas");
  assert.match(lista, /data-testid="emails-teste-cartoes"/);
  assert.match(lista, /data-testid="emails-teste-tabela"/);
  assert.match(ler("src/components/admin/emails-teste-lista.tsx"), /<ListaEmailsTeste/);
});

test("2FA do admin intocado: ADMIN_2FA_OBRIGATORIA e is_admin() fora deste item", () => {
  for (const p of ["src/app/(dashboard)/dashboard/qa/emails/page.tsx", "src/components/admin/lista-emails-teste.tsx"]) {
    assert.doesNotMatch(ler(p), /ADMIN_2FA_OBRIGATORIA|is_admin/);
  }
});
