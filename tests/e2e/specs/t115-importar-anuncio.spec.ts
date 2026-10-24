import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/**
 * T115 — Importar meu anúncio (ordem 4c178768, Pacote FF 3/3): o dono cola o texto do próprio anúncio,
 * confere o que foi organizado e aplica; telefone colado não vai para a descrição. 390 px.
 */
test.describe("T115 — Importar meu anúncio", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("cola, confere, aplica e o cadastro recebe os campos", async ({ page }) => {
    // Abre direto no passo Endereço (?etapa=endereco, o 3º dos 10), onde fica o atalho de importar. Não depende do token
    // no localStorage nem de rascunho local.
    await page.goto("/dashboard/imoveis/novo?etapa=endereco", { waitUntil: "domcontentloaded" });
    const abrir = page.getByTestId("importar-abrir");
    const continuar = page.getByTestId("rascunho-continuar");
    // Com rascunho no servidor a tela oferece "Continuar": reabre o rascunho já no passo Endereço.
    await expect(abrir.or(continuar)).toBeVisible({ timeout: 30_000 });
    const tinhaRascunho = await continuar.isVisible();
    if (tinhaRascunho) {
      await continuar.click();
      await page.waitForURL(/draft=/, { timeout: 15_000 });
      await page.goto(`${page.url()}&etapa=endereco`, { waitUntil: "domcontentloaded" });
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
    // 10 passos: o atalho leva ao passo 4, "Detalhes do imóvel", já preenchido; título e descrição ficam no passo 7.
    await noPasso(page, "detalhes");
    await expect(page.getByTestId("cadastro-quartos")).toHaveValue("2");
    await expect(page.getByTestId("cadastro-banheiros")).toHaveValue("1");
    await expect(page.getByTestId("cadastro-area")).toHaveValue("65");
    // O rascunho salvo guarda o resto: reabre no passo "Título e descrição" e confere os dois.
    await expect(page).toHaveURL(/draft=/, { timeout: 20_000 });
    const draft = new URL(page.url()).searchParams.get("draft");
    await page.waitForTimeout(3_000); // passa o debounce do autosave
    await expect(async () => {
      await page.goto(`/dashboard/imoveis/novo?draft=${draft}&etapa=descricao`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "descricao", 10_000);
      await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Apartamento mobiliado no Santa Mônica", { timeout: 5_000 });
    }).toPass({ timeout: 45_000, intervals: [2_000, 3_000] });
    await expect(page.getByTestId("cadastro-descricao")).not.toHaveValue(/99999/);
    // O rascunho criado aqui não fica na conta compartilhada (o t40 conta com "sem imóvel" para /qualificar).
    if (NO_LABORATORIO && draft && !tinhaRascunho) await adm().from("properties").delete().eq("id", draft).eq("status", "draft");

    // Sem rolagem lateral a 390 px.
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(largura).toBeLessThanOrEqual(0);
  });
});
