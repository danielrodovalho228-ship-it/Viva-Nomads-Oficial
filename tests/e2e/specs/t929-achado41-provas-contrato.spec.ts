import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { lerMassa } from "../fixtures/varredura";

/*
  T929 — achado nº 41 (#2011, Pista B): o pacote de provas do contrato no admin (GET /api/admin/contratos/[id]/provas)
  não sai mais incompleto quando uma leitura falha — a leitura do contrato lança e a rota responde 503 sem gerar o PDF.
  A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR);
  aqui, o caminho NORMAL: com a sessão de admin, o pacote do contrato da massa da varredura sai como PDF de verdade
  (200, application/pdf, começa com %PDF, tamanho > 1 KB) — nunca o 503 da leitura que falhou; sem sessão, 404 (a rota
  não diz se o contrato existe).
*/
const MASSA = lerMassa();

test.describe("T929 — achado nº 41 (#2011): pacote de provas do contrato sai inteiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin e massa da varredura).");

  test("admin baixa o PDF do contrato da massa; visitante recebe 404", async ({ browser, playwright }) => {
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
    const rota = `/api/admin/contratos/${MASSA!.contrato}/provas`;
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const r = await ctx.request.get(rota);
    const corpo = await r.body();
    console.log(`t929|admin|status=${r.status()}|tipo=${r.headers()["content-type"]}|bytes=${corpo.length}`);
    expect(r.status(), "a leitura do contrato funcionou: nada de 503").toBe(200);
    expect(r.headers()["content-type"]).toContain("application/pdf");
    expect(corpo.subarray(0, 4).toString()).toBe("%PDF");
    expect(corpo.length).toBeGreaterThan(1024);
    await ctx.close();

    const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL, storageState: { cookies: [], origins: [] } });
    const a = await anon.get(rota);
    console.log(`t929|visitante|status=${a.status()}`);
    expect(a.status()).toBe(404);
    await anon.dispose();
  });
});
