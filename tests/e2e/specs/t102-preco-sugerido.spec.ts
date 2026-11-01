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
 * T102 — Passo de preço do cadastro. Era o "Preço justo" (ordem 4c74ac38, item 1: "Comparar com o Airbnb" e "Usar
 * preço sugerido"); desde o E292-bis ("a Viva só conecta", 31/10) o comparativo do Airbnb saiu: a taxa de 16% e o
 * preço de equivalência eram conta da Viva. Agora a spec prova que o passo abre com o simulador do dono e SEM o
 * comparativo nem o texto "Airbnb". 390 px.
 */
test.describe("T102 — Passo de preço sem o comparativo do Airbnb", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("o passo de preço abre com o simulador e sem o comparativo do Airbnb", async ({ page, context }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    // Abre o passo de preço pelo rascunho local (mesma chave que a tela usa: vivanomads-*:<id do usuário>).
    // A sessão (@supabase/ssr) mora em COOKIE, não em localStorage: o id vem do cookie sb-*-auth-token.
    const id = await idDoUsuarioPeloCookie(context);
    expect(id, "id do usuário no cookie de sessão").toBeTruthy();
    // Rascunho da ordem de 5 etapas (versão 3), passo 3 = Preço: nos 10 passos ele reabre no Preço (DE_5_PARA_10).
    await page.evaluate((uid) => localStorage.setItem(`vivanomads-novo-draft:${uid}`, JSON.stringify({ step: 3, ordemEtapas: 3, monthlyPrice: "" })), id);
    // E180 (#1507): a cópia local nunca se aplica sozinha no "Novo anúncio" (abre na Qualificação), e uma cópia sem conteúdo
    // (só o passo) nem é oferecida no aviso. O link que diz o passo (?etapa=preco) é a retomada explícita: aplica a cópia
    // local e abre o Preço. Com rascunho no servidor, o aviso aparece (data-testid, não classe de estilo).
    await page.goto("/dashboard/imoveis/novo?etapa=preco", { waitUntil: "networkidle" });
    // Só o "Continuar de onde parei" de dentro do aviso (guarda t102-seletor-rascunho), não o "Continuar" do rodapé.
    const retomar = page.getByTestId("rascunho-aviso").filter({ hasText: "Você tem um anúncio em andamento" }).getByTestId("rascunho-continuar");
    const bloco = page.getByTestId("simulador-bolso");
    // O aviso de rascunho chega depois do networkidle (consulta assíncrona): espera o aviso OU o simulador do preço
    // (conta sem rascunho no servidor abre direto pelo rascunho local) em vez de decidir na hora.
    // Se nenhum dos dois aparecer, o erro diz ONDE a página está (URL e começo do texto), para o lab apontar a causa.
    await retomar.or(bloco).first().waitFor({ state: "visible", timeout: 30000 }).catch(async (e) => {
      const texto = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`t102: nem o aviso do rascunho nem o simulador do preço apareceram. URL: ${page.url()} · texto: ${texto} · ${String(e).slice(0, 120)}`);
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
    // E292-bis: nada do comparativo — nem o bloco, nem o botão, nem os números do Airbnb, nem a palavra na etapa.
    await expect(page.getByTestId("preco-sugerido")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Comparar com o Airbnb/ })).toHaveCount(0);
    await expect(page.getByTestId("recebe-airbnb")).toHaveCount(0);
    expect(await page.getByTestId("etapa-preco").innerText()).not.toMatch(/airbnb/i);
    // O simulador segue com os números do dono: o valor mensal digitado entra na conta.
    await page.getByTestId("cadastro-preco").fill("3000");
    await bloco.getByTestId("bolso-meses").fill("2");
    await expect(bloco.getByTestId("bolso-taxa-detalhe")).toContainText("(R$ 3.000 × 2 = R$ 6.000)");
    const larguraDoc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(larguraDoc).toBeLessThanOrEqual(0); // 390 px sem rolagem lateral
    await page.screenshot({ path: "tests/laboratorio/saida/t102-preco-sem-airbnb.png", fullPage: true });
  });
});
