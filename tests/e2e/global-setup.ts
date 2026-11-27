import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ALL_ROLES, OPTIONAL_ROLES, account, hasAccount } from "./fixtures/accounts";
import { authFile, loginAs } from "./fixtures/auth";
import { comTentativas } from "./fixtures/tentativas";
import { semCookieDeAtividade } from "./fixtures/sessao-gravada";
import { NO_LABORATORIO, liberarLimiteLogin } from "./fixtures/laboratorio";
import { recusaPorLimite } from "./fixtures/falha-de-login";

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
  // E288-B: a marca de teste também aqui — o proxy devolve o cookie vn_trafego=e2e, que vai junto na sessão gravada.
  const extraHTTPHeaders = {
    "x-vn-origem": "e2e",
    ...(secret ? { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } : {}),
  };

  const browser = await chromium.launch({ executablePath });
  try {
    for (const role of roles) {
      // Cada papel tem até 3 tentativas, cada uma num contexto novo. Se mesmo assim não logar, grava uma sessão
      // vazia e segue: só os specs desse papel falham (com o motivo no log) e a suíte NÃO aborta com 0 testes
      // (lab ec62b16, c03ff36 e bb86a49 gravaram 0/0/0 porque um único login quebrou o global-setup).
      // E2E da prévia (16/11): fora do laboratório não há como zerar o limite de login. Se a tela recusar com "Muitas
      // tentativas", repetir só gasta mais tentativas da conta (eram 9 por rodada, 3 por conta) e mantém o limite estourado
      // para a rodada seguinte: para na primeira recusa. No laboratório o limite é zerado antes de cada tentativa.
      let tentativas = 0;
      try {
        await comTentativas(async () => {
          tentativas++;
          // E744 (triagem do t187): o login tem limite progressivo por e-mail (5/min, 10 em 10 min, 20 por hora). Num
          // laboratório reaproveitado, rodadas seguidas estouravam o da persona que mais entra (o admin) e a rodada
          // seguia sem a sessão dela. Os specs já zeram o contador antes de entrar; aqui também, só no laboratório.
          if (NO_LABORATORIO) await liberarLimiteLogin(account(role).email);
          const context = await browser.newContext({ baseURL, extraHTTPHeaders });
          try {
            const page = await context.newPage();
            await loginAs(page, role);
            fs.writeFileSync(authFile(role), JSON.stringify(semCookieDeAtividade(await context.storageState())));
          } finally {
            await context.close();
          }
        }, 3, 2_000, undefined, NO_LABORATORIO ? undefined : (e) => recusaPorLimite((e as Error).message));
      } catch (e) {
        console.error(`[global-setup] login de "${role}" falhou depois de ${tentativas} tentativa${tentativas === 1 ? "" : "s"}: ${(e as Error).message.split("\n")[0]}`);
        fs.writeFileSync(authFile(role), JSON.stringify({ cookies: [], origins: [] }));
      }
    }
  } finally {
    await browser.close();
  }
}
