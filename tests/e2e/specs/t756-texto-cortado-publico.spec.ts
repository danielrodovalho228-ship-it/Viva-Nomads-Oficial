import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T756 — Varredura visual das páginas públicas (31/10), classe "texto cortado":
  (1) cartão de imóvel: o selo ao lado do bairro ("Anúncio de exemplo", "Novo na plataforma", nota) espremia o bairro
      a "San…" no cartão de 2 colunas do celular. Agora o bairro só trunca quando é maior que a linha inteira do
      cartão — o selo desce para a linha de baixo.
  (2) Central de Ajuda: o exemplo do campo de busca das perguntas ("Ex.: caução, senha, anúncio não publica") era
      cortado a 390 px. O exemplo cabe inteiro no campo.
  Guarda nas duas larguras da casa (390 e 1280).
*/
const SAIDA = "tests/laboratorio/saida";

async function abrir(p: Page, rota: string) {
  await p.goto(rota, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Bairros espremidos: cortados embora não ocupem a linha inteira do cartão. */
async function bairrosEspremidos(p: Page) {
  return p.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="cartao-local"]')]
      .filter((h) => h.getBoundingClientRect().width > 0)
      .filter((h) => {
        const linha = h.parentElement!.getBoundingClientRect().width;
        const cortado = h.scrollWidth > h.clientWidth + 1;
        return cortado && h.getBoundingClientRect().width < linha - 1;
      })
      .map((h) => `${h.textContent} (${Math.round(h.getBoundingClientRect().width)}px)`),
  );
}

async function exemploCabeNoCampo(p: Page) {
  return p.evaluate(() => {
    const i = document.querySelector<HTMLInputElement>('input[aria-label="Buscar nas perguntas frequentes"]')!;
    const c = getComputedStyle(i);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
    const texto = ctx.measureText(i.placeholder).width;
    const util = i.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
    return { placeholder: i.placeholder, texto: Math.ceil(texto), util: Math.floor(util) };
  });
}

for (const largura of [390, 1280]) {
  test.describe(`T756 — texto cortado a ${largura} px`, () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    test.describe.configure({ timeout: 120_000 });
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });

    test("cartões de imóvel (início e busca): o bairro não é espremido pelo selo ao lado", async ({ page }) => {
      for (const rota of ["/", "/buscar"]) {
        await abrir(page, rota);
        if (rota === "/buscar") await expect(page.getByTestId("cartao-local").first()).toBeVisible();
        expect(await bairrosEspremidos(page), rota).toEqual([]);
      }
      await page.getByTestId("cartao-imovel").first().screenshot({ path: `${SAIDA}/t756-cartao-${largura}.png` });
    });

    test("Central de Ajuda: o exemplo da busca de perguntas cabe inteiro no campo", async ({ page }) => {
      await abrir(page, "/ajuda/morador");
      const r = await exemploCabeNoCampo(page);
      expect(r.texto, JSON.stringify(r)).toBeLessThanOrEqual(r.util);
    });
  });
}
