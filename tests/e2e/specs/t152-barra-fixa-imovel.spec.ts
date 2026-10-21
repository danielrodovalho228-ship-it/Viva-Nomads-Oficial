import { test, expect } from "@playwright/test";

/**
 * T152 — Barra fixa do celular na página do imóvel (ordem c9d21980).
 * D1: o link "Caução e taxas no detalhe" aparece inteiro, tem alvo de toque >= 44 px e nada o cobre.
 * D2: a barra mostra sempre o total e a disponibilidade da PRÓPRIA página (ube-005 -> ube-002 -> ube-003,
 *     por link e por voltar/avançar). Chromium 390x844; o WebKit "iPhone 13" entra quando o projeto
 *     webkit-iphone aceitar esta spec (E2E pendente no lab).
 */
const SEQUENCIA = ["ube-005", "ube-002", "ube-003"];

async function conferirBarra(page: import("@playwright/test").Page, id: string) {
  await expect(page).toHaveURL(new RegExp(`/imoveis/${id}`));
  const barra = page.getByTestId("barra-fixa-imovel");
  await expect(barra).toHaveCount(1);
  await expect(barra).toBeVisible();
  const cartao = page.locator("#cartao-preco");
  await expect(barra.getByTestId("barra-total")).toContainText((await cartao.getByTestId("total-por-mes").innerText()).replace(/^Total por mês\s*/, "").trim());
  const status = (await barra.getByTestId("barra-status").innerText()).trim();
  const textoCartao = await cartao.innerText();
  const data = status.match(/a partir de (\d{2}\/\d{2})/)?.[1];
  if (data) expect(textoCartao).toContain(data);
  else expect(textoCartao).toContain("Disponível agora");
}

test.describe("T152 — Barra fixa do imóvel (390 px)", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("D1: link Caução e taxas inteiro, com alvo de 44 px e sem nada por cima", async ({ page }) => {
    test.setTimeout(120_000);
    for (const id of SEQUENCIA) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      const barra = page.getByTestId("barra-fixa-imovel");
      const link = barra.getByTestId("barra-total");
      await expect(link).toContainText("Caução e taxas no detalhe");
      const caixa = (await link.boundingBox())!;
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      const b = (await barra.boundingBox())!;
      expect(caixa.x).toBeGreaterThanOrEqual(b.x);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(b.x + b.width + 1);
      // texto completo: nenhum trecho cortado na horizontal
      const cortado = await link.evaluate((el) => [...el.querySelectorAll("*")].some((n) => n.scrollWidth > n.clientWidth + 1));
      expect(cortado).toBe(false);
      // elementFromPoint no centro do link = o próprio link
      const dono = await link.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!topo && (topo === el || el.contains(topo));
      });
      expect(dono).toBe(true);
      // não encosta no primário "Solicitar" (Prompt 41: Mensagem e Viva ficaram no cartão de preço)
      const msg = (await barra.getByRole("button", { name: "Solicitar", exact: true }).boundingBox())!;
      expect(caixa.y + caixa.height).toBeLessThanOrEqual(msg.y);
    }
  });

  test("D2: por link, a barra é sempre a do próprio imóvel", async ({ page }) => {
    test.setTimeout(120_000);
    for (const id of SEQUENCIA) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      await conferirBarra(page, id);
    }
  });

  test("D2: voltar e avançar mantêm a barra do imóvel mostrado", async ({ page }) => {
    test.setTimeout(120_000);
    for (const id of SEQUENCIA) await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
    await page.goBack({ waitUntil: "commit" });
    await conferirBarra(page, SEQUENCIA[1]);
    await page.goBack({ waitUntil: "commit" });
    await conferirBarra(page, SEQUENCIA[0]);
    await page.goForward({ waitUntil: "commit" });
    await conferirBarra(page, SEQUENCIA[1]);
  });
});

test.describe("T152 — desktop 1280 px", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });
  test("a barra não aparece e o cartão de preço segue", async ({ page }) => {
    await page.goto("/imoveis/ube-005", { waitUntil: "networkidle" });
    await expect(page.getByTestId("barra-fixa-imovel")).toBeHidden();
    await expect(page.locator("#cartao-preco").getByTestId("total-por-mes")).toBeVisible();
  });
});
