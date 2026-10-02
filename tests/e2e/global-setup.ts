import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ALL_ROLES, OPTIONAL_ROLES, hasAccount, type Role } from "./fixtures/accounts";
import { authFile, loginAs, writeRolesManifest } from "./fixtures/auth";

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

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = (config.projects[0]?.use?.baseURL as string) || "http://localhost:3000";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
  const extraHTTPHeaders = bypassHeaders();

  fs.mkdirSync(path.dirname(authFile("inquilino")), { recursive: true });

  // Papéis opcionais só entram na rodada quando têm credenciais configuradas.
  const roles: Role[] = [...ALL_ROLES, ...OPTIONAL_ROLES.filter(hasAccount)];
  const ready: Partial<Record<Role, boolean>> = {};

  const browser = await chromium.launch({ executablePath });
  try {
    for (const role of roles) {
      // Sem credenciais → pula com aviso e grava estado vazio.
      if (!hasAccount(role)) {
        console.warn(
          `[e2e] Papel "${role}" sem credenciais (TESTES_${role.toUpperCase()}_*). ` +
            `Pulando login — os specs desse papel serão SKIP.`
        );
        fs.writeFileSync(authFile(role), EMPTY_STATE, "utf8");
        ready[role] = false;
        continue;
      }

      const context = await browser.newContext({
        baseURL,
        ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
      });
      const page = await context.newPage();
      try {
        await loginAs(page, role);
        await context.storageState({ path: authFile(role) });
        ready[role] = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[e2e] Login do papel "${role}" FALHOU: ${msg}. ` +
            `Gravando estado vazio — os specs desse papel serão SKIP ` +
            `(verifique a conta/segredos e, no preview, o bypass da Vercel).`
        );
        fs.writeFileSync(authFile(role), EMPTY_STATE, "utf8");
        ready[role] = false;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  writeRolesManifest(ready);

  const ok = Object.entries(ready)
    .filter(([, v]) => v)
    .map(([r]) => r);
  const pulados = Object.entries(ready)
    .filter(([, v]) => !v)
    .map(([r]) => r);
  console.log(`[e2e] Papéis prontos: ${ok.join(", ") || "nenhum"}.`);
  if (pulados.length) console.log(`[e2e] Papéis pulados (specs em SKIP): ${pulados.join(", ")}.`);
}
