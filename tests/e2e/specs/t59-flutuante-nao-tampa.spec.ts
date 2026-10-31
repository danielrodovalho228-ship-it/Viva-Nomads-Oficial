import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T59 — F49: o botão flutuante "Fale com a Viva" nunca tampa botão/campo (360/390 px).
 * Para cada botão principal visível (data-cta / submit) e cada campo, o elemento que recebe o
 * clique no centro é o próprio controle (elementFromPoint).
 * Ordem 4f8d17c6: o flutuante é o botão primário do site (ícone + texto, 48 px de altura,
 * cantos de 8 px), igual em todas as páginas; não some ao rolar. Ordem a9982623: posição estável (arrastável), sem subir sozinho; só conferimos o topo e o fim da página.
 * E246 (vigia, 31/10): no CELULAR (< 768 px) o flutuante não aparece em tela nenhuma (um botão fixo sempre sentava
 * sobre texto ao rolar); o "Fale com a Viva" fica no menu ☰ do topo. Do tablet para cima, tudo como antes.
 */
async function nadaTampa(page: Page) {
  const tampados = await page.evaluate(() => {
    const flut = document.querySelector('[data-testid="fale-com-a-viva-raiz"]');
    const alvos = Array.from(document.querySelectorAll<HTMLElement>("[data-cta], button[type=submit], input:not([type=hidden]), textarea, select"));
    const ruins: string[] = [];
    for (const el of alvos) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const topo = document.elementFromPoint(x, y);
      if (flut && topo && flut.contains(topo)) ruins.push((el.textContent || el.getAttribute("name") || el.tagName).trim().slice(0, 40));
    }
    return ruins;
  });
  expect(tampados, "controles tampados pelo botão flutuante").toEqual([]);
}

async function rolarAteOFim(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
}

for (const largura of [360, 390]) {
  test.describe(`T59 — flutuante não tampa (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 800 } });

    test("público: / e /ajuda e /buscar", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      // E246: sem flutuante no celular, nem no topo nem no fim da rolagem; o caminho é o menu ☰ do topo.
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut).toBeHidden();
      await nadaTampa(page);
      await rolarAteOFim(page);
      await expect(flut).toBeHidden();
      await nadaTampa(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId("nav-menu").click();
      await expect(page.getByTestId("nav-menu-lista").getByRole("link", { name: "Fale com a Viva" })).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
      await page.goto("/ajuda", { waitUntil: "networkidle" });
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
      await nadaTampa(page);
      // E95: na /buscar o flutuante não aparece (cobria os cartões); a ajuda fica como link no fim da lista.
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
      await expect(page.getByTestId("buscar-ajuda")).toContainText("Fale com a Viva");
      await nadaTampa(page);
    });

    test("campo em foco e fora dele: o flutuante segue fora do celular (E246; antes, F49 só o tirava durante o foco)", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const campo = page.locator("input:visible, textarea:visible").first();
      await campo.focus();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeHidden();
      await campo.blur();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeHidden();
    });

    test.describe("logado", () => {
      test.use({ storageState: authFile("inquilino") });
      test("/dashboard e Segurança", async ({ page }) => {
        await page.goto("/dashboard", { waitUntil: "networkidle" });
        await nadaTampa(page);
        await rolarAteOFim(page);
        await nadaTampa(page);
        await page.goto("/dashboard/conta/seguranca", { waitUntil: "networkidle" });
        await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
        await nadaTampa(page);
      });

      // Ordem b36ca0ee (D6): no fim da rolagem, o último card do painel fica inteiro fora da área do flutuante.
      for (const rota of ["/dashboard", "/dashboard/locacoes", "/dashboard/solicitacoes"]) {
        test(`${rota}: botão flutuante não cobre o último card`, async ({ page }) => {
          await page.goto(rota, { waitUntil: "networkidle" });
          await rolarAteOFim(page);
          const flut = page.getByTestId("fale-com-a-viva-raiz");
          if ((await flut.count()) === 0 || !(await flut.isVisible())) return; // sem flutuante nesta tela
          // O painel carrega cartões aos poucos (lab 3c9bd126: coberto numa leitura, livre na seguinte): rola ao fim de novo a cada tentativa.
          const cobre = async () => {
            await rolarAteOFim(page);
            return page.evaluate(() => {
              let el: Element | null = document.querySelector("main");
              let ultimo: Element | null = null;
              while (el && el.lastElementChild) {
                el = el.lastElementChild;
                const r = el.getBoundingClientRect();
                if (r.height >= 40 && r.width >= 120) ultimo = el;
              }
              const f = document.querySelector('[data-testid="fale-com-a-viva-raiz"]')!.getBoundingClientRect();
              if (!ultimo) return false;
              const c = ultimo.getBoundingClientRect();
              const sobrepoe = c.left < f.right && c.right > f.left && c.top < f.bottom && c.bottom > f.top;
              return sobrepoe;
            });
          };
          await expect.poll(cobre, { message: "o flutuante cobre o último card", timeout: 10_000, intervals: [500] }).toBe(false);
        });
      }
    });
  });
}

/** Ordem 4f8d17c6: mesmo formato e mesmos tokens do botão primário em todas as páginas e larguras. */
test("4f8d17c6 — flutuante idêntico em /, /precos e /como-funciona a 768 e 1280 px (a 390, E246: não aparece)", async ({ page }) => {
  // 9 páginas (3 larguras × 3 rotas): não cabe nos 45 s padrão. E95: a /buscar saiu (lá o flutuante não aparece).
  test.setTimeout(180_000);
  const estilos = new Set<string>();
  for (const largura of [390, 768, 1280]) {
    await page.setViewportSize({ width: largura, height: 800 });
    for (const rota of ["/", "/precos", "/como-funciona"]) {
      if (largura === 390) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("fale-com-a-viva"), `${rota} a 390px`).toBeHidden();
        continue;
      }
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut, `${rota} a ${largura}px`).toBeVisible();
      await expect(flut).toHaveText("Fale com a Viva");
      estilos.add(
        await flut.evaluate((el) => {
          const cs = getComputedStyle(el);
          return [cs.backgroundColor, cs.color, cs.borderTopLeftRadius, cs.fontWeight, cs.height, cs.boxShadow].join("|");
        })
      );
    }
  }
  expect([...estilos], "um formato só").toHaveLength(1);
  const [bg, cor, raio, peso, altura] = [...estilos][0].split("|");
  expect([bg, cor, raio, peso, altura]).toEqual(["rgb(28, 107, 58)", "rgb(255, 255, 255)", "8px", "600", "48px"]);
});

/**
 * Q4 (iPhone do Daniel, 17/10) → E246 (31/10): na página do imóvel a 390 px o flutuante não aparece (antes, o ícone
 * redondo acima da barra fixa); as estrelas de Avaliações e o texto do total ficam livres em qualquer rolagem.
 */
test("Q4/E246 — /imoveis/ube-001 a 390 px: sem flutuante; Avaliações e o total do mês livres", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
  await expect(page.getByTestId("fale-com-a-viva")).toBeHidden();
  // O total do mês diz "o morador não paga nada à plataforma" (antes, "o inquilino"); Avaliações só existe com nota.
  for (const alvo of [page.locator("#avaliacoes-title").filter({ visible: true }), page.getByText("não paga nada à plataforma", { exact: false }).filter({ visible: true })]) {
    if ((await alvo.count()) === 0) continue;
    await alvo.first().scrollIntoViewIfNeeded();
    await expect(alvo.first()).toBeInViewport();
    await expect(page.getByTestId("fale-com-a-viva")).toBeHidden();
  }
  await nadaTampa(page);
  await page.screenshot({ path: "tests/laboratorio/saida/t59-q4-imovel-390.png" });
});

/** Q3 (iPhone): o campo "Quando quer entrar?" cabe no cartão (como o select do motivo) e, vazio, mostra "dd/mm/aaaa". */
test("Q3 — /imoveis/ube-001 a 390 px: campo de data dentro do cartão e com exemplo de formato", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
  const data = page.getByTestId("candidatura-inicio").first();
  await data.scrollIntoViewIfNeeded();
  const motivo = page.getByTestId("candidatura-motivo").first();
  const [cd, cm] = [(await data.boundingBox())!, (await motivo.boundingBox())!];
  // Mesma largura e alinhamento do select logo abaixo (nada passa da borda).
  expect(Math.abs(cd.x - cm.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(cd.width - cm.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(cd.height - cm.height)).toBeLessThanOrEqual(1);
  // E136: no computador o campo é dd/mm/aaaa com o calendário do site (pt-BR); o exemplo é o placeholder.
  await expect(data).toHaveAttribute("placeholder", "dd/mm/aaaa");
  await data.fill("2030-01-15");
  await expect(data).toHaveValue("15/01/2030");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "tests/laboratorio/saida/t59-q3-data-390.png" });
});
