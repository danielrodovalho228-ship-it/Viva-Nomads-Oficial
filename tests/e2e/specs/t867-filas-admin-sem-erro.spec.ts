import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T867 — FILAS DE DOCUMENTOS E MATRÍCULAS DO ADMIN ABREM, SEM A TELA DE ERRO (Pista C, 01/11; merge #1876, "Erros,
  achado nº 16"). A tela /admin/documentos passou a chamar listDocumentosPendentes e listMatriculasFila com `exigir`:
  uma FALHA do banco lança e o admin vê "Não conseguimos abrir esta tela do admin" (admin-erro) em vez de "fila vazia".
  A falha do banco é do servidor e tem teste de unidade no merge. Aqui, o lado que a troca poderia quebrar, sem falha
  nenhuma: com a sessão de admin do laboratório, a tela abre com as abas e as duas filas (vazias ou não), nunca na tela
  de erro. A 390 e 1280 px.
*/
for (const largura of [390, 1280] as const) {
  test(`T867 — /admin/documentos abre com as filas, sem a tela de erro (#1876) @${largura}`, async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    const r = await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByTestId("documentos-aba-fila")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("admin-erro"), "a tela do admin não pode cair no erro").toHaveCount(0);
    await ctx.close();
  });
}
