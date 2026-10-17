import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/** Id do usuário logado lido do cookie de sessão (pode vir em pedaços .0/.1 e com prefixo "base64-"). */
async function idDoUsuarioPeloCookie(context: import("@playwright/test").BrowserContext): Promise<string | null> {
  const partes = (await context.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (!partes.length) return null;
  let bruto = decodeURIComponent(partes.map((c) => c.value).join(""));
  if (bruto.startsWith("base64-")) bruto = Buffer.from(bruto.slice(7), "base64url").toString("utf8");
  try {
    return JSON.parse(bruto)?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * T102 — Preço justo (ordem 4c74ac38, item 1): no passo de preço do cadastro, "Comparar com o Airbnb" mostra
 * o que o dono recebe lá e na Viva e o botão "Usar preço sugerido" preenche o valor mensal. 390 px.
 * Taxa = a da faixa do dono; a conta de teste tem poucos imóveis ativos (faixa de 12%): R$ 10.300 em 2 meses
 * no Airbnb (taxa 16%) → recebe R$ 8.652; preço sugerido R$ 4.916/mês.
 */
test.describe("T102 — Preço sugerido no cadastro", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("compara com o Airbnb e usa o preço sugerido", async ({ page, context }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    // Abre o passo de preço pelo rascunho local (mesma chave que a tela usa: vivanomads-*:<id do usuário>).
    // A sessão (@supabase/ssr) mora em COOKIE, não em localStorage: o id vem do cookie sb-*-auth-token.
    const id = await idDoUsuarioPeloCookie(context);
    expect(id, "id do usuário no cookie de sessão").toBeTruthy();
    await page.evaluate((uid) => localStorage.setItem(`vivanomads-novo-draft:${uid}`, JSON.stringify({ step: 5, monthlyPrice: "" })), id);
    await page.reload({ waitUntil: "networkidle" });
    // Só o "Continuar" do AVISO de rascunho: o "Continuar" do rodapé do cadastro também casaria com a regex
    // e avançaria de etapa em vez de abrir ?draft=<id> (o waitForURL abaixo esperava até o teste estourar 45 s).
    const retomar = page.getByText("Você tem um anúncio em andamento").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").getByRole("button", { name: "Continuar" });
    const bloco = page.getByTestId("preco-sugerido");
    // O aviso de rascunho chega depois do networkidle (consulta assíncrona): espera o aviso OU o bloco do preço
    // (conta sem rascunho no servidor abre direto pelo rascunho local) em vez de decidir na hora.
    // Se nenhum dos dois aparecer, o erro diz ONDE a página está (URL e começo do texto), para o lab apontar a causa.
    await retomar.or(bloco).first().waitFor({ state: "visible", timeout: 30000 }).catch(async (e) => {
      const texto = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`t102: nem o aviso do rascunho nem o preço sugerido apareceram. URL: ${page.url()} · texto: ${texto} · ${String(e).slice(0, 120)}`);
    });
    if (await retomar.isVisible()) {
      // Conta com rascunho no servidor: "Continuar" abre ?draft=<id> na etapa gravada lá, não no passo 5.
      // Vai direto ao passo de preço pela URL (?etapa=5), que vale para rascunho do servidor.
      await retomar.click();
      await page.waitForURL(/[?&]draft=/);
      await page.goto(`${page.url()}&etapa=5`, { waitUntil: "networkidle" });
    }
    // Falha alto (nada de skip silencioso): se o passo de preço não abrir, o lab precisa mostrar.
    await expect(bloco).toBeVisible({ timeout: 30000 });
    await bloco.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
    await bloco.getByPlaceholder("10300").fill("10300");
    await expect(page.getByTestId("recebe-airbnb")).toContainText("8.652");
    await expect(bloco).toContainText("4.916");
    await bloco.getByRole("button", { name: "Usar preço sugerido" }).click();
    await expect(page.locator('input[placeholder="3200"]')).toHaveValue("4916");
    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(larguraDoc).toBeLessThanOrEqual(0); // 390 px sem rolagem lateral
    await page.screenshot({ path: "tests/laboratorio/saida/t102-preco-sugerido.png", fullPage: true });
  });
});
