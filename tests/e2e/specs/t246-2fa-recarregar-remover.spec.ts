import { test, expect } from "@playwright/test";
import { gerarCodigoTotp } from "../fixtures/totp";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T246 — 2FA: recarregar não troca o QR e remover pede confirmação (ordem 7f8448c0, do PR #425):
 * abrir e recarregar /dashboard/conta/seguranca mostra a MESMA chave e não cria fator novo;
 * "Remover verificação" pede confirmação, "Cancelar" não remove nada e não cria fator novo.
 * Conta NOVA, só deste spec: a persona "proprietario" é compartilhada com t58 (que ativa/remove o 2FA em paralelo).
 */
const senha = novaSenha();
const dono = { email: `dono.2fa.recarga.${novoSufixo()}@lab.vivanomads.test`, nome: "Rita Recarga Duas Etapas", role: "owner" as const };
let donoId: string | undefined;

async function fatores(): Promise<{ id: string; status: string }[]> {
  const { data } = await adm().auth.admin.mfa.listFactors({ userId: donoId! });
  return (data?.factors ?? []).map((f) => ({ id: f.id, status: f.status }));
}

test.describe.configure({ mode: "serial" });

test.describe("T246 — 2FA recarregar e remover (390px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ viewport: { width: 390, height: 800 } });

  test.beforeAll(async () => {
    donoId = await criarConta(dono, senha, true);
  });
  test.afterAll(async () => {
    await apagarContas([donoId]);
  });

  test("recarregar a tela mantém a mesma chave e não cria fator novo; remover pede confirmação", async ({ browser }) => {
    test.setTimeout(150000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/conta/seguranca");
    await page.getByRole("button", { name: /Ativar duas etapas/ }).click({ timeout: 15000 });
    await expect(page.getByTestId("chave-2fa")).toBeVisible({ timeout: 15000 });
    const chave1 = ((await page.getByTestId("chave-2fa").textContent()) ?? "").replace(/\s/g, "");
    expect(chave1).toMatch(/^[A-Z2-7]+$/);
    const antes = await fatores();
    expect(antes).toHaveLength(1);

    // Recarrega (mesma aba): a chave pendente é reaproveitada, sem enroll novo.
    await page.reload();
    await expect(page.getByTestId("chave-2fa")).toBeVisible({ timeout: 15000 });
    const chave2 = ((await page.getByTestId("chave-2fa").textContent()) ?? "").replace(/\s/g, "");
    expect(chave2).toBe(chave1);
    expect(await fatores()).toEqual(antes);

    // Ativa e confere que remover pede confirmação; Cancelar não remove nem cria fator.
    await page.locator("#codigo-ativar").fill(gerarCodigoTotp(chave1));
    await page.getByRole("button", { name: "Confirmar código e ativar" }).click();
    const remover = page.getByRole("button", { name: "Remover verificação" });
    await expect(remover).toBeVisible({ timeout: 15000 });
    await remover.click();
    await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).first().click();
    await expect(remover).toBeVisible();
    const depois = await fatores();
    expect(depois).toHaveLength(1);
    expect(depois[0].status).toBe("verified");
    expect(depois[0].id).toBe(antes[0].id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
