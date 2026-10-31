import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T800 — #1748 (E257 Parte 2), Pista C, bloco 119. A regra única da descrição dos cartões do assistente: dentro de cada
  grupo de cartões dos Passos 5 (O que o imóvel oferece) e 6 (Regras da casa), ou TODOS têm a descrição curta, ou o
  grupo é só título — nunca um cartão com descrição ao lado de outro sem. Pela tela de verdade, a 390 e a 1280 px, com
  um rascunho novo: cada conjunto de cartões irmãos (`[data-cartao-assistente]` com o mesmo pai) é conferido. O teste de
  unidade do merge confere a fonte (`gruposMistos`); este confere o que a pessoa vê.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t800.${sufixo}@lab.vivanomads.test`, nome: "Dalva Descrição", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T800 — E257 parte 2: em cada grupo de cartões dos Passos 5 e 6, todos com descrição ou nenhum (#1748)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t800 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of [1280, 390] as const) {
    for (const passo of ["comodidades", "regras"] as const) {
      test(`${largura} px, passo ${passo}: nenhum grupo mistura cartão com e sem descrição`, async ({ browser }) => {
        const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, passo, largura);
        await expect(p.locator("[data-cartao-assistente]").first()).toBeVisible({ timeout: 30_000 });
        const grupos = await p.locator("[data-cartao-assistente]").evaluateAll((cartoes) => {
          const porPai = new Map<Element, { rotulo: string; temDescricao: boolean }[]>();
          for (const c of cartoes) {
            if (!(c as HTMLElement).offsetParent) continue;
            const texto = c.querySelector(":scope > span.min-w-0");
            const partes = texto ? Array.from(texto.children) : [];
            const item = { rotulo: (partes[0]?.textContent ?? c.textContent ?? "").trim().slice(0, 40), temDescricao: partes.length > 1 && (partes[1].textContent ?? "").trim().length > 0 };
            const pai = c.parentElement!;
            porPai.set(pai, [...(porPai.get(pai) ?? []), item]);
          }
          return Array.from(porPai.entries()).map(([pai, itens]) => ({ grupo: pai.getAttribute("data-testid") ?? pai.closest("[data-testid]")?.getAttribute("data-testid") ?? "?", itens }));
        });
        expect(grupos.length, "há grupos de cartões no passo").toBeGreaterThan(0);
        const mistos = grupos.filter((g) => g.itens.length > 1 && g.itens.some((i) => i.temDescricao) && g.itens.some((i) => !i.temDescricao));
        expect(mistos, `grupos que misturam cartão com e sem descrição: ${JSON.stringify(mistos)}`).toEqual([]);
        await p.context().close();
      });
    }
  }
});
