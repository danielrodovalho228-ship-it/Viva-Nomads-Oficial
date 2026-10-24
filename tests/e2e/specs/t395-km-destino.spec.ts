import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T395 — E79: com destino ativo (aqui, um local pessoal achado pelo endereço — OSM simulado no laboratório), cada
  cartão mostra a distância (linha reta enquanto não houver rota; minutos só com rota real) e nunca fica preso em
  "calculando…"; a página do imóvel mostra a linha do destino da busca no bloco "Tempo até".
*/
test.describe("T395 — E79: km até o destino no cartão e na página do imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (OSM simulado).");
  test.describe.configure({ timeout: 120_000 });

  test("local pessoal: km no cartão e na página do imóvel", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("campo-destino");
    await campo.getByTestId("outro-local-texto").fill("Hospital do Lab E79");
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("destino-digitado")).toBeVisible({ timeout: 20_000 });
    const linhas = page.getByTestId("tempo-cartao");
    await expect(linhas.first()).toBeVisible({ timeout: 30_000 });
    // Depois do cálculo, nenhum cartão fica em "calculando…" e todos dizem o que é.
    await expect.poll(async () => (await linhas.allTextContents()).filter((t) => t.includes("calculando")).length, { timeout: 30_000 }).toBe(0);
    for (const t of await linhas.allTextContents()) assert(t);
    await page.screenshot({ path: "tests/laboratorio/saida/t395-1-cartoes.png", fullPage: true });

    await page.locator('[data-testid="busca-lista"] a[href^="/imoveis/"]').first().click();
    const daBusca = page.locator('[data-testid="tempo-ate-linha"][data-busca="1"]');
    await expect(daBusca).toBeVisible({ timeout: 30_000 });
    await expect(daBusca).toContainText(/linha reta|min de|min a pé|min de bicicleta/);
    await expect(daBusca).toContainText("Hospital do Lab E79");
  });
});

function assert(t: string) {
  // Linha reta dita como tal; minutos só quando o laboratório tem rota (rotas-falso).
  expect(t).toMatch(/em linha reta|min /);
}
