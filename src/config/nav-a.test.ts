/*
  NAV-A (24/10): a barra verde é a única navegação de trabalho; a Conta é só a pessoa. Cada destino que saiu do menu
  da Conta tem exatamente um caminho na navegação nova. Roda: node --test src/config/nav-a.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MENU_POR_PAPEL, type ItemDoPapel } from "./menu-por-papel.ts";
import { SECOES_CONTA } from "../lib/conta/secoes.ts";
import { LINHAS_AJUDA } from "../lib/conta/ajuda.ts";

function folhas(itens: ItemDoPapel[]): ItemDoPapel[] {
  return itens.flatMap((i) => (i.filhos ? folhas(i.filhos) : i.href ? [i] : []));
}
const barra = MENU_POR_PAPEL.flatMap((s) => folhas(s.itens)).map((i) => i.href!);
const conta = SECOES_CONTA.map((s) => s.href);
const ajuda = LINHAS_AJUDA.map((l) => l.href);
const menuConta = readFileSync(new URL("../components/account/conta-menu.tsx", import.meta.url), "utf8");

// Os destinos do grupo de baixo da Conta antiga (antes do NAV-A), cada um com o lugar novo.
const SAIRAM_PARA_BARRA = ["/dashboard/notificacoes", "/dashboard/verificacao", "/dashboard/ferramentas", "/dashboard/indicacoes", "/admin"];
// ADMIN-1: "Equipe e aprovações" (/admin/agentes#aprovacoes) saiu da barra; vira aba no ADMIN-2.
const SAIRAM_PARA_AJUDA = ["/termos", "/privacidade"];

test("cada rota de trabalho que saiu da Conta tem exatamente um caminho na barra verde e nenhum na Conta", () => {
  for (const r of SAIRAM_PARA_BARRA) {
    assert.equal(barra.filter((h) => h === r).length, 1, r);
    assert.ok(!conta.includes(r), r);
    assert.ok(!menuConta.includes(`"${r}"`), r);
  }
});

test("Termos e Privacidade ficam só na Ajuda da Conta", () => {
  for (const r of SAIRAM_PARA_AJUDA) {
    assert.equal(ajuda.filter((h) => h === r).length, 1, r);
    assert.ok(!barra.includes(r) && !menuConta.includes(`"${r}"`), r);
  }
});

test("ADMIN-1: a seção do papel admin em /dashboard é só 'Painel admin' ('Equipe e aprovações' vira aba no ADMIN-2)", () => {
  const admin = MENU_POR_PAPEL.filter((s) => s.papel === "admin").flatMap((s) => folhas(s.itens));
  assert.deepEqual(admin.map((i) => [i.rotulo, i.href]), [["Painel admin", "/admin"]]);
});

test("a Conta: Perfil, Como você usa a Viva, Avaliações, Dados, Privacidade, Notificações, Pagamentos, Ajuda — e Sair", () => {
  assert.deepEqual(
    SECOES_CONTA.map((s) => s.rotuloMenu ?? s.rotulo),
    ["Perfil", "Como você usa a Viva", "Avaliações", "Dados", "Privacidade", "Notificações", "Pagamentos", "Ajuda"],
  );
  assert.match(menuConta, /itens: \[\{ onClick: sair, label: "Sair"/);
  for (const fora of ["Seus avisos", "Ferramentas", "Painel Admin", "Equipe e aprovações", "Indicações", "Verificação"]) {
    assert.ok(!menuConta.includes(`label: "${fora}"`), fora);
  }
});
