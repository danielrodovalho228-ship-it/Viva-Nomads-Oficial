import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T248 — ordem d5b4f72f (F8) → E196 (fecho): "Antes de anunciar" leva aos requisitos DAQUELE imóvel, dentro do fluxo.
  A antiga página longa (/qualificar) foi absorvida pelo assistente: os requisitos legais e o documento ficam no cartão
  "Antes de publicar" da Revisão (Passo 10).
  1. No cartão do rascunho em Meus imóveis só existe um caminho, "Qualificação" (nada de "Requisitos e selo").
  2. Um link antigo /qualificar?imovel=<id> (e-mail, favorito) abre a Revisão DAQUELE rascunho (?draft=<id>), com o
     "Antes de publicar" — não um anúncio novo nem a lista.
  3. A 390 px, sem rolagem lateral.
*/
test.describe("T248 — Antes de anunciar: o link antigo cai no 'Antes de publicar' do rascunho", () => {
  test.skip(!NO_LABORATORIO, "cria contas e rascunhos: só no laboratório");
  const ids: string[] = [];
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("390px — um botão só no cartão e /qualificar?imovel= abre a Revisão do rascunho", async ({ browser }) => {
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("rascunho-qualificacao").first()).toHaveText("Qualificação", { timeout: 30_000 });
    await expect(page.getByTestId("rascunho-requisitos-selo")).toHaveCount(0);
    await expect(page.getByText("Requisitos e selo")).toHaveCount(0);

    await page.goto(`/qualificar?imovel=${imovel}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/dashboard\/imoveis\/novo\?/, { timeout: 30_000 });
    const u = new URL(page.url());
    expect(u.searchParams.get("draft")).toBe(imovel);
    expect(u.searchParams.get("etapa")).toBe("revisao");
    await noPasso(page, "revisao", 30_000);
    await expect(page.getByTestId("antes-de-publicar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Requisitos e selo" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t248-revisao-390.png", fullPage: false });
    await page.context().close();
  });
});
