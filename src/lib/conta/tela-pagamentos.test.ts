/*
  A7 — Conta › Pagamentos (mockup perfil-07): textos do desenho, vocabulário e a trava de dinheiro.
  Roda: node --test src/lib/conta/tela-pagamentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTA_MORADOR, NOTA_RECEBE, TITULO_MORADOR, TITULO_RECEBE } from "./tela-pagamentos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("títulos e nota do desenho", () => {
  assert.equal(TITULO_RECEBE, "Como você recebe (proprietário)");
  assert.equal(TITULO_MORADOR, "Para suas estadias (morador)");
  assert.equal(NOTA_RECEBE, "O pagamento do morador vai direto para você — a Viva não fica com o seu dinheiro.");
  assert.match(NOTA_MORADOR, /A Viva não recebe esse valor/);
});

test("vocabulário: sem comissão, reserva, hóspede ou temporada", () => {
  const t = [TITULO_RECEBE, NOTA_RECEBE, TITULO_MORADOR, NOTA_MORADOR].join(" ");
  assert.doesNotMatch(t, /comiss|reserva|hósped|temporada|check-in/i);
});

test("E70: sem botão morto de cartão — 'em breve' + 'Avise-me'; nenhuma cobrança nem cadastro de cartão", () => {
  const tela = ler("src/components/account/pagamentos-conta.tsx");
  assert.doesNotMatch(tela, /conta-cartao-adicionar|Adicionar cartão/);
  assert.match(tela, /data-testid="conta-cartao-em-breve"/);
  assert.match(tela, /gravarLocalStorageBruto\("vivanomads-cartao-interesse", "1"\)/);
  assert.doesNotMatch(tela, /stripe|asaas|pagarme|mercadopago|checkout|tokeniz|card_number|cobranca/i);
  const pagina = ler("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  assert.match(pagina, /<CascaConta ativo="pagamentos">\s*<PagamentosConta \/>/);
});

test("a chave salva aparece mascarada no campo com o botão de copiar", () => {
  const tela = ler("src/components/account/pagamentos-conta.tsx");
  assert.match(tela, /\{pix\.rotuloTipo\}: \{pix\.mascarada\}/);
  assert.match(tela, /aria-label=\{copiado \? "Chave Pix copiada" : "Copiar chave Pix"\}/);
});

test("a coluna não alarga com chave Pix longa (390 px sem rolagem lateral)", () => {
  const tela = ler("src/components/account/pagamentos-conta.tsx");
  assert.match(tela, /grid grid-cols-\[minmax\(0,1fr\)\] gap-4" data-testid="conta-pagamentos"/);
  assert.match(tela, /min-w-0 flex-1 truncate/);
  assert.match(tela, /mt-4 grid grid-cols-\[minmax\(0,1fr\)\] gap-3/);
});

test("E70: três cartões com a foto do acervo (padrão dos Papéis); o do parceiro fala em taxa de serviço e faz ponte", async () => {
  const tela = ler("src/components/account/pagamentos-conta.tsx");
  for (const k of ["proprietario", "morador", "parceiro"]) assert.match(tela, new RegExp(`<CartaoComFoto foto=\\{PHOTOS\\.pagamentos\\.${k}\\}`), k);
  assert.match(tela, /href="\/dashboard\/parceiro"/);
  const t = await import("./tela-pagamentos.ts");
  assert.match(t.NOTA_PARCEIRO, /90%/);
  assert.match(t.NOTA_PARCEIRO, /taxa de serviço/);
  for (const x of [t.NOTA_PARCEIRO, t.CONVITE_PARCEIRO, t.CARTAO_EM_BREVE, t.AVISE_CARTAO]) assert.doesNotMatch(x, /comiss|h[oó]spede|reserva/i);
  assert.equal(t.DICA_SALVAR_CHAVE, "Preencha a chave para salvar.");
});
