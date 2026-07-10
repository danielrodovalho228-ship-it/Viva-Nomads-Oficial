import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { ALL_ROLES } from "./fixtures/accounts";
import { authFile, loginAs } from "./fixtures/auth";

/**
 * Loga UMA vez cada papel (inquilino, proprietário, admin) e salva o
 * storageState (cookies + localStorage) em tests/e2e/.auth/<papel>.json.
 * Os specs reusam via `test.use({ storageState })` — sem relogar a cada teste.
 * Roda só no `test` (não no `--list`).
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = (config.projects[0]?.use?.baseURL as string) || "http://localhost:3000";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

  fs.mkdirSync(path.dirname(authFile("inquilino")), { recursive: true });

  const browser = await chromium.launch({ executablePath });
  try {
    for (const role of ALL_ROLES) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await loginAs(page, role);
      await context.storageState({ path: authFile(role) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
