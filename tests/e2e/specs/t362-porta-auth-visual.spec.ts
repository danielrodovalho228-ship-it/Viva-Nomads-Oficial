import { test, expect, type Page } from "@playwright/test";

/**
 * T362 — porta de entrada (/auth): alinhamento visual com os mockups aprovados (23/10). Só aparência.
 *   1. a foto da esquerda sem o véu escuro por cima de tudo: só degradês no topo e na base, e o título branco legível;
 *   2. o primário na família do verde da casa em todos os estados: habilitado (verde da marca), esperando (o mesmo verde
 *      a 75%, nunca o sálvia lavado do opacity-50) e carregando (verde cheio) — também na tela do código;
 *   3. o formulário num cartão branco sobre o fundo areia, com o logo em cima no celular;
 *   prints a 390 e 1280 (FASE=antes|depois). Nenhum texto, campo ou fluxo muda (os mesmos textos estão na tela).
 */
const SAIDA = "tests/laboratorio/saida";
const FASE = process.env.T362_FASE ?? "depois";
const VERDE = "rgb(28, 107, 58)";

/** Cor de fundo do botão com o estado forçado (desabilitado e/ou carregando), sem mexer no fluxo. */
async function corNoEstado(page: Page, testId: string, estado: { disabled: boolean; busy: boolean }) {
  return page.getByTestId(testId).evaluate((el, e) => {
    const b = el as HTMLButtonElement;
    // Sem a transição de 150 ms da base: lê a cor final do estado, não um quadro no meio da troca.
    b.style.transition = "none";
    b.disabled = e.disabled;
    b.setAttribute("aria-busy", String(e.busy));
    const cs = getComputedStyle(b);
    return { fundo: cs.backgroundColor, opacidade: cs.opacity, texto: cs.color };
  }, estado);
}

for (const w of [1280, 390]) {
  test.describe(`T362 — porta do auth a ${w} px`, () => {
    test.use({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });

    test(`prints (${FASE})`, async ({ page }) => {
      await page.goto("/auth", { waitUntil: "networkidle" });
      await page.screenshot({ path: `${SAIDA}/t362-${FASE}-auth-${w}.png`, fullPage: true });
      await page.getByTestId("entrar-com-senha").click();
      await page.screenshot({ path: `${SAIDA}/t362-${FASE}-auth-senha-${w}.png`, fullPage: true });
    });

    test("véu claro, estados do primário e formulário em cartão", async ({ page }) => {
      test.skip(FASE === "antes", "Na fase 'antes' só os prints.");
      await page.goto("/auth", { waitUntil: "networkidle" });
      // Textos da porta: os mesmos de antes.
      await expect(page.getByRole("heading", { name: "Entre ou crie sua conta" })).toBeVisible();
      await expect(page.getByTestId("entrada-continuar")).toBeVisible();

      // 3. Cartão branco sobre areia.
      const cartao = page.getByTestId("porta-cartao");
      await expect(cartao).toBeVisible();
      expect(await cartao.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await page.getByTestId("porta-formulario").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(247, 242, 234)");
      expect(await cartao.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");

      // 2. Estados do primário.
      const hab = await corNoEstado(page, "entrada-continuar", { disabled: false, busy: false });
      expect(hab.fundo).toBe(VERDE);
      const esperando = await corNoEstado(page, "entrada-continuar", { disabled: true, busy: false });
      expect(esperando.opacidade).toBe("1");
      // O verde da marca a 75% (oklab/rgba conforme o navegador) — nunca o botão inteiro a 50%.
      expect(esperando.fundo).toMatch(/rgba\(28, 107, 58, 0\.75\)|oklab|color-mix/);
      expect(esperando.texto).toBe("rgb(255, 255, 255)");
      const carregando = await corNoEstado(page, "entrada-continuar", { disabled: true, busy: true });
      expect(carregando.fundo).toBe(VERDE);
      expect(carregando.opacidade).toBe("1");

      // 1. Foto: sem véu escuro cheio; degradês no topo e na base (só no computador, onde a foto aparece).
      if (w === 1280) {
        await expect(page.getByTestId("porta-veu-topo")).toHaveCount(1);
        await expect(page.getByTestId("porta-veu-base")).toHaveCount(1);
        const cheios = await page.locator(".lg\\:block .absolute.inset-0").evaluateAll((els) =>
          els.filter((e) => /rgba?\(/.test(getComputedStyle(e).backgroundColor) && getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)").length,
        );
        expect(cheios, "nenhuma camada escura cobrindo a foto inteira").toBe(0);
        const titulo = page.getByRole("heading", { level: 1 });
        await expect(titulo).toBeVisible();
        expect(await titulo.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
      } else {
        await expect(page.getByTestId("porta-formulario").locator("[data-logo]")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
