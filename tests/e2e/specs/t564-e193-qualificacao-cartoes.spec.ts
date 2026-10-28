import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T564 — E193 (print do Daniel, 25/10): a qualificação usa UM padrão de controle — o cartão grande tocável. Nenhum
  interruptor (switch) nem chip nas 5 telas: sim/não ("Sim, tem" / "Não tem"), as opções com ícone e o "Não tem
  internet" são o mesmo cartão (data-cartao-qualificacao), no computador e no celular.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t564.${sufixo}@lab.vivanomads.test`, nome: "Cris Cartões", role: "owner" as const };
const ids: Record<string, string> = {};

async function semInterruptor(p: Page) {
  const q = p.getByTestId("qualificacao");
  await expect(q.getByRole("switch")).toHaveCount(0);
  await expect(q.locator('[role="switch"], input[type="checkbox"]')).toHaveCount(0);
  const botoes = q.locator("button[aria-pressed]");
  const cartoes = q.locator("button[data-cartao-qualificacao]");
  expect(await botoes.count()).toBeGreaterThan(0);
  expect(await cartoes.count()).toBe(await botoes.count());
}

test.describe("T564 — E193: um padrão só de cartões na qualificação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — as 5 telas só com cartões grandes`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      for (let n = 1; n <= 5; n++) {
        await expect(p.getByTestId("qualificacao-progresso")).toContainText(`${n} de 5`, { timeout: 20_000 });
        await semInterruptor(p);
        if (n === 1) {
          // Sim/não no mesmo cartão das opções: tocar marca, o par troca.
          await p.getByTestId("qualificacao-opcao-cama-sim").click();
          await expect(p.getByTestId("qualificacao-opcao-cama-sim")).toHaveAttribute("aria-pressed", "true");
          await p.getByTestId("qualificacao-opcao-cama-nao").click();
          await expect(p.getByTestId("qualificacao-opcao-cama-sim")).toHaveAttribute("aria-pressed", "false");
          await expect(p.getByTestId("qualificacao-opcao-cama-nao")).toHaveAttribute("aria-pressed", "true");
        }
        if (n === 5) await expect(p.getByTestId("qualificacao-sem-internet")).toHaveAttribute("data-cartao-qualificacao", "");
        await p.screenshot({ path: `${SAIDA}/t564-tela${n}-${largura}.png`, fullPage: true });
        await p.getByTestId("qualificacao-continuar").click();
      }
      await p.context().close();
    });
  }
});
