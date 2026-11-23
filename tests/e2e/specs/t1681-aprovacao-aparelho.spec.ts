import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T1681 — Ordem 12a8086d, item 4 (parte 3): a decisão de uma aprovação grava DE QUAL APARELHO veio
  (aprovacoes.decidido_aparelho, migração 0356).
  O QUE ESTA SPEC NÃO FAZ (ORDEM-DUET-558): ela NÃO chega ao código que resume e grava o aparelho. Os casos usam um
  pedido que não existe, e a rota responde 404 antes de o user-agent ser resumido; e um pedido real não pode ser
  decidido aqui (a tabela é imutável depois de decidida e a suíte roda contra o banco). Por isso o caminho do
  aparelho é coberto SÓ na unidade: src/lib/agentes/aparelho-aprovacao.test.ts (o resumo, e a decisão que o grava)
  e tests/migracoes/aprovacoes-aparelho-0356.test.ts (a coluna e o limite).
  O que esta spec guarda, na rota de verdade:
  1) visitante com user-agent de celular continua recusado (401/403/404): nada muda para quem não é admin;
  2) admin decidindo um pedido inexistente, com user-agent de celular ou com lixo, recebe o 404 de sempre, sem 500.
*/
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const LIXO = `Mozilla/5.0 (Linux; Android 14; <script>alert(1)</script> '); drop table x; --) ${"x".repeat(2000)}`;
const INEXISTENTE = "00000000-0000-4000-8000-000000000339";

test.describe("T1681 — aparelho na decisão das aprovações", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

  test("visitante com celular continua recusado", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, userAgent: IPHONE });
    const r = await ctx.request.post(`/api/admin/aprovacoes/${INEXISTENTE}`, { data: { acao: "aprovar", confirmar: true }, failOnStatusCode: false, maxRedirects: 0 });
    expect([401, 403, 404], `→ ${r.status()}`).toContain(r.status());
    await ctx.close();
  });

  for (const [nome, ua] of [["iPhone", IPHONE], ["user-agent com lixo", LIXO]] as const) {
    test(`admin decidindo pedido inexistente (${nome}): 404 limpo, sem 500`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), userAgent: ua });
      const r = await ctx.request.post(`/api/admin/aprovacoes/${INEXISTENTE}`, { data: { acao: "recusar", confirmar: false }, failOnStatusCode: false, maxRedirects: 0 });
      expect(r.status(), await r.text()).toBe(404);
      expect(await r.json()).toEqual({ ok: false, erro: "Pedido não encontrado." });
      await ctx.close();
    });
  }
});
