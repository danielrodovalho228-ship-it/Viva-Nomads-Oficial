import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ALL_ROLES, OPTIONAL_ROLES, hasAccount } from "./fixtures/accounts";
import { authFile, loginAs } from "./fixtures/auth";
import { comTentativas } from "./fixtures/tentativas";
import { semCookieDeAtividade } from "./fixtures/sessao-gravada";

/**
 * Loga UMA vez cada papel (inquilino, proprietário, admin) e salva o
 * storageState (cookies + localStorage) em tests/e2e/.auth/<papel>.json.
 * Os specs reusam via `test.use({ storageState })` — sem relogar a cada teste.
 * Roda só no `test` (não no `--list`).
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Produção: só specs anônimos (as contas de teste não existem lá) — sem login.
  if (process.env.TESTES_SO_PUBLICO === "1") return;

  const baseURL = (config.projects[0]?.use?.baseURL as string) || "http://localhost:3000";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

  fs.mkdirSync(path.dirname(authFile("inquilino")), { recursive: true });

  // Papéis opcionais só entram na rodada quando têm credenciais configuradas.
  const roles = [...ALL_ROLES, ...OPTIONAL_ROLES.filter(hasAccount)];

  // Preview com Deployment Protection da Vercel: sem os headers de bypass, o
  // login cairia na tela de acesso da Vercel (o config do Playwright não se
  // aplica a este navegador, aberto à parte).
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const extraHTTPHeaders = secret
    ? { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" }
    : undefined;

  const browser = await chromium.launch({ executablePath });
  try {
    for (const role of roles) {
      // Cada papel tem até 3 tentativas, cada uma num contexto novo. Se mesmo assim não logar, grava uma sessão
      // vazia e segue: só os specs desse papel falham (com o motivo no log) e a suíte NÃO aborta com 0 testes
      // (lab ec62b16, c03ff36 e bb86a49 gravaram 0/0/0 porque um único login quebrou o global-setup).
      try {
        await comTentativas(async () => {
          const context = await browser.newContext({ baseURL, ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}) });
          try {
            const page = await context.newPage();
            await loginAs(page, role);
            fs.writeFileSync(authFile(role), JSON.stringify(semCookieDeAtividade(await context.storageState())));
          } finally {
            await context.close();
          }
        });
      } catch (e) {
        console.error(`[global-setup] login de "${role}" falhou depois de 3 tentativas: ${(e as Error).message.split("\n")[0]}`);
        fs.writeFileSync(authFile(role), JSON.stringify({ cookies: [], origins: [] }));
      }
    }
  } finally {
    await browser.close();
  }
}
