// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T429 — E146 (levantamento do Daniel, 25/10; correção na Pista A). Passo 5, Comodidades: o contador "N de M itens
  essenciais" do grupo bate com os chips essenciais marcados — na chegada (2 marcados no rascunho) e a cada toque.
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t429.${sufixo}@lab.vivanomads.test`, nome: "Elisa Essenciais", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

async function conferir(page: Page, rotulo: string) {
  const grupo = page.getByTestId("pronto-trabalhar");
  const essenciais = grupo.locator("button", { hasText: "· essencial" });
  const marcados = await grupo.locator('button[aria-pressed="true"]', { hasText: "· essencial" }).count();
  const total = await essenciais.count();
  const texto = (await page.getByTestId("trabalho-contador").innerText()).trim();
  const m = texto.match(/^(\d+) de (\d+) itens essenciais$/);
  expect(m, `${rotulo}: contador "${texto}"`).not.toBeNull();
  expect([Number(m![1]), Number(m![2])], `${rotulo}: contador "${texto}" contra ${marcados} de ${total} chips essenciais marcados`).toEqual([marcados, total]);
}

test.describe("T429 — E146: o contador de itens essenciais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio dos essenciais ${sufixo}`, { amenityKeys: { home_office: true, internet_fibra: true } });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o contador bate com os chips essenciais marcados, na chegada e a cada toque`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "comodidades", w);
      await expect(page.getByTestId("pronto-trabalhar")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("trabalho-home_office")).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
      await conferir(page, "na chegada");
      for (const chave of ["mesa_trabalho", "cadeira_ergonomica", "home_office"]) {
        const chip = page.getByTestId(`trabalho-${chave}`);
        const antes = await chip.getAttribute("aria-pressed");
        await chip.click();
        await expect(chip).not.toHaveAttribute("aria-pressed", antes ?? "");
        await conferir(page, `depois de tocar em ${chave}`);
      }
      await page.context().close();
    });
  }
});
