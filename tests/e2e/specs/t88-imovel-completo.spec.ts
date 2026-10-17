import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T88 — ordem d943f893: página do imóvel COMPLETA (computador e celular).
 *  Galeria · abas âncora presas (Visão geral, Comodidades, Disponibilidade, Avaliações,
 *  Proprietário, Localização) · sinais de confiança só com dado real · comodidades ·
 *  calendário · avaliações (estado vazio honesto) · proprietário · mapa aproximado em tela
 *  cheia · barra fixa de preço/contato com status de disponibilidade (celular).
 */
const senha = novaSenha();
const dono = { email: `dono.completo.${novoSufixo()}@lab.vivanomads.test`, nome: "Clara Completa", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function conferirSecoes(page: Page) {
  const nav = page.getByTestId("nav-secoes");
  await expect(nav).toBeVisible();
  // No celular as abas rolam na horizontal: cada uma existe, mesmo fora da faixa visível.
  for (const r of ["Visão geral", "Comodidades", "Disponibilidade", "Avaliações", "Proprietário", "Localização"])
    await expect(nav.getByRole("link", { name: new RegExp(`^${r}`) })).toHaveCount(1);
  for (const id of ["visao-geral", "comodidades", "disponibilidade", "avaliacoes", "proprietario", "localizacao"])
    await expect(page.locator(`#${id}`)).toHaveCount(1);
}

test.describe("T88 — Página do imóvel completa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, "Apartamento completo de teste", { ativo: true, preco: 3100 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("computador: abas presas ao rolar, aba ativa acompanha, sinais de confiança e mapa em tela cheia", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    await conferirSecoes(page);

    const sinais = page.getByTestId("sinais-confianca");
    await expect(sinais).toContainText(/Disponível (agora|a partir de \d{2}\/\d{2})/);
    await expect(sinais).toContainText(/Código VN-[A-Z0-9]{1,6}/);

    // Clicar numa aba leva à seção; a aba fica marcada e presa sob o cabeçalho.
    const nav = page.getByTestId("nav-secoes");
    await nav.getByRole("link", { name: /^Avaliações/ }).click();
    await expect(nav.getByRole("link", { name: /^Avaliações/ })).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("avaliacoes-vazio")).toBeInViewport();
    const caixaNav = (await nav.boundingBox())!;
    expect(Math.round(caixaNav.y), "abas presas logo abaixo do cabeçalho").toBeLessThanOrEqual(80);
    await page.screenshot({ path: "tests/laboratorio/saida/t88-avaliacoes-1440.png" });

    // Cartão de preço lateral não fica por baixo das abas. Medido enquanto a coluna
    // ainda está na tela: ao rolar para além da grade (Localização), o cartão sai junto
    // com ela e y negativo é esperado, não é defeito.
    const cartao = (await page.locator("#cartao-preco").boundingBox())!;
    expect(cartao.y).toBeGreaterThanOrEqual(caixaNav.y + caixaNav.height - 1);

    // Rolar até a localização muda a aba ativa sozinho.
    await page.locator("#localizacao").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(nav.getByRole("link", { name: "Localização" })).toHaveAttribute("aria-current", "true");

    // Mapa aproximado em tela cheia; Esc fecha.
    await page.getByTestId("ampliar-mapa").click();
    const mapa = page.getByTestId("mapa-tela-cheia");
    await expect(mapa).toBeVisible();
    await expect(mapa).toContainText("endereço exato é liberado após o aceite");
    await page.screenshot({ path: "tests/laboratorio/saida/t88-mapa-1440.png" });
    await page.keyboard.press("Escape");
    await expect(mapa).toHaveCount(0);

    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
  });

  for (const largura of [360, 390]) {
    test(`${largura} px: abas roláveis, todas as seções e barra fixa com status`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      await conferirSecoes(page);
      const barra = page.getByTestId("barra-fixa-imovel");
      await expect(barra).toBeVisible();
      await expect(barra.getByTestId("barra-status")).toHaveText(/Disponível (agora|a partir de \d{2}\/\d{2})/);
      await expect(barra).toContainText(/R\$\s?3\.100/);

      await page.getByTestId("nav-secoes").getByRole("link", { name: "Localização" }).click();
      await expect(page.getByTestId("nav-secoes").getByRole("link", { name: "Localização" })).toHaveAttribute("aria-current", "true");
      await expect(page.getByTestId("nav-secoes").getByRole("link", { name: "Localização" })).toBeInViewport();
      await page.getByTestId("ampliar-mapa").click();
      await expect(page.getByTestId("mapa-tela-cheia")).toBeVisible();
      await page.getByRole("button", { name: "Fechar mapa" }).click();
      await expect(page.getByTestId("mapa-tela-cheia")).toHaveCount(0);
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t88-imovel-${largura}.png`, fullPage: false });
    });
  }

  test("anúncio de exemplo: avaliações ilustrativas marcadas (prompt 9) e barra em demonstração", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    await expect(page.getByTestId("nav-secoes")).toBeVisible();
    // Exemplo: avaliações ILUSTRATIVAS, sempre com o selo; nunca o estado vazio nem avaliação "real".
    await expect(page.getByTestId("avaliacoes-exemplo")).toHaveCount(1);
    await expect(page.getByTestId("avaliacoes-exemplo").getByTestId("selo-exemplo")).toHaveText("Exemplo ilustrativo");
    // O exemplo mostra a barra em demonstração (ordem 4f8023d1); nada é enviado.
    await expect(page.getByTestId("barra-fixa-imovel")).toHaveCount(1);
    await expect(page.getByTestId("barra-demo")).toBeVisible();
  });
});
