import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1573 — E707 (#3297): composição dos prazos da caução atrás da chave CAUCAO_PRAZOS_ATIVA (desligada). O simulador de reembolso de
  /dashboard/reembolsos (com o campo "Data do check-out" quando a trava liga) é só do MODO DEMONSTRAÇÃO: conta real vê o estado honesto
  ("A devolução da caução fica no contrato"), sem simulador, sem campo de check-out e sem prazo fictício — e isso vale com a chave desligada.
  390 e 1280 px, sem estouro. O cálculo dos prazos (check-out confirmado + 30 dias, devolução devida de imediato) está nos testes de unidade
  do PR. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1573.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1573 — E707: reembolso da caução com a trava dos prazos desligada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: conta real vê o estado honesto, sem simulador, sem campo de check-out e sem prazo fictício`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/reembolsos", { waitUntil: "domcontentloaded" });
      await expect(p.getByText("A devolução da caução fica no contrato")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("reembolso-checkout")).toHaveCount(0);
      await expect(p.getByText(/Prazo limite de devolução/i)).toHaveCount(0);
      await expect(p.getByText(/Descontos comprovados/i)).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
