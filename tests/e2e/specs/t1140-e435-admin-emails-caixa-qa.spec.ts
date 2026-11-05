import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1140 — E435 reteste (#2553, 05/11): a aba E-mails de Admin → Dados de teste (?aba=emails) passa a ser a MESMA caixa
 * do leitor de QA (CaixaEmailsQa): filtro por conta e por evento e paginação, em vez da lista antiga dos 100 mais
 * recentes. Entrou com os testes de unidade (e435-caixa-teste, qa-leitor); a t116 segue cobrindo a lista em si. Aqui é a
 * tela do admin, 390 e 1280, com dois e-mails de teste de eventos diferentes semeados:
 *   1. a aba mostra a caixa admin-emails-caixa com os filtros de conta e de evento (qa-emails-filtros);
 *   2. filtrar pelo evento A (?aba=emails&evento=A) mostra o e-mail A e esconde o B — o mesmo filtro do leitor de QA.
 */
const sufixo = novoSufixo();
const EVENTO_A = `lab_t1140_a_${sufixo}`;
const EVENTO_B = `lab_t1140_b_${sufixo}`;
const ASSUNTO_A = `Caixa do admin A ${sufixo}`;
const ASSUNTO_B = `Caixa do admin B ${sufixo}`;

test.describe("T1140 — E435: a aba E-mails do admin é a caixa do leitor de QA, com filtro por evento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    const { error } = await adm().from("emails_teste").insert([
      { evento: EVENTO_A, assunto: ASSUNTO_A, corpo: "Corpo do e-mail A.", destinatario_mascarado: "a•••@lab.vivanomads.test" },
      { evento: EVENTO_B, assunto: ASSUNTO_B, corpo: "Corpo do e-mail B.", destinatario_mascarado: "b•••@lab.vivanomads.test" },
    ]);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("emails_teste").delete().in("evento", [EVENTO_A, EVENTO_B]);
  });

  for (const w of [390, 1280] as const) {
    test(`a caixa do QA na aba E-mails, e o filtro por evento separa A de B (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto("/admin/dados-de-teste?aba=emails", { waitUntil: "domcontentloaded" });
        const caixa = page.getByTestId("admin-emails-caixa");
        await expect(caixa).toBeVisible({ timeout: 30_000 });
        await expect(caixa.getByTestId("qa-emails-filtros")).toBeVisible();
        await expect(caixa.getByTestId("qa-emails-conta")).toBeVisible();
        await expect(caixa.getByTestId("qa-emails-evento")).toBeVisible();

        await page.goto(`/admin/dados-de-teste?aba=emails&evento=${encodeURIComponent(EVENTO_A)}`, { waitUntil: "domcontentloaded" });
        const filtrada = page.getByTestId("admin-emails-caixa");
        await expect(filtrada).toContainText(ASSUNTO_A, { timeout: 30_000 });
        await expect(filtrada).not.toContainText(ASSUNTO_B);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
