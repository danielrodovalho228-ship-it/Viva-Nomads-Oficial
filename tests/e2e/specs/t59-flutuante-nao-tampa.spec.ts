import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T59 — F49: o botão flutuante "Fale com a Viva" nunca tampa botão/campo (360/390 px).
 * Para cada botão principal visível (data-cta / submit) e cada campo, o elemento que recebe o
 * clique no centro é o próprio controle (elementFromPoint).
 * Ordem 4f8d17c6: o flutuante é o botão primário do site (ícone + texto, 48 px de altura,
 * cantos de 8 px), igual em todas as páginas; não some ao rolar. Ordem a9982623: posição estável (arrastável), sem subir sozinho; só conferimos o topo e o fim da página.
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
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut).toBeVisible();
      const caixa = await flut.boundingBox();
      expect(Math.round(caixa!.height)).toBe(48);
      await expect(flut).toHaveText("Fale com a Viva");
      await nadaTampa(page);
      await rolarAteOFim(page);
      await expect(flut, "não some ao rolar").toBeVisible();
      await nadaTampa(page);
      await page.goto("/ajuda", { waitUntil: "networkidle" });
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
      await nadaTampa(page);
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await expect(flut).toBeVisible();
      await nadaTampa(page);
      for (const y of [600, 1400, 2600]) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(300);
        await expect(flut, `visível na /buscar após rolar ${y}px`).toBeVisible();
      }
    });

    test("campo em foco esconde o flutuante e ele volta ao sair", async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const campo = page.locator("input:visible, textarea:visible").first();
      await campo.focus();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeHidden();
      await campo.blur();
      await expect(page.getByTestId("fale-com-a-viva-raiz")).toBeVisible();
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
test("4f8d17c6 — flutuante idêntico em /, /buscar, /precos e /como-funciona a 390, 768 e 1280 px", async ({ page }) => {
  // 12 páginas (3 larguras × 4 rotas): não cabe nos 45 s padrão; só o HTML (o "load" de /buscar fica preso no mapa).
  test.setTimeout(180_000);
  const estilos = new Set<string>();
  for (const largura of [390, 768, 1280]) {
    await page.setViewportSize({ width: largura, height: 800 });
    for (const rota of ["/", "/buscar", "/precos", "/como-funciona"]) {
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
 * Q4 (iPhone do Daniel, 17/10): na página do imóvel a 390 px o flutuante vira só o ícone redondo (48 px), acima da
 * barra fixa, e não tampa as estrelas da seção Avaliações nem o texto do total ("o inquilino não paga nada à
 * plataforma") quando a pessoa rola até eles. O nome acessível continua "Fale com a Viva".
 */
test("Q4 — /imoveis/ube-001 a 390 px: ícone redondo, sem tampar Avaliações nem o total do mês", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
  const flut = page.getByTestId("fale-com-a-viva");
  await expect(flut).toBeVisible();
  await expect(flut).toHaveAttribute("aria-label", "Fale com a Viva");
  await expect(flut).toHaveAttribute("data-compacto", "1");
  const caixa = (await flut.boundingBox())!;
  expect(Math.round(caixa.width)).toBeLessThanOrEqual(48);
  expect(Math.round(caixa.height)).toBe(48);
  // Acima da barra fixa (não em cima dela).
  const barra = (await page.locator(".vn-barra-fixa").first().boundingBox())!;
  expect(caixa.y + caixa.height).toBeLessThanOrEqual(barra.y + 1);

  const alvos = [
    page.locator("#avaliacoes-title"),
    page.getByText("o inquilino não paga nada à plataforma", { exact: false }).first(),
  ];
  for (const alvo of alvos) {
    for (const bloco of ["center", "start"] as const) {
      await alvo.evaluate((el, b) => el.scrollIntoView({ block: b }), bloco);
      await page.waitForTimeout(250);
      const tampado = await alvo.evaluate((el) => {
        const flutEl = document.querySelector('[data-testid="fale-com-a-viva-raiz"]');
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of Array.from(range.getClientRects())) {
          for (const x of [r.left + 2, (r.left + r.right) / 2, r.right - 2]) {
            const y = (r.top + r.bottom) / 2;
            if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue;
            const topo = document.elementFromPoint(x, y);
            if (flutEl && topo && flutEl.contains(topo)) return true;
          }
        }
        return false;
      });
      expect(tampado, `flutuante tampa o alvo (scroll ${bloco})`).toBe(false);
    }
  }
  await nadaTampa(page);
  await page.locator("#avaliacoes-title").scrollIntoViewIfNeeded();
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
  const wrap = data.locator("xpath=..");
  await expect(wrap.getByTestId("campo-data-exemplo")).toHaveText("dd/mm/aaaa");
  await data.fill("2030-01-15");
  await expect(wrap.getByTestId("campo-data-exemplo")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "tests/laboratorio/saida/t59-q3-data-390.png" });
});
