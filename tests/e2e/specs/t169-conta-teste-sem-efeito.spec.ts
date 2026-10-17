import { test, expect } from "@playwright/test";

/**
 * T169 — Conta de teste sem efeito real (ordem ee7d27b8, itens 1–3), vista de FORA.
 * Sem sessão, as quatro rotas recusam com 401 ANTES de validar o corpo ou tocar Asaas/ZapSign/CAF,
 * e a caixa de e-mails de teste não vaza para quem não é a própria conta de teste.
 * (O desvio is_teste → resultado simulado está provado nos unitários de src/lib/contas-de-teste-efeito.test.ts.)
 */
const CORPO_INVALIDO = { leadId: "nao-e-uuid", termMonths: 99 };

test.describe("T169 rotas de efeito real recusam sem sessão @seguranca", () => {
  for (const rota of ["/api/comissao", "/api/contrato", "/api/caf/verify"]) {
    test(`${rota}: sem login = 401, mesmo com corpo inválido`, async ({ request }) => {
      const r = await request.post(rota, { data: CORPO_INVALIDO });
      expect(r.status(), rota).toBe(401);
    });
  }

  test("/api/conta/caixa-teste: sem login = 401 e sem e-mails no corpo", async ({ request }) => {
    const r = await request.get("/api/conta/caixa-teste");
    expect(r.status()).toBe(401);
    expect(await r.text()).not.toContain("assunto");
  });
});
