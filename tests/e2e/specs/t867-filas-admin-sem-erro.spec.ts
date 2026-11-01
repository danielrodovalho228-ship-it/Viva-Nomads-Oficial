import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T867 — FILAS DO ADMIN ABREM, SEM A TELA DE ERRO (Pista C, 01/11; merges #1876, #1880 e #1882, "Erros, achados nº 16 a 18").
  As filas passaram a ser lidas com `exigir`: uma FALHA do banco lança e o admin vê "Não conseguimos abrir esta tela do
  admin" (admin-erro) em vez de "fila vazia" / "Nada pendente":
   - #1876: /admin/documentos (listDocumentosPendentes e listMatriculasFila);
   - #1880: /admin/atendimento (filaAtendimento, fila e aprovações) e /admin/fotos-perfil (filaFotosPerfil);
   - #1882: /admin/parceiros (a fila de cadastros e de pedidos de parceria).
  A falha do banco é do servidor e tem teste de unidade em cada merge. Aqui, o lado que a troca poderia quebrar, sem
  falha nenhuma: com a sessão de admin do laboratório, cada tela abre (HTTP abaixo de 400, o título visível; em
  Documentos, as abas), vazia ou com itens, nunca na tela de erro. A 390 e 1280 px.
*/
const TELAS: { rota: string; merge: string; marca?: string }[] = [
  { rota: "/admin/documentos", merge: "#1876", marca: "documentos-aba-fila" },
  { rota: "/admin/atendimento", merge: "#1880" },
  { rota: "/admin/fotos-perfil", merge: "#1880" },
  { rota: "/admin/parceiros", merge: "#1882", marca: "admin-parceiros-tipos" },
];

for (const largura of [390, 1280] as const) {
  test(`T867 — filas do admin abrem, sem a tela de erro (#1876, #1880, #1882) @${largura}`, async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    for (const t of TELAS) {
      await test.step(`${t.rota} (${t.merge})`, async () => {
        const r = await page.goto(t.rota, { waitUntil: "domcontentloaded" });
        expect(r?.status(), `${t.rota} HTTP`).toBeLessThan(400);
        if (t.marca) await expect(page.getByTestId(t.marca)).toBeVisible({ timeout: 30_000 });
        else await expect(page.locator("main h1, h1").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("admin-erro"), `${t.rota}: a tela do admin não pode cair no erro`).toHaveCount(0);
      });
    }
    await ctx.close();
  });
}
