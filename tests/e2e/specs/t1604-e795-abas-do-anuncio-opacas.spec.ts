import { test, expect } from "@playwright/test";

/*
  T1604 — E795: na página do ube-001 (desktop), a barra fixa de abas não deixa ver o texto que rola por baixo dela
  ("Costuma responder em até 8 horas" aparecia borrado através da barra translúcida), e o salto pela aba "Proprietário"
  para abaixo da barra.
*/
test.describe("T1604 — E795 abas do anúncio opacas", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("barra opaca enquanto a linha do proprietário passa por baixo; a âncora para abaixo da barra", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    const nav = page.getByTestId("nav-secoes");
    await expect(nav).toBeVisible({ timeout: 20_000 });
    const linha = page.getByTestId("faixa-proprietario").getByText(/Costuma responder em até/);
    await expect(linha).toBeVisible();

    // Rola até a linha estar exatamente sob a barra fixa.
    const alvo = await linha.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const barra = await nav.evaluate((el) => ({ top: parseFloat(getComputedStyle(el).top), altura: el.getBoundingClientRect().height }));
    // A página rola com scroll-smooth: rola sem animação para medir no ponto exato.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), alvo - barra.top - barra.altura / 2);
    const medida = await page.evaluate(() => {
      const n = document.querySelector('[data-testid="nav-secoes"]')!;
      const s = getComputedStyle(n);
      const l = [...document.querySelectorAll('[data-testid="faixa-proprietario"] *')].find((e) => /Costuma responder/.test(e.textContent ?? "") && e.children.length === 0)!;
      const a = n.getBoundingClientRect(), b = l.getBoundingClientRect();
      return { fundo: s.backgroundColor, desfoque: s.backdropFilter, sobreposta: b.bottom > a.top && b.top < a.bottom };
    });
    expect(medida.sobreposta, "a linha está sob a barra neste ponto da rolagem").toBe(true);
    // Alfa do fundo (rgb/rgba ou oklab "… / a" do Tailwind 4): 1 = opaco.
    const alfa = (c: string) => { const m = c.match(/\/\s*([\d.]+)\)$/) ?? c.match(/^rgba\([^)]*,\s*([\d.]+)\)$/); return m ? Number(m[1]) : 1; };
    expect(alfa(medida.fundo), `fundo da barra sem transparência (${medida.fundo})`).toBe(1);
    expect(["none", ""]).toContain(medida.desfoque);

    // A âncora da seção "Proprietário" para abaixo da barra.
    await nav.getByRole("link", { name: "Proprietário" }).click();
    await expect
      .poll(() => page.evaluate(() => document.getElementById("proprietario")!.getBoundingClientRect().top - document.querySelector('[data-testid="nav-secoes"]')!.getBoundingClientRect().bottom))
      .toBeGreaterThanOrEqual(0);
  });
});
