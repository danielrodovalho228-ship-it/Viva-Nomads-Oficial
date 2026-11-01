import { test, expect } from "@playwright/test";

/*
  T762 — E320 (uso real do Daniel, 31/10): no anúncio de EXEMPLO a visita não é enviada (por desenho), mas a folha não
  pode ser beco sem saída. Antes e depois do "Pedir visita", ela explica como a visita funciona num anúncio real e
  leva aos imóveis reais (/buscar). A 390 e a 1280, vídeo e presencial.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T762 — E320: visita por vídeo no anúncio de exemplo tem explicação e saída (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");

    const abrir = page.getByTestId("visita-video-abrir").first();
    await abrir.scrollIntoViewIfNeeded();
    await expect(async () => {
      await abrir.click({ timeout: 3_000 });
      await expect(page.getByTestId("visita-video-passo")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    const folha = page.getByTestId("visita-video-passo");

    // Antes de pedir: o aviso, o "como funciona" e a saída para os imóveis reais.
    await expect(folha.getByTestId("visita-video-demo")).toContainText("Anúncio de exemplo");
    await expect(folha.getByTestId("visita-video-como-funciona")).toContainText("o proprietário confirma um deles e envia o link da chamada");
    await expect(folha.getByTestId("visita-video-ver-reais")).toHaveAttribute("href", "/buscar");

    // Depois do "Pedir visita" (não é enviado): a folha continua com a explicação e a saída — não só "Fechar".
    await folha.getByTestId("visita-video-horario-0").fill("2030-01-01T10:00");
    await folha.getByTestId("visita-video-enviar").click();
    // Espera o estado de resultado (o formulário sai) antes de conferir.
    await expect(folha.getByTestId("visita-video-enviar")).toHaveCount(0, { timeout: 30_000 });
    await expect(folha.getByTestId("visita-video-horario-0")).toHaveCount(0);
    await expect(folha.getByTestId("visita-video-como-funciona")).toBeVisible({ timeout: 20_000 });
    await expect(folha.getByTestId("visita-video-ver-reais")).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t762-visita-exemplo-${largura}.png` });

    await folha.getByTestId("visita-video-ver-reais").click();
    await expect(page).toHaveURL(/\/buscar/, { timeout: 30_000 });
  });
}
