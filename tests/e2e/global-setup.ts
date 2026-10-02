import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ALL_ROLES, OPTIONAL_ROLES, hasAccount, type Role } from "./fixtures/accounts";
import { authFile, loginAs, writeRolesManifest, type RoleInfo } from "./fixtures/auth";

/**
 * Loga UMA vez cada papel (inquilino, proprietário, admin) e salva o
 * storageState (cookies + localStorage) em tests/e2e/.auth/<papel>.json.
 * Os specs reusam via `test.use({ storageState })` — sem relogar a cada teste.
 * Roda só no `test` (não no `--list`).
 *
 * RESILIENTE (revisão QA 02/10): um papel SEM credenciais ou cujo login FALHA
 * não derruba mais a suíte inteira. Ele é pulado com aviso claro no log, grava um
 * storageState vazio (evita ENOENT) e NÃO entra no manifesto — os specs desse
 * papel dão SKIP (ver `roleReady`). Assim o teste #9 (só inquilino) roda mesmo
 * sem a conta de proprietário.
 *
 * Preview protegido (Deployment Protection da Vercel): quando
 * VERCEL_AUTOMATION_BYPASS_SECRET existe, o contexto de login manda os headers de
 * bypass — senão o login cairia na tela de acesso da Vercel.
 */

/** storageState vazio e válido — evita ENOENT nos specs de papéis pulados. */
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

/** Headers de bypass da proteção de preview da Vercel (quando o segredo existe). */
function bypassHeaders(): Record<string, string> | undefined {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret
    ? { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" }
    : undefined;
}

/**
 * Login que parou numa URL do domínio da Vercel (vercel.com/login, /sso-api) =
 * barrado pela Deployment Protection. É INFRA (bypass ausente/errado), NÃO um
 * defeito de login do app. Discrimina as duas coisas para o relatório não mentir.
 */
function barradoPelaVercel(finalUrl: string): boolean {
  try {
    return new URL(finalUrl).host.endsWith("vercel.com");
  } catch {
    return /vercel\.com\/(login|sso)/.test(finalUrl);
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = (config.projects[0]?.use?.baseURL as string) || "http://localhost:3000";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const extraHTTPHeaders = bypassHeaders();

  fs.mkdirSync(path.dirname(authFile("inquilino")), { recursive: true });

  // Papéis opcionais só entram na rodada quando têm credenciais configuradas.
  const roles: Role[] = [...ALL_ROLES, ...OPTIONAL_ROLES.filter(hasAccount)];
  const manifest: Partial<Record<Role, RoleInfo>> = {};

  const browser = await chromium.launch({ executablePath });
  try {
    for (const role of roles) {
      // (1) SEM credenciais → problema de INFRA: pula com aviso e estado vazio.
      if (!hasAccount(role)) {
        console.warn(
          `[e2e] Papel "${role}" SEM credenciais (TESTES_${role.toUpperCase()}_*). ` +
            `Pulando — specs desse papel ficam SKIP (infra).`
        );
        fs.writeFileSync(authFile(role), EMPTY_STATE, "utf8");
        manifest[role] = { status: "missing" };
        continue;
      }

      // (2) COM credenciais → login tem que funcionar. Se falhar, é DEFEITO.
      const context = await browser.newContext({
        baseURL,
        ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
      });
      const page = await context.newPage();
      try {
        await loginAs(page, role);
        await context.storageState({ path: authFile(role) });
        manifest[role] = { status: "ready" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const finalUrl = page.url();
        const screenshot = path.join(path.dirname(authFile(role)), `_fail_${role}.png`);
        try {
          await page.screenshot({ path: screenshot, fullPage: true });
        } catch {
          /* screenshot é best-effort */
        }
        fs.writeFileSync(authFile(role), EMPTY_STATE, "utf8");

        if (barradoPelaVercel(finalUrl)) {
          // INFRA: o preview está protegido e o bypass não passou (segredo ausente
          // ou errado). NÃO é defeito de login — specs do papel dão SKIP.
          console.warn(
            `[e2e] Papel "${role}" BARRADO pela proteção da Vercel (infra, não defeito).\n` +
              `         URL final: ${finalUrl}\n` +
              `         → confira o secret VERCEL_AUTOMATION_BYPASS_SECRET no repo.`
          );
          manifest[role] = { status: "blocked_infra", error: msg, finalUrl, screenshot };
        } else {
          // DEFEITO: chegou no app e o login falhou de verdade. Falha ALTA.
          console.error(
            `[e2e] LOGIN DO PAPEL "${role}" FALHOU no app (credenciais PRESENTES) — ` +
              `DEFEITO de produto.\n` +
              `         erro: ${msg}\n` +
              `         URL final: ${finalUrl}\n` +
              `         screenshot: ${screenshot}`
          );
          manifest[role] = { status: "login_failed", error: msg, finalUrl, screenshot };
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  writeRolesManifest(manifest);

  const by = (s: string) =>
    Object.entries(manifest)
      .filter(([, v]) => v?.status === s)
      .map(([r]) => r);
  console.log(`[e2e] Login OK: ${by("ready").join(", ") || "nenhum"}.`);
  const missing = by("missing");
  const blocked = by("blocked_infra");
  const failed = by("login_failed");
  if (missing.length) console.log(`[e2e] SKIP por falta de credencial (infra): ${missing.join(", ")}.`);
  if (blocked.length) console.warn(`[e2e] BARRADO pela Vercel (infra, não defeito): ${blocked.join(", ")}.`);
  if (failed.length) console.error(`[e2e] FALHA DE LOGIN no app (defeito): ${failed.join(", ")}.`);
}
