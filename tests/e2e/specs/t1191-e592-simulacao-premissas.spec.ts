import { test, expect, type Page } from "@playwright/test";

/*
  T1191 — E592/E594 (Frente B): a /simulacao dos sócios projeta com o modelo validado — aluguel médio de R$ 3.000 e taxa
  média de 10% — e mostra as lacunas de custo (o que ainda não tem preço) num quadro próprio. 390 e 1280 px, com o código
  dos sócios. Só leitura: nenhuma escrita, nenhuma chave alterada.
*/
const limpo = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

test.describe("T1191 — E592/E594: /simulacao com o modelo validado e as lacunas de custo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — aluguel médio R$ 3.000, taxa média 10% e o quadro das lacunas`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: 900 });
      await entrarComoSocio(page, "/simulacao");

      const corpo = limpo(await page.locator("body").innerText());
      // Receita do modelo validado (o texto do "Como calculamos" lê a mesma fonte da conta).
      expect(corpo).toMatch(/aluguel médio de R\$ 3\.000/);
      expect(corpo).toMatch(/Taxa média do modelo validado: 10%/);
      expect(corpo).not.toMatch(/R\$ 4\.320/);
      expect(corpo).not.toMatch(/Taxa média ponderada/);

      // Lacunas de custo: o quadro existe e lista o que ainda não tem preço.
      const lacunas = page.getByTestId("lacunas-custo");
      await expect(lacunas).toBeVisible();
      await expect(lacunas).toContainText("Lacunas de custo (ainda sem preço)");
      for (const item of ["Emissor de NFS-e", "Alvará de funcionamento", "Antifraude", "Identidade", "WhatsApp"]) {
        await expect(lacunas, item).toContainText(item);
      }
      await expect(lacunas).toContainText(/hipótese/);

      // Sem rolagem lateral no celular nem no computador.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await lacunas.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t1191-simulacao-lacunas-${largura}.png` });
    });
  }
});
