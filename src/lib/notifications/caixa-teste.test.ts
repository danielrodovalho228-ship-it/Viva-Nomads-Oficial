import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CORPO_MAX, linhaParaTela, mascararDestinatario, montarRegistroEmailTeste, semLinksComToken } from "./caixa-teste.ts";

// Ordem 7436a29a item 4: caixa de e-mails de teste, lida em /admin/emails-teste.
const ler = (p: string) => readFileSync(p, "utf8");

test("destinatário sempre mascarado, nunca o e-mail completo", () => {
  assert.equal(mascararDestinatario("ana.souza@lab.vivanomads.test"), "a•••@lab.vivanomads.test");
  for (const ruim of ["", "   ", "sem-arroba", "@dominio.com", "fim@", null, undefined]) assert.equal(mascararDestinatario(ruim), "•••");
});

test("registro: corta tamanhos, tira controle e só aceita uuid válido", () => {
  const r = montarRegistroEmailTeste({ evento: "chamado_respondido", assunto: "Oi\u0000", texto: "x".repeat(CORPO_MAX + 500), para: "a@b.com", usuarioId: "não-é-uuid" });
  assert.equal(r.assunto, "Oi");
  assert.equal(r.corpo.length, CORPO_MAX);
  assert.equal(r.usuario_id, null);
  assert.equal(r.destinatario_mascarado, "a•••@b.com");
  // E435 (02/11): o endereço inteiro fica SÓ na coluna `destinatario` (conta de teste, leitor de QA); o resto continua mascarado.
  assert.equal(r.destinatario, "a@b.com");
  assert.ok(!JSON.stringify({ ...r, destinatario: undefined }).includes("a@b.com"));
  const ok = montarRegistroEmailTeste({ evento: "e", assunto: "a", texto: "t", para: "x@y.com", usuarioId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(ok.usuario_id, "11111111-1111-4111-8111-111111111111");
});

test("a caixa é gravada só pelo servidor (dentro do sendEmail) e sem derrubar o envio", () => {
  const n = ler("src/lib/notifications/email.ts");
  assert.match(n, /await guardarSeContaDeTeste\(p\)/);
  const s = ler("src/lib/notifications/caixa-teste.ts");
  assert.match(s, /\.eq\("is_teste", true\)/);
  assert.ok(!/\.ilike\(/.test(s), "ilike trata _ do e-mail como curinga");
  assert.match(s, /catch \{\s*return false;/);
  assert.match(ler("src/lib/notifications/caixa-teste-servidor.ts"), /catch \{\s*return false;/);
});

test("0136: tabela com RLS (só admin lê, ninguém grava pela API) + aplicar idempotente + rollback", () => {
  const m = ler("supabase/migrations/0136_emails_teste.sql");
  assert.match(m, /create table if not exists public\.emails_teste/);
  assert.match(m, /enable row level security/);
  assert.match(m, /for select to authenticated/);
  assert.match(m, /p\.role = 'admin'/);
  assert.match(m, /\(select auth\.uid\(\)\)/);
  assert.ok(!/for (insert|update|delete|all)/i.test(m), "sem política de escrita: só o servidor grava");
  const a = ler("supabase/producao/aplicar-0136.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, /20261016000136/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.match(ler("supabase/producao/rollback/0136_rollback.sql"), /drop table if exists public\.emails_teste/);
});

test("os e-mails de teste são a aba E-mails de Dados de teste (ADMIN-2); /admin/emails-teste redireciona; atalho do admin", () => {
  // A lista (cartões no celular, tabela no computador) é a mesma do leitor de QA (QA-CAIXA-B).
  assert.match(ler("src/components/admin/emails-teste-lista.tsx"), /<ListaEmailsTeste/);
  const lista = ler("src/components/admin/lista-emails-teste.tsx");
  assert.match(lista, /md:hidden/);
  assert.match(lista, /hidden md:block/);
  assert.match(ler("src/app/(dashboard)/admin/dados-de-teste/page.tsx"), /<EmailsTesteLista \/>/);
  assert.match(ler("src/app/(dashboard)/admin/emails-teste/page.tsx"), /redirect\(HREF_EMAILS_TESTE\)/);
  assert.match(ler("src/config/menu-admin.ts"), /"\/admin\/emails-teste": "/);
  assert.match(ler("src/app/(dashboard)/admin/atalhos-admin.tsx"), /\/admin\/dados-de-teste\?aba=emails/);
});

// E163 (lab da Pista C, t480·1b): o link /auth/confirm?token_hash=… passava inteiro pela limpeza da caixa de QA.
test("E163: nenhum link com credencial atravessa — token_hash, tokenHash, fragmento, caminho do site e nomes futuros", () => {
  const vazam = [
    "http://localhost:3123/auth/confirm?token_hash=tk480hash&type=recovery&next=/auth/reset",
    "https://vivanomads.com.br/auth/confirm?type=email&tokenHash=SEGREDO1",
    "/auth/confirm?token_hash=SEGREDO2&type=signup",
    "https://vivanomads.com.br/auth/callback#access_token=SEGREDO3&refresh_token=x",
    "http://127.0.0.1:54321/auth/v1/verify?token=SEGREDO4&type=magiclink&redirect_to=http://localhost:3123",
    "https://vivanomads.com.br/api/conta/excluir?code=SEGREDO5",
    "https://vivanomads.com.br/prova/celular?token=SEGREDO6",
    "https://vivanomads.com.br/qualquer?otp=SEGREDO7",
    "https://vivanomads.com.br/qualquer?x=1&reset_key=SEGREDO8",
    "https://vivanomads.com.br/qualquer?Token%5Fhash=SEGREDO9",
    // Rota de acesso perde o link inteiro mesmo com parâmetro de nome inocente.
    "https://vivanomads.com.br/auth/confirm?type=recovery&ref=SEGREDO10",
  ];
  for (const link of vazam) {
    const limpo = semLinksComToken(`Abra ${link} agora.`);
    assert.doesNotMatch(limpo, /SEGREDO|tk480hash/, link);
    assert.match(limpo, /^Abra \[link com token removido\] agora\.$/, link);
  }
});

test("E163: link sem credencial e texto comum continuam legíveis", () => {
  const ok = [
    "Veja https://vivanomads.com.br/imoveis/abc e responda.",
    "Busque em https://vivanomads.com.br/parceiros/buscar?categoria=limpeza hoje.",
    "Continue em /dashboard/imoveis/novo?draft=123&etapa=onde quando puder.",
    "Entre em https://vivanomads.com.br/auth para começar.",
    "Preço: R$ 250/mês, 30–180 dias. Código do pedido: SV-ABC123.",
  ];
  for (const t of ok) assert.equal(semLinksComToken(t), t);
});

test("E163: a tela (linhaParaTela) aplica a mesma limpeza no assunto e no corpo, e mascara e-mails", () => {
  const l = linhaParaTela({
    id: "1",
    criado_em: "2026-10-25T12:00:00Z",
    evento: "x",
    assunto: "Confirme /auth/confirm?token_hash=SEGREDO",
    corpo: "Redefinir: http://localhost:3123/auth/confirm?token_hash=SEGREDO&type=recovery\nPara: ana.souza@lab.vivanomads.test",
    destinatario_mascarado: "ana.souza@lab.vivanomads.test",
  });
  assert.doesNotMatch(`${l.assunto}${l.corpo}${l.destinatario_mascarado}`, /SEGREDO|token_hash|ana\.souza@/);
  assert.match(l.corpo, /Redefinir: \[link com token removido\]\nPara: a•••@lab\.vivanomads\.test/);
});

test("E274/E434: a foto do cartão aparece EMBUTIDA na caixa de QA; a URL crua nunca fica no corpo", async () => {
  const { cartaoImovel } = await import("./cartoes-email.ts");
  const { corpoComCabecalho, corpoSemUrlDeFoto, fotosDosCartoes, fotosNoCorpo, fotoDeCartaoValida } = await import("./caixa-teste.ts");
  const SITE = "https://vivanomads.com.br";
  const CAPA = "https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp";
  const cartao = (id: string, foto: string | null) => cartaoImovel(SITE, { id, titulo: `Apto ${id}`, bairro: "Santa Mônica", cidade: "Uberlândia", totalMes: 3350, fotoCapa: foto });
  const a = cartao("a", CAPA);
  // O texto puro do cartão (o que o e-mail real leva) não tem a URL da foto.
  assert.doesNotMatch(a.text, /_next\/image|supabase|api\/email\/foto/);
  const html = `<img src="${SITE}/emails/transacional.jpg">${a.html}${cartao("b", null).html}${cartao("c", CAPA).html}`;
  assert.deepEqual(fotosDosCartoes(html), [`${SITE}/api/email/foto?p=7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp`]);
  // E434: o corpo guardado não leva mais a linha "Foto do cartão: <URL>".
  const corpo = corpoComCabecalho("Olá Ana", { remetente: "Viva Nomads", imagem: "transacional.jpg" });
  assert.equal(corpo, "Remetente: Viva Nomads\nImagem: transacional.jpg\n\nOlá Ana");
  // E-mail ANTIGO (guardado com a linha): a tela mostra a foto embutida e tira a URL crua do texto.
  const LONGA = `${SITE}/_next/image?url=${encodeURIComponent(CAPA)}&w=640&q=75`;
  const antigo = `Remetente: Viva Nomads\nFoto do cartão: ${LONGA}\n\nOlá Ana`;
  const t = linhaParaTela({ id: "1", criado_em: "", evento: "e", assunto: "a", corpo: antigo, destinatario_mascarado: "a•••@x" });
  assert.deepEqual(t.fotos, [LONGA]);
  assert.doesNotMatch(t.corpo, /Foto do cartão|_next\/image|supabase/);
  assert.equal(corpoSemUrlDeFoto(antigo), "Remetente: Viva Nomads\n\nOlá Ana");
  // URL qualquer nunca vira imagem, e também sai do texto.
  assert.equal(fotoDeCartaoValida("https://evil.example/x.jpg"), false);
  assert.deepEqual(fotosNoCorpo("Foto do cartão: https://evil.example/x.jpg"), []);
  assert.equal(corpoSemUrlDeFoto("Foto do cartão: https://evil.example/x.jpg\nOi"), "Oi");
});

test("E434: o envio não grava a URL da foto; as listas mostram a imagem e a caixa da conta devolve o corpo sem a URL", () => {
  const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
  assert.doesNotMatch(email, /fotos: fotosDosCartoes/);
  const lista = readFileSync(new URL("../../components/admin/lista-emails-teste.tsx", import.meta.url), "utf8");
  assert.equal((lista.match(/<FotosDoCartao fotos=\{l\.fotos\} \/>/g) ?? []).length, 2, "celular e computador");
  const rota = readFileSync(new URL("../../app/api/conta/caixa-teste/route.ts", import.meta.url), "utf8");
  assert.match(rota, /corpo: corpoSemUrlDeFoto\(/);
});
