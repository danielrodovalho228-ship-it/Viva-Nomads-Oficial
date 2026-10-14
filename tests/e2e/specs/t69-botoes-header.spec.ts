import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T69 — ordem c67e818f: header e botões.
 *  1. Desktop (1280–1920): o logo nunca encosta nos links (≥ 24 px de folga), os
 *     links não encostam nos botões e "Entrar para anunciar" fica numa linha só.
 *  2. Abaixo de 1280 px: menu hambúrguer, sem links espremidos ao lado do logo.
 *  3. Nas páginas públicas, a 360/390/768/1280 px: nenhum botão quebra o texto
 *     nem estoura a caixa ou a tela; todos com cantos de 8 px e semibold; os
 *     preenchidos só no verde-marca (primário) ou branco (secundário/inverso).
 *  4. Foco pelo teclado mostra o anel.
 */
const PRIMARIO = "rgb(28, 107, 58)";
const PAGINAS = ["/", "/buscar", "/como-funciona", "/para-proprietarios", "/precos", "/empresas", "/parceiros", "/pedidos/novo", "/auth"];

async function medirHeader(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const header = document.querySelector("header")!;
    const logo = header.querySelector('a[aria-label="Viva Nomads"]');
    const links = header.querySelector('[data-testid="nav-links"]');
    const acoes = header.querySelector('[data-testid="nav-acoes"]');
    const linksVisiveis = links && getComputedStyle(links).display !== "none";
    const primeiro = links?.querySelector("a, button") ?? null;
    const filhos = linksVisiveis ? Array.from(links!.children).map((c) => c.getBoundingClientRect()) : [];
    const botoes = acoes ? Array.from(acoes.querySelectorAll("a")).map((a) => ({ texto: a.textContent?.trim(), h: a.getBoundingClientRect().height, sobra: a.scrollWidth - a.clientWidth })) : [];
    return {
      linksVisiveis,
      logoDir: r(logo)!.right,
      primeiroEsq: primeiro ? r(primeiro)!.left : null,
      ultimoDir: filhos.length ? Math.max(...filhos.map((f) => f.right)) : null,
      acoesEsq: acoes && getComputedStyle(acoes).display !== "none" ? r(acoes)!.left : null,
      acoesDir: acoes && getComputedStyle(acoes).display !== "none" ? r(acoes)!.right : null,
      botoes,
      larguraTela: window.innerWidth,
      rolagem: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

test.describe("T69 — header e botões padronizados", () => {
  for (const largura of [1280, 1366, 1440, 1920]) {
    test(`header a ${largura}px: logo com folga, links e botões sem encostar nem quebrar`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/", { waitUntil: "networkidle" });
      const m = await medirHeader(page);
      expect(m.linksVisiveis).toBe(true);
      expect(m.primeiroEsq! - m.logoDir, "folga logo → primeiro link").toBeGreaterThanOrEqual(24);
      expect(m.acoesEsq! - m.ultimoDir!, "folga links → botões").toBeGreaterThanOrEqual(16);
      expect(m.acoesDir!).toBeLessThanOrEqual(m.larguraTela);
      expect(m.botoes.map((b) => b.texto)).toContain("Entrar para anunciar");
      for (const b of m.botoes) {
        expect(b.h, `${b.texto} numa linha`).toBeLessThanOrEqual(44);
        expect(b.sobra, `${b.texto} sem estourar`).toBeLessThanOrEqual(0);
      }
      expect(m.rolagem).toBeLessThanOrEqual(1);
      if (largura === 1280) await page.locator("header").first().screenshot({ path: "tests/laboratorio/saida/t69-header-1280.png" });
    });
  }

  test("menu 'Mais' no desktop mostra Como funciona e Parceiros", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator("header").getByRole("button", { name: "Mais" }).click();
    await expect(page.locator("header").getByRole("link", { name: "Como funciona" })).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "Parceiros" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("header").getByRole("link", { name: "Parceiros" })).toHaveCount(0);
  });

  for (const largura of [1024, 1180, 1279]) {
    test(`header a ${largura}px: menu hambúrguer, logo sem nada encostado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/", { waitUntil: "networkidle" });
      const m = await medirHeader(page);
      expect(m.linksVisiveis).toBe(false);
      await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(page.getByRole("link", { name: "Entrar para anunciar" }).last()).toBeVisible();
      expect(m.rolagem).toBeLessThanOrEqual(1);
    });
  }

  for (const largura of [360, 390, 768, 1280]) {
    test(`botões das páginas públicas a ${largura}px: uma linha, sem estourar, mesmo padrão`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: 900 });
      const problemas: string[] = [];
      const estilos = new Set<string>();
      for (const rota of PAGINAS) {
        await page.goto(rota, { waitUntil: "networkidle" });
        // Abre o menu mobile do header (se a página tiver o header público) para medir os botões dele também.
        const menu = page.getByRole("button", { name: "Abrir menu" });
        if (largura < 1280 && (await menu.count())) await menu.first().click();
        const r = await page.evaluate(() => {
          const out: { txt: string; prob?: string; estilo?: string }[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-cta]"))) {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height || getComputedStyle(el).visibility === "hidden") continue;
            const cs = getComputedStyle(el);
            const txt = (el.textContent ?? "").trim().slice(0, 40);
            const linhaUnica = cs.whiteSpace === "nowrap" && b.height <= 60;
            const estoura = el.scrollWidth - el.clientWidth > 1 || b.left < -1 || b.right > window.innerWidth + 1;
            if (!linhaUnica) out.push({ txt, prob: `quebra (h=${Math.round(b.height)})` });
            if (estoura) out.push({ txt, prob: `estoura (sw=${el.scrollWidth} cw=${el.clientWidth} l=${Math.round(b.left)} r=${Math.round(b.right)})` });
            out.push({ txt, estilo: `${cs.backgroundColor}|${cs.borderTopLeftRadius}|${cs.fontWeight}` });
          }
          return out;
        });
        for (const x of r) {
          if (x.prob) problemas.push(`${rota} "${x.txt}": ${x.prob}`);
          if (x.estilo) estilos.add(x.estilo);
        }
      }
      expect(problemas, "botões que quebram/estouram").toEqual([]);
      for (const e of estilos) {
        const [bg, raio, peso] = e.split("|");
        expect(raio, e).toBe("8px");
        expect(peso, e).toBe("600");
        expect([PRIMARIO, "rgb(255, 255, 255)", "rgba(0, 0, 0, 0)"], e).toContain(bg);
      }
      expect([...estilos].some((e) => e.startsWith(PRIMARIO))).toBe(true);
    });
  }

  test("foco pelo teclado mostra o anel no botão primário", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    const cta = page.locator("header").getByRole("link", { name: "Entrar para anunciar" });
    await cta.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    const sombra = await cta.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(sombra).not.toBe("none");
  });

  test("prints: home a 1280 e 390", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.screenshot({ path: "tests/laboratorio/saida/t69-home-1280.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/para-proprietarios", { waitUntil: "networkidle" });
    await page.screenshot({ path: "tests/laboratorio/saida/t69-proprietarios-390.png" });
  });

  test.describe("0ee6d5f6 — header logado: 'Meu painel' com avatar, logo à esquerda e respiro", () => {
    test.use({ storageState: authFile("proprietario") });
    for (const largura of [1280, 1440, 1920]) {
      test(`logado a ${largura}px`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/", { waitUntil: "networkidle" });
        const painel = page.locator("header").getByTestId("nav-meu-painel");
        await expect(painel).toBeVisible({ timeout: 15_000 });
        await expect(painel).toContainText("Meu painel");
        await expect(painel.locator("img, span[aria-hidden]").first(), "avatar (foto ou iniciais)").toBeVisible();
        const m = await medirHeader(page);
        expect(m.logoDir - 0, "logo perto da borda esquerda").toBeLessThanOrEqual(260);
        expect(m.primeiroEsq! - m.logoDir, "folga logo → links").toBeGreaterThanOrEqual(36);
        expect(m.acoesEsq! - m.ultimoDir!, "folga links → ações").toBeGreaterThanOrEqual(24);
        expect(m.acoesDir!).toBeLessThanOrEqual(largura - 30);
        expect(m.rolagem).toBeLessThanOrEqual(1);
        if (largura === 1440) await page.locator("header").first().screenshot({ path: "tests/laboratorio/saida/t69-header-logado-1440.png" });
      });
    }
  });
});
