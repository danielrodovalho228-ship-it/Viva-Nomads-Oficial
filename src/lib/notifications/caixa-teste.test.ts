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
  assert.ok(!JSON.stringify(r).includes("a@b.com"));
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

test("E274: a foto de capa do cartão do imóvel vai para a caixa de QA (o texto puro não a tem) e só ela", async () => {
  const { cartaoImovel } = await import("./cartoes-email.ts");
  const { corpoComCabecalho, fotosDosCartoes, fotosNoCorpo, fotoDeCartaoValida } = await import("./caixa-teste.ts");
  const SITE = "https://vivanomads.com.br";
  const CAPA = "https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp";
  const cartao = (id: string, foto: string | null) => cartaoImovel(SITE, { id, titulo: `Apto ${id}`, bairro: "Santa Mônica", cidade: "Uberlândia", totalMes: 3350, fotoCapa: foto });
  const a = cartao("a", CAPA);
  // O texto puro do cartão (o que a caixa guardava) não tem foto: era por isso que o QA via só o cabeçalho.
  assert.doesNotMatch(a.text, /_next\/image|supabase/);
  const html = `<img src="${SITE}/emails/transacional.jpg">${a.html}${cartao("b", null).html}${cartao("c", CAPA).html}`;
  const fotos = fotosDosCartoes(html);
  // A capa do cartão "a" (a mesma URL que o cliente de e-mail carrega); o cabeçalho e o cartão sem foto ficam de fora;
  // a mesma capa repetida entra uma vez.
  assert.deepEqual(fotos, [`${SITE}/api/email/foto?p=7216d0e9-6246-482a-a1de-524fd5231dc2/bcc6ad2b-efe6-497d-af45-885f854e3ddf.webp`]);
  const corpo = corpoComCabecalho("Olá Ana", { remetente: "Viva Nomads", imagem: "transacional.jpg", fotos });
  assert.match(corpo, /^Remetente: Viva Nomads\nImagem: transacional\.jpg\nFoto do cartão: https:\/\/vivanomads\.com\.br\/api\/email\/foto\?p=/);
  assert.deepEqual(fotosNoCorpo(corpo), fotos);
  // A tela só mostra como imagem a foto do otimizador com a capa do Storage público; nada de URL qualquer.
  assert.equal(fotoDeCartaoValida("https://evil.example/x.jpg"), false);
  assert.equal(fotoDeCartaoValida(`${SITE}/_next/image?url=${encodeURIComponent("https://evil.example/x.jpg")}&w=640&q=75`), false);
  assert.deepEqual(fotosNoCorpo("Foto do cartão: https://evil.example/x.jpg"), []);
  // A linha da foto sobrevive à limpeza de links com token (url, w e q não são credencial).
  assert.equal(linhaParaTela({ id: "1", criado_em: "", evento: "e", assunto: "a", corpo, destinatario_mascarado: "a•••@x" }).corpo, corpo);
});

test("E274: o envio grava as fotos dos cartões na caixa, e as duas listas de QA as mostram como imagem", () => {
  const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
  assert.match(email, /fotos: fotosDosCartoes\(params\.html\)/);
  const lista = readFileSync(new URL("../../components/admin/lista-emails-teste.tsx", import.meta.url), "utf8");
  assert.equal((lista.match(/<FotosDoCartao corpo=\{l\.corpo\} \/>/g) ?? []).length, 2, "celular e computador");
  assert.match(lista, /const fotos = fotosNoCorpo\(corpo\);/);
});
