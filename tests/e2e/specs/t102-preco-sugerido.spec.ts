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
    // Rascunho da ordem de 5 etapas (versão 3), passo 3 = Preço: nos 10 passos ele reabre no Preço (DE_5_PARA_10).
    await page.evaluate((uid) => localStorage.setItem(`vivanomads-novo-draft:${uid}`, JSON.stringify({ step: 3, ordemEtapas: 3, monthlyPrice: "" })), id);
    await page.reload({ waitUntil: "networkidle" });
    // E180: "Novo anúncio" abre na Qualificação e o aviso do rascunho mora dentro dela (data-testid, não classe de estilo).
    const retomar = page.getByTestId("rascunho-continuar");
    const bloco = page.getByTestId("preco-sugerido");
    // O aviso de rascunho chega depois do networkidle (consulta assíncrona): espera o aviso OU o bloco do preço
    // (conta sem rascunho no servidor abre direto pelo rascunho local) em vez de decidir na hora.
    // Se nenhum dos dois aparecer, o erro diz ONDE a página está (URL e começo do texto), para o lab apontar a causa.
    await retomar.or(bloco).first().waitFor({ state: "visible", timeout: 30000 }).catch(async (e) => {
      const texto = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`t102: nem o aviso do rascunho nem o preço sugerido apareceram. URL: ${page.url()} · texto: ${texto} · ${String(e).slice(0, 120)}`);
    });
    if (await retomar.isVisible()) {
      // Rascunho no servidor: "Continuar" abre ?draft=<id> na etapa gravada lá, não no Preço; vai ao Preço pelo NOME
      // (?etapa=preco). Só com cópia local, o clique aplica o rascunho na própria tela (sem trocar a URL).
      await retomar.click();
      const comServidor = await page.waitForURL(/[?&]draft=/, { timeout: 5000 }).then(() => true, () => false);
      if (comServidor) await page.goto(`${page.url()}&etapa=preco`, { waitUntil: "networkidle" });
    }
    // Falha alto (nada de skip silencioso): se o passo de preço não abrir, o lab precisa mostrar.
    await expect(bloco).toBeVisible({ timeout: 30000 });
    // E140: o comparador usa o período do simulador; aqui, 2 meses (o exemplo de R$ 10.300).
    await page.getByTestId("simulador-bolso").getByTestId("bolso-meses").fill("2");
    await bloco.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
    await bloco.getByPlaceholder("10300").fill("10300");
    await expect(page.getByTestId("recebe-airbnb")).toContainText("8.652");
    await expect(bloco).toContainText("4.916");
    await bloco.getByRole("button", { name: /^Usar R\$\s?4\.916\/mês como valor mensal$/ }).click();
    await expect(page.getByTestId("cadastro-preco")).toHaveValue("4.916");
    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(larguraDoc).toBeLessThanOrEqual(0); // 390 px sem rolagem lateral
    await page.screenshot({ path: "tests/laboratorio/saida/t102-preco-sugerido.png", fullPage: true });
  });
});
