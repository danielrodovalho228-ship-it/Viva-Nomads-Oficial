import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1574 — E725 (#3499): no anúncio, uma estadia ABAIXO da mínima (30 dias, padrão do lab) é inválida — o cartão de preço não calcula nem exibe
  total: fica só o aviso "Estadia mínima de 30 dias." (cartao-lateral-estadia-minima). Com 30 dias o aviso some. Anúncio real do lab,
  calendário de Disponibilidade, 390 e 1280 px, sem estouro. Só no laboratório.
*/
const senha = novaSenha();
const dono = { email: `dono.t1574.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Mínima", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.dono = await criarConta(dono, senha);
  ids.imovel = await criarImovelPronto(ids.dono, "Studio mínimo t1574", { ativo: true, preco: 2800 });
});
test.afterAll(async () => {
  if (NO_LABORATORIO) await apagarContas([ids.dono]);
});

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function escolher(page: Page, dias: number) {
  const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
  await expect(livres.first()).toBeVisible({ timeout: 20_000 });
  const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  const set = new Set(todos);
  const entrada = todos.find((d) => set.has(maisDias(d, dias)));
  expect(entrada, "precisa haver um período livre no calendário").toBeTruthy();
  const saida = maisDias(entrada!, dias);
  await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
  await page.locator(`#disponibilidade button[data-dia="${saida}"]`).click();
  await expect(page.getByTestId("calendario-selecao")).toContainText("→");
}

for (const [w, h] of [[1280, 900], [390, 844]] as const) {
  test.describe(`T1574 — E725 (${w} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test.skip(!NO_LABORATORIO, "Só no laboratório (anúncio real).");

    test("10 dias: só o aviso de estadia mínima, sem total; 30 dias: o aviso some", async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      const cartao = page.locator("#cartao-preco");
      await escolher(page, 10);
      await expect(cartao.getByTestId("cartao-lateral-estadia-minima")).toHaveText(/Estadia mínima de 30 dias\./);
      await expect(cartao.getByTestId("total-junto-da-acao")).toHaveCount(0);
      await expect(cartao.getByTestId("total-mensal")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);

      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      await escolher(page, 30);
      await expect(page.locator("#cartao-preco").getByTestId("cartao-lateral-estadia-minima")).toHaveCount(0);
    });
  });
}
