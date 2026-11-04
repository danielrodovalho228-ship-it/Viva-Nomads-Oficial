import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T848 — E557: na Revisão do cadastro, "Tudo certo para publicar" só aparece com o "Publicar anúncio" HABILITADO.
  Cenário do QA: Passos 1 a 9 completos (todos ✓) e 1 coisa faltando fora da lista (aqui, o aceite do texto) — antes o
  título dizia "Tudo certo para publicar" ao lado do botão travado. Agora, travado, o título diz o que falta; com o
  aceite marcado, o botão libera e o título vira "Tudo certo para publicar". 1280 e 390. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e557.${sufixo}@lab.vivanomads.test`, nome: "Rita Revisão", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T848 — E557: 'Tudo certo' só com o Publicar liberado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Apartamento Revisão ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura}px: travado diz o que falta; liberado diz 'Tudo certo para publicar'`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "revisao", 30_000);

      const titulo = page.locator("#lista-conferencia-titulo");
      const publicar = page.locator('[data-testid="publicar-anuncio"]:visible').first();
      const caixa = page.getByTestId("aceite-ia").getByRole("checkbox");
      await expect(caixa).toBeVisible({ timeout: 20_000 });
      if (await caixa.isChecked()) await caixa.uncheck();

      // Travado (falta o aceite), com os Passos 1 a 9 todos ✓: nunca "tudo certo".
      await expect(page.getByTestId("lista-conferencia")).toHaveAttribute("data-faltam", "0", { timeout: 20_000 });
      await expect(publicar).toBeDisabled();
      await expect(titulo).not.toHaveText("Tudo certo para publicar");
      await expect(titulo).toHaveText(/^Falta/);
      await page.getByTestId("lista-conferencia").screenshot({ path: `tests/laboratorio/saida/t848-travado-${largura}.png` });

      // Liberado: o mesmo título vira "Tudo certo para publicar".
      await caixa.check();
      await expect(publicar).toBeEnabled({ timeout: 20_000 });
      await expect(titulo).toHaveText("Tudo certo para publicar");
      await page.getByTestId("lista-conferencia").screenshot({ path: `tests/laboratorio/saida/t848-liberado-${largura}.png` });
      await page.context().close();
    });
  }
});
