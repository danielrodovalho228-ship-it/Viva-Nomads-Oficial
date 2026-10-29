/*
  E228 — os 4 links da auditoria pós-E222-B: cada um leva a um destino que existe e faz o que o rótulo promete.
  Roda: node --test src/lib/e228-links.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { conversationId } from "./messages/conversation-id.ts";
import { TEMPLATES } from "./notifications/eventos-email.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const existe = (p: string) => existsSync(new URL(`../../${p}`, import.meta.url));

test("1. 'Ver serviços' (Meus pedidos vazio) leva ao catálogo da mesma tela, não ao /servicos que não existe", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/servicos/page.tsx");
  assert.doesNotMatch(pagina, /href="\/servicos"/);
  assert.match(pagina, /<ButtonLink href="#catalogo"[^>]*>Ver serviços<\/ButtonLink>/);
  // A âncora existe na própria tela e envolve o catálogo (ServicosPainel).
  assert.match(pagina, /<div id="catalogo" className="scroll-mt-24">\s*<ServicosPainel cidade=\{cidade\} \/>\s*<\/div>/);
  assert.ok(pagina.indexOf('id="catalogo"') < pagina.indexOf('href="#catalogo"'), "o catálogo fica acima do vazio de Meus pedidos");
  assert.equal(existe("src/app/(public)/servicos/page.tsx") || existe("src/app/servicos/page.tsx"), false, "não há rota /servicos");
});

test("2. renovacao_aviso: o botão diz 'Renovar a estadia' e o link segue o fluxo da renovação (E222-B)", () => {
  assert.equal(TEMPLATES.renovacao_aviso.cta, "Renovar a estadia");
  assert.match(ler("src/app/api/cron/automacoes/route.ts"), /tipo: "renovacao_aviso",[\s\S]{0,200}url: HREF_RENOVAR\(c\.id as string\)/);
});

test("3. candidatura_aceita: 'Abrir a conversa' abre a conversa da candidatura em Mensagens", () => {
  assert.equal(TEMPLATES.candidatura_aceita.cta, "Abrir a conversa");
  const acoes = ler("src/lib/data/leads-actions.ts");
  assert.match(acoes, /\.select\("id, owner_id, tenant_id, status, property_id"\)/);
  assert.match(acoes, /event: "candidatura_aceita",[\s\S]{0,300}pushUrl: `\/dashboard\/mensagens\?conversa=\$\{conversationId\(lead\.tenant_id, user\.id, lead\.property_id\)\}`/);
  assert.doesNotMatch(acoes, /pushUrl: "\/dashboard\/candidaturas"/);
  // O mesmo id que o pedido do morador gravou na 1ª mensagem: idConversa(morador, dono, imóvel) — a ordem não importa.
  assert.match(ler("src/lib/data/actions.ts"), /const conversationId = idConversa\(user\.id, ownerId, propertyId\);/);
  const [morador, dono, imovel] = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
  assert.equal(conversationId(morador, dono, imovel), conversationId(dono, morador, imovel));
  // Mensagens abre a conversa pedida por ?conversa=<uuid>.
  assert.match(ler("src/app/(dashboard)/dashboard/mensagens/page.tsx"), /sp\.conversa && UUID_RE\.test\(sp\.conversa\)/);
});

test("4. 'Ver as notificações' (caixa de e-mails de teste) vai direto a /dashboard/notificacoes; o redirecionamento antigo continua", () => {
  const caixa = ler("src/components/account/caixa-emails-teste.tsx");
  assert.match(caixa, /href="\/dashboard\/notificacoes" variant="secondary" size="sm">Ver as notificações/);
  assert.doesNotMatch(caixa, /\/dashboard\/conta\/notificacoes/);
  assert.ok(existe("src/app/(dashboard)/dashboard/notificacoes/page.tsx"));
  assert.match(ler("next.config.ts"), /source: "\/dashboard\/conta\/notificacoes", destination: "\/dashboard\/notificacoes"/);
});

test("os destinos existem no app router", () => {
  for (const p of ["src/app/(dashboard)/dashboard/servicos/page.tsx", "src/app/(dashboard)/dashboard/mensagens/page.tsx", "src/app/(dashboard)/dashboard/notificacoes/page.tsx", "src/app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/page.tsx"])
    assert.ok(existe(p), p);
});
