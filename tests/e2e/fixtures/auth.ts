import path from "node:path";
import type { Page } from "@playwright/test";
import { account, type Role } from "./accounts";
import { gerarCodigoTotp } from "./totp";

// Ancorado na raiz do repo (a suíte roda a partir dela) — evita import.meta,
// que quebra sob o transpile CJS do Playwright.
const AUTH_DIR = path.join(process.cwd(), "tests", "e2e", ".auth");

/** Caminho do storageState (sessão salva) de um papel — gerado no global-setup. */
export function authFile(role: Role): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

/**
 * Login REAL via formulário (/auth): preenche e-mail/senha da conta de teste e
 * espera cair no /dashboard. Usado no global-setup para gravar o storageState de
 * cada papel uma vez só (os specs reusam sem relogar).
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const acc = account(role);
  await page.goto("/auth?senha=1", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(acc.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(acc.senha);
  // "Entrar" scopeado ao form: há também um botão "Entrar" no alternador
  // login/cadastro (fora do form) — sem o escopo daria strict-mode violation.
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  // O login cai no /dashboard (ou no destino do ?redirect=). Espera a casca.
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.locator("aside nav").first().waitFor({ state: "visible", timeout: 15_000 });
  // Conta de teste já "viu" o modal de boas-vindas (escolha de papel): sem isso
  // ele abre em todo teste e bloqueia os cliques. O próprio modal grava esta
  // marca quando a pessoa escolhe.
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  if (role === "admin") await elevarAdminParaAal2(page);
}

/**
 * Admin exige verificação em duas etapas (AAL2, ordem f7817f00): sem o código a
 * sessão cai em /auth/verificar-codigo e o lab "fica cego" no /admin. Com
 * TESTES_ADMIN_TOTP_SEGREDO (fator TOTP já ativado na conta de teste) digita o
 * código gerado e grava a sessão já elevada. Sem o segredo, não faz nada.
 */
async function elevarAdminParaAal2(page: Page): Promise<void> {
  const segredo = process.env.TESTES_ADMIN_TOTP_SEGREDO;
  if (!segredo) return;
  await page.goto("/admin", { waitUntil: "networkidle" });
  if (!/\/auth\/verificar-codigo/.test(page.url())) return; // já em AAL2
  await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
  await page.getByRole("button", { name: /confirmar e entrar/i }).click();
  await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 20_000 });
}
