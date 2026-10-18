/*
  Menu do painel em cascata, conta única (ordem 9f3085d8).
  Roda: node --test src/config/menu-painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ANUNCIAR, contemRota, folhas, menuDoPainel, rotaAtiva } from "./menu-painel.ts";

const base = { temImovel: false, admin: false, estadiaAtiva: false };
const ids = (m: ReturnType<typeof menuDoPainel>) => m.map((i) => i.id);

test("todo usuário vê moradia (busca, favoritos, candidaturas, Minhas estadias), mensagens, ferramentas e conta", () => {
  const m = menuDoPainel(base);
  assert.deepEqual(ids(m), ["visao", "moradia", "comunicacao", "ferramentas", "conta"]);
  const moradia = folhas(m.filter((i) => i.id === "moradia")).map((i) => i.rotulo);
  for (const r of ["Buscar imóveis", "Favoritos & comparações", "Candidaturas", "Minhas estadias"]) assert.ok(moradia.includes(r), r);
  assert.ok(!moradia.includes("Solicitações"), "Solicitações só com estadia ativa");
});

test("seções de dono só para quem já anunciou; quem nunca anunciou não vê nada de dono", () => {
  const sem = folhas(menuDoPainel(base)).map((i) => i.href);
  for (const h of ["/dashboard/imoveis", "/dashboard/contratos", "/dashboard/garantias", "/dashboard/assinatura", "/dashboard/orcamentos"])
    assert.ok(!sem.includes(h), h);
  const com = menuDoPainel({ ...base, temImovel: true });
  assert.deepEqual(ids(com), ["visao", "moradia", "comunicacao", "imoveis", "contratos", "ferramentas", "conta"]);
  const todos = folhas(com).map((i) => i.href);
  assert.ok(!todos.includes("/dashboard/assinatura"), "sem mensalidade: dono não vê 'Plano e assinatura'");
  assert.ok(!folhas(com).some((i) => /assinatura|mensalidade/i.test(i.rotulo)), "nenhum rótulo de mensalidade");
  const contratos = folhas(com.filter((i) => i.id === "contratos")).map((i) => i.rotulo);
  assert.deepEqual(contratos, ["Contratos & blocos", "Caução e garantias", "Conferência de entrada"]);
  assert.equal(ANUNCIAR.href, "/dashboard/imoveis/novo");
});

test("Administração separada, só para admin, com itens dentro de itens", () => {
  assert.ok(!ids(menuDoPainel(base)).includes("admin"));
  const adm = menuDoPainel({ ...base, admin: true }).find((i) => i.id === "admin")!;
  assert.ok(adm.filhos!.some((f) => f.filhos && f.filhos.length > 1), "subgrupos (cascata de 3 níveis)");
  const hrefs = folhas([adm]).map((i) => i.href);
  for (const h of ["/admin", "/admin/pedidos", "/admin/ajuda-publicacao", "/admin/documentos", "/admin/socios", "/admin/parceiros", "/admin/fotografos", "/admin/atendimento", "/admin/financeiro", "/admin/marketing", "/admin/agentes"])
    assert.ok(hrefs.includes(h), h);
});

test("estadia ativa revela Solicitações dentro de Minha moradia", () => {
  const m = menuDoPainel({ ...base, estadiaAtiva: true });
  assert.ok(folhas(m).some((i) => i.href === "/dashboard/solicitacoes"));
});

test("regra 0.5: todo link é rota interna do painel (fora a busca pública) e a tela existe", () => {
  const todos = folhas(menuDoPainel({ temImovel: true, admin: true, estadiaAtiva: true }));
  const ids = todos.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "ids únicos");
  for (const { href } of [...todos, ANUNCIAR]) {
    const rota = href!.split("#")[0];
    if (rota === "/buscar") continue;
    assert.match(rota, /^\/(dashboard|admin|qualificar)(\/|$)/, rota);
    const pasta = new URL(`../app/(dashboard)${rota}/page.tsx`, import.meta.url);
    assert.ok(existsSync(pasta), `tela existe: ${rota}`);
  }
});

test("grupo abre na tela atual; /dashboard só exato; subpágina conta", () => {
  const m = menuDoPainel({ ...base, temImovel: true });
  const imoveis = m.find((i) => i.id === "imoveis")!;
  assert.equal(contemRota(imoveis, "/dashboard/imoveis/abc"), true);
  assert.equal(contemRota(imoveis, "/dashboard/contratos"), false);
  assert.equal(rotaAtiva("/dashboard", "/dashboard/imoveis"), false);
  assert.equal(rotaAtiva("/dashboard/contratos#conferencia", "/dashboard/contratos"), true);
});

test("prompt 16: Viabilidade saiu do menu; 'Análise da carteira' só com 3+ imóveis ativos", () => {
  const ids = (m: ReturnType<typeof menuDoPainel>) => m.flatMap((i) => [i.id, ...(i.filhos ?? []).map((f) => f.id)]);
  const base = { temImovel: true, admin: false, estadiaAtiva: false };
  assert.ok(!ids(menuDoPainel(base)).includes("viabilidade"));
  assert.ok(!ids(menuDoPainel({ ...base, imoveisAtivos: 2 })).includes("carteira"));
  assert.ok(ids(menuDoPainel({ ...base, imoveisAtivos: 3 })).includes("carteira"));
});
