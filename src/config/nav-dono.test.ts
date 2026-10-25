/* Roda: node --test src/config/nav-dono.test.ts — PROP-1 (substitui o NAV-A2): navegação do dono no computador. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ABAS_DONO, CONTA_DONO, GANHOS_DISPONIVEL, ROTAS_SO_MORADOR, abaAtivaDono, subabaAtivaDono } from "./nav-dono.ts";
import { folhas, menuDoPainel } from "./menu-painel.ts";

const rota = (href: string) => `src/app/(dashboard)${href}/page.tsx`;

test("abas do topo (snapshot): Início · Anúncios · Interessados · Contratos · Mensagens", () => {
  assert.deepEqual(
    ABAS_DONO.map((a) => [a.rotulo, a.href]),
    [["Início", "/dashboard"], ["Anúncios", "/dashboard/imoveis"], ["Interessados", "/dashboard/leads"], ["Contratos", "/dashboard/contratos"], ["Mensagens", "/dashboard/mensagens"]],
  );
  assert.deepEqual(ABAS_DONO.find((a) => a.id === "interessados")!.subabas!.map((s) => s.rotulo), ["Interessados", "Propostas", "Fechamento", "Pedidos na cidade"]);
  assert.deepEqual(ABAS_DONO.find((a) => a.id === "contratos")!.subabas!.map((s) => s.rotulo), ["Contratos", "Caução", "Recibos e notas"]);
  assert.equal(GANHOS_DISPONIVEL, false, "Ganhos nasce no PROP-4; até lá a subaba não aparece");
});

test("menu Conta ▾ (snapshot), com Modo morador e Sair como ações; MENUS-5: Ferramentas saíram da Conta", () => {
  assert.deepEqual(CONTA_DONO.map((i) => i.rotulo), ["Perfil e dados", "Verificação", "Pagamentos e recebimentos", "Notificações", "Avaliações recebidas", "Plano", "Modo morador", "Sair"]);
  assert.deepEqual(CONTA_DONO.filter((i) => i.acao).map((i) => i.acao), ["modo-morador", "sair"]);
});

test("toda aba, subaba e item da Conta aponta para uma tela que existe (rotas antigas seguem abrindo)", () => {
  const hrefs = [...ABAS_DONO.flatMap((a) => [a.href, ...(a.subabas ?? []).map((s) => s.href)]), ...CONTA_DONO.filter((i) => !i.acao).map((i) => i.href)];
  for (const h of hrefs) {
    const conta = h.startsWith("/dashboard/conta/") ? "src/app/(dashboard)/dashboard/conta/[secao]/page.tsx" : rota(h);
    assert.ok(existsSync(conta), `${h} → ${conta}`);
  }
});

test("aba ativa certa nas subrotas", () => {
  const casos: Array<[string, string | null, string | null]> = [
    ["/dashboard", "inicio", null],
    ["/dashboard/imoveis/123/editar", "anuncios", null],
    ["/dashboard/leads", "interessados", "interessados"],
    ["/dashboard/orcamentos", "interessados", "propostas"],
    ["/dashboard/propostas", "interessados", "propostas"],
    ["/dashboard/fechamento/abc", "interessados", "fechamento"],
    ["/dashboard/pedidos-cidade", "interessados", "pedidos-cidade"],
    ["/dashboard/contratos/xyz", "contratos", "contratos"],
    ["/dashboard/garantias", "contratos", "caucao"],
    ["/dashboard/recibos", "contratos", "recibos"],
    ["/dashboard/mensagens", "mensagens", null],
    ["/dashboard/conta/perfil", null, null],
  ];
  for (const [p, aba, sub] of casos) {
    assert.equal(abaAtivaDono(p)?.id ?? null, aba, p);
    assert.equal(subabaAtivaDono(p)?.id ?? null, sub, p);
  }
});

test("nenhum item de morador no modo dono; no modo morador eles continuam", () => {
  const ctx = { temImovel: true, admin: false, estadiaAtiva: true };
  const dono = folhas(menuDoPainel({ ...ctx, modo: "owner" })).map((i) => i.href ?? "");
  for (const r of ROTAS_SO_MORADOR) assert.ok(!dono.includes(r), `modo dono não mostra ${r}`);
  const morador = folhas(menuDoPainel({ ...ctx, modo: "tenant" })).map((i) => i.href ?? "");
  for (const r of ROTAS_SO_MORADOR) assert.ok(morador.includes(r), `modo morador mostra ${r}`);
  for (const a of ABAS_DONO) assert.ok(!ROTAS_SO_MORADOR.includes(a.href));
});

test("'Conferência de entrada' saiu do menu", () => {
  const todos = folhas(menuDoPainel({ temImovel: true, admin: true, estadiaAtiva: true })).map((i) => i.rotulo);
  assert.ok(!todos.includes("Conferência de entrada"));
});

test("MENUS-5: fora do /admin, todo papel navega pelo topo (sem barra lateral); a barra lateral só na equipe", () => {
  const s = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
  assert.match(s, /const papelTopo = naAreaAdmin \? null : papelAtivo;/);
  assert.match(s, /\{!papelTopo && <aside [^>]*data-testid="barra-lateral">/);
  assert.match(s, /<TopoPainel papel=\{papelTopo\}/);
  assert.match(s, /<SubabasPainel papel=\{papelTopo\}/);
  assert.match(s, /modo: mode === "owner" \? "owner" : "tenant"/);
  // Celular: a barra de baixo (da mesma fonte) e a Conta no avatar do topo.
  assert.match(s, /<MobileTabBar [^>]*comContrato=\{comContrato\}/);
  assert.match(s, /<MenuConta [^>]*compacto \/>/);
});
