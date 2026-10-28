import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo, pdf } from "../fixtures/laboratorio";

/*
  T248 — ordem d5b4f72f (F8): "Antes de anunciar" leva ao checklist DAQUELE imóvel e volta ao anúncio.
  1. Dono com rascunho abre Meus imóveis e clica em "Requisitos e selo" (E196) → /qualificar?imovel=<id> (checklist do imóvel).
  2. O dono abre em modo Proprietário (a casca não o redireciona para fora de /qualificar).
  3. "Voltar ao anúncio" reabre o rascunho (?draft=<id>), não um anúncio novo nem a lista. O botão só existe DEPOIS de
     salvar a qualificação (requisitos, documento e convenção), então o spec percorre esse caminho (lab 0c89bd6a:
     clicar sem salvar esperava o botão até estourar os 120 s).
  4. A 390 px, sem rolagem lateral.
*/
test.describe("T248 — Antes de anunciar: ida ao checklist do imóvel e volta ao anúncio", () => {
  test.skip(!NO_LABORATORIO, "cria contas e rascunhos: só no laboratório");
  const ids: string[] = [];
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("390px — Qualificação do rascunho abre o checklist do imóvel e Voltar ao anúncio retoma o rascunho", async ({ browser }) => {
    test.setTimeout(150_000);
    const senha = novaSenha();
    const email = `dono.t248.${novoSufixo()}@lab.vivanomads.test`;
    const donoId = await criarConta({ email, nome: "Dora Qualifica Sobrenome", role: "owner" }, senha);
    ids.push(donoId);
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: donoId, title: "Rascunho do T248", description: "Rascunho de teste do laboratório (T248).", property_type: "Apartamento",
        address: "Santa Mônica", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40,
        min_period_days: 30, max_period_days: 180, monthly_price: 0, status: "draft", draft_data: { title: "Rascunho do T248" },
      })
      .select("id")
      .single();
    if (error) throw error;
    const imovel = data.id as string;

    const page = await entrar(browser, email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    // E196: a página longa (requisitos e selo) tem nome próprio no cartão do rascunho.
    await page.getByTestId("rascunho-requisitos-selo").first().click();
    await page.waitForURL(/\/qualificar\?imovel=/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("imovel")).toBe(imovel);
    await expect(page.getByRole("heading", { name: "Requisitos e selo" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Antes de anunciar").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t248-qualificar-390.png", fullPage: false });

    // O clique pode se perder se a tela hidratar no meio: repete até o item ficar marcado.
    for (const requisito of ["Imóvel mobiliado completo", "Aceita período mínimo de 30 dias", "IPTU em dia", "Condições de habitabilidade (água, luz, gás)", "Proprietário ou procurador legal"]) {
      const item = page.getByRole("checkbox", { name: requisito });
      await expect(async () => {
        if ((await item.getAttribute("aria-checked")) !== "true") await item.click();
        await expect(item).toHaveAttribute("aria-checked", "true", { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
    }
    await page.getByLabel(/Enviar documentação do imóvel/).setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByText("Enviado para conferência")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Sim, permite" }).click();
    const salvar = page.getByTestId("qualificacao-salvar");
    await expect(salvar).toBeEnabled({ timeout: 10_000 });
    await salvar.click();
    await expect(page.getByText(/Qualificação salva/)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("qualificacao-voltar").click();
    await page.waitForURL(/\/dashboard\/imoveis\/novo\?draft=/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("draft")).toBe(imovel);
    await page.context().close();
  });
});
