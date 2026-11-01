/*
  E425 (GRAVE) — parceiro aprovado não conseguia ativar a conta.
  Causa (produção, 01/11): a versão em TEXTO do e-mail "Sua parceria foi aprovada" não tinha a URL de ativação, só
  "Use o botão … na versão completa deste e-mail". Quem lê o texto (e a caixa de QA, que guarda o texto) ficava sem
  caminho para ativar. Correção: (1) URL completa no texto; (2) o mesmo núcleo de ativação no link e num botão do
  painel da conta do pedido; (3) este teste percorre aprovar → e-mail com link → ativação → painel do parceiro.
  Roda: node --test src/lib/parceiros/e425-ativacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emailParceriaAprovada } from "../notifications/montar-email.ts";
import { semLinksComToken } from "../notifications/caixa-teste.ts";
import { gerarToken, hashToken, tokenBemFormado } from "./token.ts";
import { situacaoToken } from "./regras.ts";
import { concluirAtivacao, podeAtivarPeloPainel, type SolicitacaoAtivavel } from "./ativacao-nucleo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const SITE = "https://vivanomads.com.br";

/** Banco falso, só com o que a ativação usa (parceiro_solicitacoes e parceiros). */
function bancoFalso(sol: SolicitacaoAtivavel & { token_ativacao_hash: string; token_expira_em: string }) {
  const tabelas: Record<string, Record<string, unknown>[]> = { parceiro_solicitacoes: [{ ...sol }], parceiros: [] };
  const cliente = {
    from(t: string) {
      const linhas = tabelas[t];
      let filtros: [string, unknown][] = [];
      let mudanca: Record<string, unknown> | null = null;
      const casa = () => linhas.filter((l) => filtros.every(([c, v]) => l[c] === v));
      const q = {
        update(v: Record<string, unknown>) {
          mudanca = v;
          return q;
        },
        select() {
          if (mudanca) {
            const alvo = casa();
            for (const l of alvo) Object.assign(l, mudanca);
            return Promise.resolve({ data: alvo.map((l) => ({ id: l.id })), error: null });
          }
          return q;
        },
        eq(c: string, v: unknown) {
          filtros = [...filtros, [c, v]];
          return q;
        },
        maybeSingle() {
          return Promise.resolve({ data: casa()[0] ?? null, error: null });
        },
        insert(v: Record<string, unknown>) {
          if (linhas.some((l) => l.slug === v.slug)) return Promise.resolve({ error: { code: "23505", message: "parceiros_slug_key" } });
          linhas.push({ id: `p${linhas.length + 1}`, ...v });
          return Promise.resolve({ error: null });
        },
        then(res: (x: { error: null }) => void) {
          if (mudanca) for (const l of casa()) Object.assign(l, mudanca);
          res({ error: null });
        },
      };
      return q;
    },
  };
  return { cliente, tabelas };
}

const pedido = (token: string): SolicitacaoAtivavel & { token_ativacao_hash: string; token_expira_em: string } => ({
  id: "sol-1",
  user_id: "u-parceira",
  email: "Marina@Exemplo.com.br",
  nome: "Marina Lente Prado",
  tipo_pessoa: "pf",
  emite_nota: null,
  documento: "12345678909",
  telefone: null,
  categorias: ["fotografia"],
  cidades: ["Uberlândia"],
  descricao: "Fotos de imóveis",
  status: "aprovada",
  token_ativacao_hash: hashToken(token),
  token_expira_em: new Date(Date.now() + 7 * 864e5).toISOString(),
});

test("aprovar → e-mail com a URL completa e utilizável (HTML e TEXTO)", () => {
  const token = gerarToken();
  const url = `${SITE}/parceiros/ativar?t=${encodeURIComponent(token)}`;
  const m = emailParceriaAprovada(SITE, { url, nome: "Marina Lente Prado" });
  assert.ok(m.text.includes(url), "o texto traz a URL inteira");
  assert.doesNotMatch(m.text, /versão completa deste e-mail/);
  assert.ok(m.html.includes(`href="${url}"`), "o botão do HTML aponta para a URL inteira");
  // A URL do e-mail devolve o token certo.
  const t = new URL(/https:\/\/\S+\/parceiros\/ativar\?t=\S+/.exec(m.text)![0]).searchParams.get("t")!;
  assert.equal(t, token);
  assert.ok(tokenBemFormado(t));
  // Na caixa de QA (E163) o link com token continua fora.
  assert.doesNotMatch(semLinksComToken(m.text), new RegExp(token));
  // A aprovação e o reenvio montam a URL absoluta do site.
  const admin = ler("src/lib/parceiros/admin-actions.ts");
  assert.equal((admin.match(/emailParceriaAprovada\(SITE_URL, \{ url: `\$\{SITE_URL\}\/parceiros\/ativar\?t=\$\{encodeURIComponent\(token\)\}`/g) ?? []).length, 2);
});

test("link → ativação → página do parceiro criada (rascunho); uso único", async () => {
  const token = gerarToken();
  const sol = pedido(token);
  const { cliente, tabelas } = bancoFalso(sol);
  // O link acha o pedido pelo hash do token e ele está válido.
  const achado = tabelas.parceiro_solicitacoes.find((l) => l.token_ativacao_hash === hashToken(token))!;
  assert.equal(situacaoToken({ status: achado.status as string, tokenExpiraEm: achado.token_expira_em as string }, new Date()), "valido");
  const r = await concluirAtivacao(cliente, sol, "u-parceira", "Este link já foi usado.");
  assert.deepEqual(r, { ok: true, slug: "marina-lente-prado" });
  assert.equal(tabelas.parceiro_solicitacoes[0].status, "ativada");
  const p = tabelas.parceiros[0];
  assert.equal(p.user_id, "u-parceira");
  assert.equal(p.status, "rascunho");
  assert.deepEqual(p.categorias, ["fotografia"]);
  // De novo: nada muda.
  assert.deepEqual(await concluirAtivacao(cliente, sol, "u-parceira", "Este link já foi usado."), { ok: false, erro: "Este link já foi usado." });
  assert.equal(tabelas.parceiros.length, 1);
  assert.equal(situacaoToken({ status: "ativada", tokenExpiraEm: sol.token_expira_em }, new Date()), "usado");
});

test("slug ocupado: tenta o próximo; nunca duplica a página", async () => {
  const sol = pedido(gerarToken());
  const { cliente, tabelas } = bancoFalso(sol);
  tabelas.parceiros.push({ id: "outro", user_id: "u-outra", slug: "marina-lente-prado" });
  assert.deepEqual(await concluirAtivacao(cliente, sol, "u-parceira"), { ok: true, slug: "marina-lente-prado-2" });
});

test("painel: só a conta do pedido aprovado, com e-mail confirmado, ativa", () => {
  const sol = { status: "aprovada", user_id: "u-parceira", email: "marina@exemplo.com.br" };
  const conta = { id: "u-parceira", email: "marina@exemplo.com.br", emailConfirmado: true };
  assert.equal(podeAtivarPeloPainel(sol, conta), true);
  assert.equal(podeAtivarPeloPainel(sol, { ...conta, id: "u-outra" }), false);
  assert.equal(podeAtivarPeloPainel(sol, { ...conta, emailConfirmado: false }), false);
  assert.equal(podeAtivarPeloPainel({ ...sol, status: "pendente" }, conta), false);
  assert.equal(podeAtivarPeloPainel({ ...sol, status: "ativada" }, conta), false);
  // Pedido aberto pela equipe (sem conta ligada): vale o mesmo e-mail.
  assert.equal(podeAtivarPeloPainel({ ...sol, user_id: null }, { ...conta, id: "u-nova", email: "MARINA@exemplo.com.br" }), true);
  assert.equal(podeAtivarPeloPainel({ ...sol, user_id: null }, { ...conta, email: "outra@exemplo.com.br" }), false);
  assert.equal(podeAtivarPeloPainel(null, conta), false);
});

test("telas: o link e o painel usam o mesmo núcleo; ativada, o parceiro entra no painel completo", () => {
  const acoes = ler("src/lib/parceiros/ativacao-actions.ts");
  assert.match(acoes, /return concluirAtivacao\(admin, sol as unknown as SolicitacaoAtivavel, user\.id, "Este link já foi usado\."\);/);
  assert.match(acoes, /export async function ativarPeloPainel\(\)/);
  assert.match(acoes, /\.find\(\(x\) => podeAtivarPeloPainel\(x, conta\)\)/);
  assert.match(acoes, /return concluirAtivacao\(admin, sol, user\.id\);/);
  const painel = ler("src/app/(dashboard)/dashboard/parceiro/page.tsx");
  assert.match(painel, /sol\?\.status === "aprovada" \?[\s\S]{0,700}<AtivarNoPainel \/>/);
  assert.match(painel, /const painel = await meuPainelParceiro\(\{ exigir: true \}\);\s*if \(painel\)/);
  assert.match(painel, /data-testid="parceiro-ativada"/);
  const botao = ler("src/app/(dashboard)/dashboard/parceiro/ativar-no-painel.tsx");
  assert.match(botao, /router\.push\("\/dashboard\/parceiro\?ativada=1"\);\s*router\.refresh\(\);/);
  // A página do link: sem sessão, "Entrar" volta para o mesmo link; com a conta certa, ativa e abre o painel.
  const link = ler("src/app/(public)/parceiros/ativar/ativar-parceria.tsx");
  assert.match(link, /href=\{`\/auth\?redirect=\$\{encodeURIComponent\(volta\)\}`\}/);
  assert.match(link, /if \(r\.ok\) router\.push\("\/dashboard\/parceiro\?ativada=1"\);/);
});
