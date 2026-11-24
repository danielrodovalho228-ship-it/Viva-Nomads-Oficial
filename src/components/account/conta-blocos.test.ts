/*
  Conta em 4 blocos (prompt 18): cada assunto uma vez e o simulador tributário só em Ferramentas.
  Roda: node --test src/components/account/conta-blocos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const CONTA = ler("src/app/(dashboard)/dashboard/conta/page.tsx");

const SECAO = ler("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
const SECOES = ler("src/lib/conta/secoes.ts");

test("Conta (A1, NAV-A): oito telas na ordem Perfil → Como você usa a Viva → Avaliações → Dados → Privacidade → Notificações → Pagamentos → Ajuda", () => {
  const ordem = ["perfil", "papeis", "avaliacoes", "dados", "privacidade", "seguranca", "notificacoes", "pagamentos", "ajuda"].map((id) => SECOES.indexOf(`id: "${id}"`));
  assert.ok(ordem.every((i) => i > 0), `faltou seção: ${ordem}`);
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
  // E492: no computador /dashboard/conta leva ao Perfil (/dashboard/conta/perfil, um endereço só); no celular, o menu.
  assert.match(CONTA, /window\.location\.replace\(destinoDaContaNoComputador\(destino\)\)/);
  // E789 (devolução do julgamento, 11/11): a página de servidor entrega o Perfil já lido (`inicial`); a casca é a mesma.
  assert.match(SECAO, /<CascaConta ativo="perfil" topoDireita>\s*<PerfilTela inicial=\{inicial\} \/>/);
  assert.match(CONTA, /<div className="lg:hidden">\s*<ContaMenu \/>/);
  // Cada seção é um caso de /conta/[secao] ou a sua rota própria (as que leem dados no servidor, ex.: Avaliações).
  // E679: Avaliações saiu da casca da Conta — é o painel único /dashboard/avaliacoes; a rota antiga só redireciona.
  // E798 (asserção alterada): o destino mora em lib/conta/redirecionar-no-servidor (usado também pelo proxy).
  assert.match(ler("src/app/(dashboard)/dashboard/conta/avaliacoes/page.tsx"), /redirect\(destinoContaAvaliacoes\(/);
  assert.match(ler("src/lib/conta/redirecionar-no-servidor.ts"), /\/dashboard\/avaliacoes\?aba=recebidas/);
  for (const id of ["papeis", "dados", "privacidade", "seguranca", "pagamentos", "ajuda"]) {
    const propria = existsSync(new URL(`../../app/(dashboard)/dashboard/conta/${id}/page.tsx`, import.meta.url));
    assert.match(propria ? ler(`src/app/(dashboard)/dashboard/conta/${id}/page.tsx`) : SECAO, new RegExp(`<CascaConta ativo="${id}"`), id);
  }
  // E176 (parte 2): Notificações é uma página só — a do sino, na casca da Conta.
  assert.match(ler("src/app/(dashboard)/dashboard/notificacoes/page.tsx"), /<CascaConta ativo="notificacoes">/);
});

test("Conta: sem repetições — cada assunto numa tela só; nada de página longa", () => {
  assert.doesNotMatch(CONTA + SECAO, /PerfilDoModo|title="Verificação"|title="Segurança"|TaxSimulator|<AvatarUploader|<ConviteFotoPerfil|<TopoConta/);
  // E66 (QA 24/10): a lista de confiança saiu da Privacidade (o desenho perfil-05 não a tem) e mora, uma vez só, na
  // rota própria /dashboard/conta/seguranca (Segurança e verificações), junto com a senha; a Privacidade tem o link.
  assert.doesNotMatch(SECAO, /<ConfiancaLista/);
  assert.equal(ler("src/app/(dashboard)/dashboard/conta/seguranca/page.tsx").match(/<ConfiancaLista \/>/g)?.length, 1);
  assert.match(ler("src/components/account/tela-privacidade.tsx"), /href="\/dashboard\/conta\/seguranca"/);
  assert.doesNotMatch(SECAO, /<ChangePassword/);
  assert.equal(ler("src/app/(dashboard)/dashboard/conta/seguranca/page.tsx").match(/<ChangePassword \/>/g)?.length, 1);
  assert.doesNotMatch(CONTA, /<PageTitle|<ConfiancaLista|<ChangePassword/);
});

test("E292-bis: simulador tributário aposentado — fora da Conta, do cadastro, do hub; /dashboard/tributacao leva a Ferramentas", () => {
  assert.doesNotMatch(ler("src/components/account/conta-secoes.tsx"), /TaxSimulator/);
  assert.doesNotMatch(ler("src/app/auth/page.tsx"), /TaxSimulator/);
  const tela = ler("src/app/(dashboard)/dashboard/tributacao/page.tsx");
  assert.match(tela, /permanentRedirect\("\/dashboard\/ferramentas"\)/);
  assert.doesNotMatch(tela, /TaxSimulator/);
  // O cadastro e Ferramentas não mandam o público para a página interna (/tributario fica atrás do acesso de sócios).
  assert.doesNotMatch(ler("src/app/auth/page.tsx"), /href="\/tributario"/);
  const hub = ler("src/app/(dashboard)/dashboard/ferramentas/page.tsx");
  assert.doesNotMatch(hub, /\/dashboard\/tributacao|conta#tributacao|PF × PJ/);
});

test("menu: 'Verificação' abre direto a tela de Verificação (E76: /dashboard/verificacao, não a Privacidade)", () => {
  assert.match(ler("src/config/menu-por-papel.ts"), /rotulo: "Verificação", icone: "verificacao", href: "\/dashboard\/verificacao"/);
});

test("E292-bis: o simulador PF × PJ saiu de vez (nem a tela do dono, nem a memória dos sócios)", () => {
  assert.equal(existsSync(new URL("../../../src/components/tax-simulator.tsx", import.meta.url)), false);
  assert.match(ler("src/app/tributario/page.tsx"), /permanentRedirect\("\/dashboard\/ferramentas"\)/);
});

test("Conta: 'Ver como os outros veem' do proprietário só aparece com imóvel (sem perfil público a página dá 404)", () => {
  const src = ler("src/components/account/conta-blocos.tsx");
  assert.match(src, /function LinkPerfilPublico/);
  assert.match(src, /useProperties\("\/api\/properties\/mine"\)[\s\S]*properties\.length === 0\) return null/);
  assert.doesNotMatch(src, /mode !== "tenant"\) \{\s*return \(\s*<Link/);
});
