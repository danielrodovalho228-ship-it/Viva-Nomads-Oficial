/* Roda: node --test src/lib/conta/e493-ajuda-uma-porta.test.ts — E493: "Ajuda" com UMA porta no painel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECOES_CONTA, SECOES_MENU_CONTA, secaoDaRota } from "./secoes.ts";
import { itensDaConta, HREF_AJUDA_CONTA } from "../../config/abas-painel.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E493: a porta da Ajuda é o 'Ajuda' do menu da Conta (avatar), em todo papel", () => {
  for (const papel of ["proprietario", "morador"] as const) {
    const ajuda = itensDaConta(papel, { temImovel: true }).filter((i) => i.rotulo === "Ajuda");
    assert.equal(ajuda.length, 1);
    assert.equal(ajuda[0].href, HREF_AJUDA_CONTA);
  }
});

test("E493: a lista de seções da Conta (lateral no computador, lista no celular) não repete a Ajuda", () => {
  assert.ok(!SECOES_MENU_CONTA.some((s) => s.id === "ajuda"));
  assert.deepEqual(SECOES_MENU_CONTA.map((s) => s.id), SECOES_CONTA.filter((s) => s.id !== "ajuda").map((s) => s.id));
  // A tela continua existindo, na casca da Conta (título e rota da mesma fonte).
  assert.equal(secaoDaRota("/dashboard/conta/ajuda"), "ajuda");
  assert.match(ler("components/account/casca-conta.tsx"), /\{SECOES_MENU_CONTA\.map\(/);
  assert.doesNotMatch(ler("components/account/casca-conta.tsx"), /\{SECOES_CONTA\.map\(/);
  assert.match(ler("components/account/conta-menu.tsx"), /itens: SECOES_MENU_CONTA\.map\(/);
});
