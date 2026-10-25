/* Roda: node --test src/config/abas-painel.test.ts — MENUS-5 + MORADOR-NAV: fonte única das abas por papel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ABAS_MORADOR, ABAS_PROPRIETARIO, abaAtivaPainel, abasDoPapelPainel, itensDaConta, subabaAtivaPainel, type PapelAbas } from "./abas-painel.ts";
import { abasDoPapel } from "../lib/nav-mobile.ts";
import { ROTAS_SO_MORADOR } from "./nav-dono.ts";

const PAPEIS: PapelAbas[] = ["morador", "proprietario", "parceiro"];
const existe = (href: string) => {
  const rota = href.split("#")[0];
  if (rota === "/buscar") return existsSync("src/app/(public)/buscar/page.tsx");
  if (rota.startsWith("/dashboard/conta/")) return existsSync("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  if (rota === "/admin") return existsSync("src/app/(dashboard)/admin/page.tsx");
  return existsSync(`src/app/(dashboard)${rota}/page.tsx`);
};

test("no máximo 5 destinos por papel, com e sem contrato", () => {
  for (const papel of PAPEIS) for (const comContrato of [true, false]) assert.ok(abasDoPapelPainel(papel, { comContrato }).length <= 5, papel);
  assert.deepEqual(abasDoPapelPainel("morador", { comContrato: true }).map((a) => a.rotulo), ["Início", "Buscar", "Pedidos", "Mensagens", "Minha estadia"]);
  assert.deepEqual(abasDoPapelPainel("morador", { comContrato: false }).map((a) => a.rotulo), ["Início", "Buscar", "Pedidos", "Mensagens"]);
  assert.deepEqual(abasDoPapelPainel("proprietario").map((a) => a.rotulo), ["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"]);
});

test("fonte única: rótulos e hrefs do topo (computador) e da barra de baixo (celular) são idênticos", () => {
  for (const papel of PAPEIS) {
    for (const comContrato of [true, false]) {
      const topo = abasDoPapelPainel(papel, { comContrato }).map((a) => [a.rotulo, a.href]);
      const barra = abasDoPapel(papel, { comContrato }).map((a) => [a.label, a.href]);
      assert.deepEqual(barra, topo, papel);
    }
  }
});

test("nenhum item de morador no modo dono, e nenhum do dono no modo morador", () => {
  const dono = ABAS_PROPRIETARIO.flatMap((a) => [a.href, ...(a.subabas ?? []).map((s) => s.href)]);
  for (const h of dono) assert.ok(!ROTAS_SO_MORADOR.includes(h), h);
  const morador = ABAS_MORADOR.flatMap((a) => [a.href, ...(a.subabas ?? []).map((s) => s.href)]);
  for (const h of ["/dashboard/imoveis", "/dashboard/leads", "/dashboard/orcamentos", "/dashboard/fechamento", "/dashboard/garantias", "/dashboard/recibos", "/dashboard/pedidos-cidade"]) {
    assert.ok(!morador.includes(h), h);
  }
});

test("a aba certa acende nas subrotas", () => {
  const m = abasDoPapelPainel("morador", { comContrato: true });
  assert.equal(abaAtivaPainel(m, "/dashboard/favoritos")?.rotulo, "Buscar");
  assert.equal(abaAtivaPainel(m, "/dashboard/buscas")?.rotulo, "Buscar");
  assert.equal(abaAtivaPainel(m, "/dashboard/candidaturas")?.rotulo, "Pedidos");
  assert.equal(abaAtivaPainel(m, "/dashboard/propostas/123")?.rotulo, "Pedidos");
  assert.equal(abaAtivaPainel(m, "/dashboard/solicitacoes")?.rotulo, "Minha estadia");
  assert.equal(abaAtivaPainel(m, "/dashboard/estadia/abc")?.rotulo, "Minha estadia");
  assert.equal(subabaAtivaPainel(m, "/dashboard/contratos/abc")?.rotulo, "Contrato");
  assert.equal(abaAtivaPainel(m, "/dashboard")?.rotulo, "Início");
  const d = abasDoPapelPainel("proprietario");
  assert.equal(abaAtivaPainel(d, "/dashboard/garantias")?.rotulo, "Contratos");
  assert.equal(abaAtivaPainel(d, "/dashboard/recibos")?.rotulo, "Contratos");
  assert.equal(abaAtivaPainel(d, "/dashboard/fechamento")?.rotulo, "Interessados");
  assert.equal(abaAtivaPainel(d, "/dashboard/imoveis/xyz/editar")?.rotulo, "Anúncios");
  assert.equal(abaAtivaPainel(d, "/dashboard/conta"), null);
});

test("toda aba, subaba e item da Conta aponta para uma tela que existe (rotas antigas seguem abrindo)", () => {
  for (const papel of PAPEIS) {
    for (const a of abasDoPapelPainel(papel, { comContrato: true })) {
      assert.ok(existe(a.href), a.href);
      for (const s of a.subabas ?? []) assert.ok(existe(s.href), s.href);
    }
    for (const i of itensDaConta(papel, { temImovel: true, admin: true }).filter((i) => !i.acao)) assert.ok(existe(i.href), i.href);
  }
});

test("Conta (avatar): Ferramentas fora; troca de modo e Sair como ações; quem nunca anunciou vê 'Anunciar meu imóvel'", () => {
  const dono = itensDaConta("proprietario", { temImovel: true, admin: false }).map((i) => i.rotulo);
  assert.ok(!dono.includes("Ferramentas"));
  assert.ok(dono.includes("Modo morador"));
  assert.ok(itensDaConta("morador", { temImovel: true, admin: false }).some((i) => i.acao === "modo-proprietario"));
  assert.ok(itensDaConta("morador", { temImovel: false, admin: false }).some((i) => i.id === "anunciar"));
  for (const papel of PAPEIS) assert.equal(itensDaConta(papel, { temImovel: false, admin: false }).at(-1)?.acao, "sair");
  assert.ok(itensDaConta("morador", { temImovel: false, admin: true }).some((i) => i.href === "/admin"));
});
