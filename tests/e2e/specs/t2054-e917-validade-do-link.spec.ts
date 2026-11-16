import { test, expect } from "@playwright/test";

/*
  T2054 — E917 (Pista 3; autorizado pelo Gerente em 16/11) @E917 @ao-vivo-seguro
  Regra: depois de pedir a recuperação de senha, o aviso diz a validade REAL do link — "Ele vale por 10 minutos e só
  funciona uma vez" (a mesma validade do código, mailer_otp_exp).
  Enquadramento do Gerente: cobre SÓ a perna do pedido (o aviso na tela); a chegada do e-mail continua a ser o
  diagnóstico do E917 e este spec não a promete. NADA sai do navegador: o pedido ao Supabase (/auth/v1/…) é respondido
  pelo próprio teste (page.route) — nenhum e-mail é enviado. Onde o captcha está ligado, o pedido não sai sem resolvê-lo:
  o spec diz por que não roda, em vez de fingir.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2054 — E917: o aviso da recuperação diz a validade do link @E917 @ao-vivo-seguro", () => {
  test("pedir a recuperação (sem enviar nada) → o aviso diz 10 minutos e uso único", async ({ page }) => {
    let interceptados = 0;
    // Todo pedido ao Auth do Supabase morre aqui: responde como se tivesse aceitado, sem chegar ao servidor.
    await page.route(/\/auth\/v1\//, async (r) => {
      interceptados++;
      await r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Esqueci minha senha" }).first().click();
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("E-mail").fill("visitante.e917@exemplo.invalid");
    const enviar = page.getByRole("button", { name: "Enviar link de recuperação" });
    test.skip(await enviar.isDisabled(), "O alvo exige captcha: a perna do pedido só se prova sem captcha (prévia ou laboratório).");
    await enviar.click();
    const aviso = page.getByText(/Enviamos um link de recuperação para seu e-mail\./);
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(aviso).toContainText("Ele vale por 10 minutos e só funciona uma vez");
    // Com Supabase configurado, o pedido passou pelo nosso dublê (nunca pelo servidor de e-mail).
    test.info().annotations.push({ type: "pedidos interceptados", description: String(interceptados) });
  });
});
