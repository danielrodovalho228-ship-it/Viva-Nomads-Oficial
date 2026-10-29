import { test, expect, type Page } from "@playwright/test";

/*
  T659 — E236 (#1524): o Plano Gestor começa em GESTOR_PRECO.minimoImoveis (20) em todo texto público — antes, várias
  telas diziam 31. A faixa de comissão "31 ou mais" dos Termos continua (é a faixa, não o Plano Gestor); o que não pode
  é "Plano Gestor" junto de 31.
    1. /parceiros: "Plano Gestor para quem tem 20 ou mais imóveis."
    2. /modelodenegocio: "Plano Gestor a partir de 20 imóveis".
    3. /precos: "20 imóveis ou mais? Plano Gestor…" e a janela do "Falar sobre o Plano Gestor" com o título
       "Plano Gestor: 20 imóveis ou mais".
    4. /termos: nenhum "Plano Gestor" ao lado de 31.
  390 e 1280 px; sem conta. /modelodenegocio é dos sócios e abre pela porta /acesso-socios (SOCIOS_ACCESS_CODE).
*/
const GESTOR_COM_31 = /Plano Gestor[^.]{0,60}\b31\b|\b31\b[^.]{0,60}Plano Gestor/;

async function textoDe(page: Page, rota: string): Promise<string> {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota}: HTTP`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // /modelodenegocio pode não ter <main>: lê o corpo da página nesse caso.
  const alvo = (await page.locator("main").count()) > 0 ? page.locator("main").first() : page.locator("body");
  return (await alvo.innerText()).replace(/\s+/g, " ");
}

test.describe("T659 — E236: Plano Gestor a partir de 20 imóveis em todo texto público", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — /parceiros, /modelodenegocio, /precos e /termos`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      const parceiros = await textoDe(page, "/parceiros");
      expect(parceiros).toContain("Plano Gestor para quem tem 20 ou mais imóveis");
      expect(parceiros).not.toMatch(GESTOR_COM_31);

      // /modelodenegocio é dos sócios: entra pela porta /acesso-socios com o código do laboratório (sem ele, pula só esta tela).
      const codigo = process.env.SOCIOS_ACCESS_CODE;
      if (codigo) {
        await page.goto(`/acesso-socios?next=${encodeURIComponent("/modelodenegocio")}`, { waitUntil: "domcontentloaded" });
        await page.locator('input[name="codigo"]').fill(codigo);
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page).toHaveURL(/\/modelodenegocio$/);
        const modelo = await textoDe(page, "/modelodenegocio");
        expect(modelo).toContain("Plano Gestor a partir de 20 imóveis");
        // A tabela de faixas da taxa tem a linha "31+ imóveis | Negociado · Plano Gestor": é a faixa sem teto da taxa
        // (outra regra, src/lib/planos/gestor-minimo-textos.test.ts). O "Gestor junto de 31" só vale fora da tabela.
        const semTabela = (
          await page.evaluate(() => {
            const raiz = (document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement;
            raiz.querySelectorAll("table").forEach((t) => t.remove());
            return raiz.textContent ?? "";
          })
        ).replace(/\s+/g, " ");
        expect(semTabela).not.toMatch(GESTOR_COM_31);
      } else {
        test.info().annotations.push({ type: "pulado", description: "SOCIOS_ACCESS_CODE não definido: /modelodenegocio não conferida" });
      }

      const precos = await textoDe(page, "/precos");
      expect(precos).not.toMatch(GESTOR_COM_31);
      const botao = page.getByTestId("plano-gestor-botao").filter({ visible: true }).first();
      await expect(botao).toBeVisible({ timeout: 15_000 });
      await botao.click();
      const janela = page.getByRole("dialog").filter({ hasText: "Plano Gestor" }).first();
      await expect(janela).toContainText("Plano Gestor: 20 imóveis ou mais", { timeout: 10_000 });
      await expect(janela).toContainText("20 imóveis ou mais? Plano Gestor");
      await expect(janela).not.toContainText(/\b31\b/);
      await page.keyboard.press("Escape");

      const termos = await textoDe(page, "/termos");
      expect(termos).not.toMatch(GESTOR_COM_31);
      await page.screenshot({ path: `tests/laboratorio/saida/t659-termos-${largura}.png` });
    });
  }
});
