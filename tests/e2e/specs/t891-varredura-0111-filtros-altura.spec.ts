import { test, expect, type Locator } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T891 — #1931 (Pista A, varredura 01/11): filtros com lista e campo de texto na MESMA altura, medidos na tela:
   - Busca de parceiros (/parceiros/buscar, visitante): as listas e os campos de texto com 44 px (antes 40 × 42, rótulos
     2 px desalinhados), a 390 e a 1280; no computador o "Buscar" também com 44 px, na linha dos campos;
   - Admin → Usuários e Admin → Imóveis: os campos do filtro com 40 px (antes 37 × 38), a 1280.
*/
const SAIDA = "tests/laboratorio/saida";

async function alturas(campos: Locator): Promise<{ nome: string; h: number }[]> {
  return campos.evaluateAll((els) =>
    (els as HTMLElement[])
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ nome: `${e.tagName.toLowerCase()}[name=${e.getAttribute("name")}]`, h: Math.round(e.getBoundingClientRect().height * 10) / 10 })),
  );
}

function todosCom(lista: { nome: string; h: number }[], alvo: number, onde: string) {
  expect(lista.length, `${onde}: há campos de filtro`).toBeGreaterThan(1);
  for (const c of lista) expect(Math.abs(c.h - alvo), `${onde}: ${c.nome} com ${alvo} px (mediu ${c.h})`).toBeLessThanOrEqual(0.5);
}

const CAMPOS = 'select, input:not([type="hidden"]):not([type="checkbox"])';

for (const largura of [390, 1280] as const) {
  test(`T891 — busca de parceiros: listas e campos com 44 px (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("busca-parceiros-filtros");
    await expect(form).toBeVisible({ timeout: 30_000 });
    const lista = await alturas(form.locator(CAMPOS));
    todosCom(lista, 44, `busca de parceiros @${largura}`);
    if (largura === 1280) {
      const b = await page.getByTestId("busca-parceiros-buscar").boundingBox();
      expect(Math.abs((b?.height ?? 0) - 44), `Buscar com 44 px no computador (mediu ${b?.height})`).toBeLessThanOrEqual(0.5);
      // Na mesma linha dos campos: o pé do botão no pé do último campo.
      const cep = await form.locator('input[name="cep"]').boundingBox();
      expect(Math.abs((b!.y + b!.height) - (cep!.y + cep!.height)), "Buscar alinhado ao pé dos campos").toBeLessThanOrEqual(1);
    }
    await form.screenshot({ path: `${SAIDA}/t891-busca-parceiros-${largura}.png` });
  });
}

test.describe("T891 — admin: filtros de Usuários e Imóveis com 40 px (1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");
  for (const [rota, onde] of [["/admin/usuarios", "Admin → Usuários"], ["/admin/imoveis", "Admin → Imóveis"]] as const) {
    test(`${onde}: os campos do filtro com 40 px`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const form = page.locator('form[method="get"]').filter({ has: page.locator("select") }).first();
      await expect(form).toBeVisible({ timeout: 30_000 });
      todosCom(await alturas(form.locator(CAMPOS)), 40, onde);
      await form.screenshot({ path: `${SAIDA}/t891-${rota.split("/").pop()}-1280.png` });
      await ctx.close();
    });
  }
});
