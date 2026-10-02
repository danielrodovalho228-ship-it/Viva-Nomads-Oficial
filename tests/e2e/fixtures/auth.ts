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
 * Situação de cada papel após o global-setup:
 *  • "ready"         — login real OK (storageState válido).
 *  • "missing"       — SEM credenciais → pular os specs (problema de INFRA).
 *  • "blocked_infra" — o login não chegou no app: caiu na proteção da Vercel
 *                      (preview protegido / bypass ausente ou errado). É INFRA,
 *                      não defeito — o spec `auth-setup` dá SKIP com o motivo.
 *  • "login_failed"  — chegou no app (/auth) mas o login falhou de verdade →
 *                      DEFEITO de produto; o spec `auth-setup` falha ALTO.
 */
export type RoleStatus = "ready" | "missing" | "blocked_infra" | "login_failed";

export interface RoleInfo {
  status: RoleStatus;
  /** Mensagem do Supabase / erro do login (só em login_failed). */
  error?: string;
  /** URL em que o login parou (ex.: tela de proteção da Vercel). */
  finalUrl?: string;
  /** Caminho do screenshot capturado na falha de login. */
  screenshot?: string;
}

/**
 * Grava o manifesto de situação dos papéis. Chamado uma vez pelo global-setup.
 * Specs leem `roleReady`/`roleStatus` — assim um papel sem conta não derruba a
 * suíte, e um login quebrado vira FALHA explícita (não um skip silencioso).
 */
export function writeRolesManifest(manifest: Partial<Record<Role, RoleInfo>>): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(ROLES_MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
}

/** Situação do papel (default "missing" quando o manifesto não existe). */
export function roleStatus(role: Role): RoleInfo {
  try {
    const raw = fs.readFileSync(ROLES_MANIFEST, "utf8");
    return (JSON.parse(raw) as Partial<Record<Role, RoleInfo>>)[role] ?? { status: "missing" };
  } catch {
    return { status: "missing" };
  }
}

/**
 * true só quando o papel autenticou. Os specs do papel usam isto para dar SKIP
 * quando ele NÃO está pronto (ausente OU com login falho) — a falha de login
 * aparece ALTA no spec `auth-setup`, não como ruído em cada spec do papel.
 */
export function roleReady(role: Role): boolean {
  return roleStatus(role).status === "ready";
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
