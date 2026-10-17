import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T115 — Importar meu anúncio (ordem 4c178768, Pacote FF 3/3): o dono cola o texto do próprio anúncio,
 * confere o que foi organizado e aplica; telefone colado não vai para a descrição. 390 px.
 */
test.describe("T115 — Importar meu anúncio", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("cola, confere, aplica e o cadastro recebe os campos", async ({ page }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    // Abre a etapa "Tipo" pelo rascunho local (mesma chave que a tela usa).
    await page.evaluate(() => {
      const bruto = Object.entries(localStorage).find(([k]) => /^sb-.*-auth-token$/.test(k))?.[1];
      const id = bruto ? JSON.parse(bruto)?.user?.id : null;
      if (id) localStorage.setItem(`vivanomads-novo-draft:${id}`, JSON.stringify({ step: 0 }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    // A tela decide sozinha: sem rascunho no servidor aplica o local (abre em "Tipo"); com rascunho oferece
    // "Continuar". Espera um dos dois (não adivinha por isVisible) e, no 2º caso, reabre o rascunho já na etapa 0.
    const abrir = page.getByTestId("importar-abrir");
    const continuar = page.getByTestId("rascunho-continuar");
    await expect(abrir.or(continuar)).toBeVisible({ timeout: 30_000 });
    if (await continuar.isVisible()) {
      await continuar.click();
      await page.waitForURL(/draft=/, { timeout: 15_000 });
      await page.goto(`${page.url()}&etapa=0`, { waitUntil: "domcontentloaded" });
    }

    // Sem networkidle (estourava os 45 s no lab): repete o clique até a página hidratar e o aviso abrir.
    await expect(async () => {
      await abrir.click({ timeout: 3_000 });
      await expect(page.getByTestId("importar-aviso")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByTestId("importar-aviso")).toContainText("apenas conteúdo que é seu");
    await page.getByTestId("importar-texto").fill(
      "Apartamento mobiliado no Santa Mônica\n2 quartos, 1 banheiro, 65 m², piscina e academia. Aceita pets. Ligue (34) 99999-1234."
    );
    await page.getByTestId("importar-organizar").click();
    const revisao = page.getByTestId("importar-revisao");
    await expect(revisao).toContainText("Apartamento mobiliado no Santa Mônica");
    await expect(revisao).toContainText("65 m²");
    await expect(revisao).toContainText("Removemos telefone");
    await revisao.getByTestId("importar-aplicar").click();
    await expect(page.getByTestId("importar-aplicado")).toBeVisible();

    // Sem rolagem lateral a 390 px.
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(largura).toBeLessThanOrEqual(0);
  });
});
