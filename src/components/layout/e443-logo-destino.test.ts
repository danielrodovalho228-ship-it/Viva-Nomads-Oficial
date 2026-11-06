/* Roda: node --test src/components/layout/e443-logo-destino.test.ts
  E443 (aberto 02/11): logado no /dashboard, clicar no LOGO "só ficava nesta página" — no computador ele apontava para o
  próprio painel (lia como botão morto), enquanto no celular e na equipe já ia para a página inicial. Convenção: o LOGO é
  a saída do painel — leva à página inicial pública ("/"); o "Início" do menu leva ao painel. Auditoria do destino de cada
  elemento do cabeçalho logado: logo (computador, celular, equipe), Início, Anúncios, Interessados, Contratos, Mensagens,
  sino e Conta. No modo app (Android/iPhone) o "/" já vai para a aba inicial do papel (proxy), então a convenção vale lá também.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABAS_MORADOR, ABAS_PARCEIRO, ABAS_PROPRIETARIO, HREF_LOGO_PAINEL, itensDaConta } from "../../config/abas-painel.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a convenção: o logo do painel leva à página inicial pública", () => {
  assert.equal(HREF_LOGO_PAINEL, "/");
});

test("computador: o topo do painel usa o logo da convenção (nunca /dashboard)", () => {
  const topo = ler("./topo-dono.tsx");
  assert.match(topo, /<Logo href=\{HREF_LOGO_PAINEL\} className="shrink-0" \/>/);
  assert.doesNotMatch(topo, /<Logo href="\/dashboard"/);
  assert.doesNotMatch(topo, /início do painel/);
});

test("celular e equipe: os logos do shell seguem a convenção (sem href próprio = página inicial)", () => {
  const shell = ler("./dashboard-shell.tsx");
  const logos = [...shell.matchAll(/<Logo\b[^>]*\/>/g)].map((m) => m[0]);
  assert.ok(logos.length >= 2, "topo do celular e barra da equipe");
  for (const l of logos) assert.doesNotMatch(l, /href=/, `Logo com destino próprio: ${l}`);
});

test("nenhum logo de layout aponta para o painel (nem o do assistente, que é só a marca)", () => {
  for (const f of ["./topo-dono.tsx", "./dashboard-shell.tsx", "./mobile-header.tsx", "./moldura-assistente.tsx", "./navbar.tsx"]) {
    const src = ler(f);
    assert.doesNotMatch(src, /<Logo[^>]*href="\/dashboard/, f);
  }
  assert.match(ler("./moldura-assistente.tsx"), /<Logo href=\{null\}/, "no assistente o logo não tira ninguém do fluxo");
});

test("o 'Início' do menu leva ao painel (o do parceiro, ao topo do painel dele) e as abas seguem os destinos de sempre", () => {
  const alvo = (abas: readonly { id: string; href: string }[]) => Object.fromEntries(abas.map((a) => [a.id, a.href]));
  const dono = alvo(ABAS_PROPRIETARIO);
  assert.equal(dono.inicio, "/dashboard");
  assert.equal(dono.anuncios, "/dashboard/imoveis");
  assert.equal(dono.interessados, "/dashboard/leads");
  assert.equal(dono.contratos, "/dashboard/contratos");
  assert.equal(dono.mensagens, "/dashboard/mensagens");
  assert.equal(alvo(ABAS_MORADOR).inicio, "/dashboard");
  assert.equal(alvo(ABAS_PARCEIRO).inicio, "/dashboard/parceiro#inicio");
  for (const abas of [ABAS_PROPRIETARIO, ABAS_MORADOR, ABAS_PARCEIRO]) {
    const inicio = abas.find((a) => a.id === "inicio");
    assert.ok(inicio && inicio.href !== HREF_LOGO_PAINEL, "Início e logo não levam ao mesmo lugar");
  }
});

test("Conta: 'Minha conta' abre a conta e 'Sair' sai para a página inicial", () => {
  const itens = itensDaConta("proprietario", { temImovel: true });
  assert.equal(itens.find((i) => i.id === "conta")?.href, "/dashboard/conta");
  const sair = itens.find((i) => i.id === "sair");
  assert.equal(sair?.href, "/");
  assert.equal(sair?.acao, "sair");
});

test("sino: abre o painel dos avisos e 'Ver todas' leva às notificações", () => {
  const sino = ler("../painel/sino-avisos.tsx");
  assert.match(ler("../../lib/notifications/sino.ts"), /VER_TODAS\s*=\s*`?"?\/dashboard\/notificacoes/);
  assert.match(sino, /href=\{VER_TODAS\}/);
});
