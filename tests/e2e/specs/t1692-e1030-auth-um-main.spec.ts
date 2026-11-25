import { test, expect } from "@playwright/test";

/*
  T1692 — E1030 (18/11; era o D-V8 da varredura, falha esperada desde 22/10).
  As telas de /auth não tinham <main>: o leitor de tela ficava sem o marco principal. A casca de autenticação
  (src/app/auth/layout.tsx) passa a abri-lo para todas, uma vez.
  Como visitante, a 390 e a 1280 px, cada rota de /auth tem de terminar numa página com UM <main> só: nem zero (o
  defeito), nem dois (HTML inválido, a regra do t311). Uma rota que mande o visitante para outro lugar é conferida no
  destino, e o destino fica escrito na mensagem.
  O t249 ("D-V8 — a tela de entrar tem um <main>") deixa de ser falha esperada no mesmo PR; este cobre as outras telas.
*/
const ROTAS = ["/auth", "/auth?senha=1", "/auth/reset", "/auth/pronto", "/auth/intencao", "/auth/verificar-codigo"];

test.describe("T1692 — E1030: um só <main> em cada tela de /auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    for (const rota of ROTAS) {
      test(`${largura} px — ${rota}: um <main>`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
        expect(resposta?.status() ?? 0, `${rota}: HTTP`).toBeLessThan(400);
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        const destino = new URL(page.url()).pathname + new URL(page.url()).search;
        // Espera a página ter conteúdo antes de contar (a tela de entrar monta o formulário no cliente).
        await expect(page.locator("body")).not.toBeEmpty();
        await expect(page.locator("main"), `${rota} (terminou em ${destino}): quantos <main>`).toHaveCount(1, { timeout: 20_000 });
        // O marco tem de embrulhar o conteúdo, não ser uma caixa vazia ao lado dele.
        expect(await page.locator("main").evaluate((m) => (m as HTMLElement).innerText.trim().length), `${rota} (terminou em ${destino}): <main> sem texto`).toBeGreaterThan(0);
      });
    }
  }
});
