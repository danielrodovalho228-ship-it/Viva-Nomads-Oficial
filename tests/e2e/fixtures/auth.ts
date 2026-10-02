import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { account, type Role } from "./accounts";

// Ancorado na raiz do repo (a suíte roda a partir dela) — evita import.meta,
// que quebra sob o transpile CJS do Playwright.
const AUTH_DIR = path.join(process.cwd(), "tests", "e2e", ".auth");

/** Manifesto de quais papéis autenticaram de verdade no global-setup. */
const ROLES_MANIFEST = path.join(AUTH_DIR, "_roles.json");

/** Caminho do storageState (sessão salva) de um papel — gerado no global-setup. */
export function authFile(role: Role): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

/**
 * Grava o manifesto de papéis prontos (login real OK). Chamado uma vez pelo
 * global-setup. Specs de um papel ausente/falho leem `roleReady` e dão SKIP —
 * assim um papel sem conta (ex.: proprietario1 inexistente) não derruba a suíte.
 */
export function writeRolesManifest(ready: Partial<Record<Role, boolean>>): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(ROLES_MANIFEST, JSON.stringify(ready, null, 2), "utf8");
}

/**
 * true se o papel autenticou no global-setup (storageState válido). Default
 * `false` quando o manifesto não existe ou o papel não está lá — o spec então
 * dá SKIP (nunca acusa falha de comportamento por falta de conta/infra).
 */
export function roleReady(role: Role): boolean {
  try {
    const raw = fs.readFileSync(ROLES_MANIFEST, "utf8");
    return (JSON.parse(raw) as Partial<Record<Role, boolean>>)[role] === true;
  } catch {
    return false;
  }
}

/**
 * Login REAL via formulário (/auth): preenche e-mail/senha da conta de teste e
 * espera cair no /dashboard. Usado no global-setup para gravar o storageState de
 * cada papel uma vez só (os specs reusam sem relogar).
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const acc = account(role);
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(acc.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(acc.senha);
  // "Entrar" scopeado ao form: há também um botão "Entrar" no alternador
  // login/cadastro (fora do form) — sem o escopo daria strict-mode violation.
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  // O login cai no /dashboard (ou no destino do ?redirect=). Espera a casca.
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.locator("aside nav").first().waitFor({ state: "visible", timeout: 15_000 });
}
