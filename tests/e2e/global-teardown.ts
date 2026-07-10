import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { MARCADOR_RE } from "./fixtures/pedido";

/**
 * Cinturão + suspensório da idempotência: varre e encerra qualquer pedido de
 * teste (cidade "E2E-…") que tenha sobrado — por exemplo se um teste morreu no
 * meio. Best-effort: nunca falha o run. Usa a sessão salva do inquilino.
 */
export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const file = authFile("inquilino");
  if (!fs.existsSync(file)) return;
  const baseURL = process.env.TESTES_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

  const browser = await chromium.launch({ executablePath });
  try {
    const ctx = await browser.newContext({ baseURL, storageState: file });
    const page = await ctx.newPage();
    for (let i = 0; i < 15; i++) {
      await page.goto("/dashboard/pedidos", { waitUntil: "networkidle" });
      const card = page.locator("section", { hasText: MARCADOR_RE }).first();
      if ((await card.count()) === 0) break;
      const btn = card.getByRole("button", { name: /Marcar atendido/i });
      if ((await btn.count()) === 0) break;
      await btn.first().click();
      await page.waitForTimeout(1200);
    }
    await ctx.close();
  } catch {
    /* teardown é best-effort — nunca derruba o run */
  } finally {
    await browser.close();
  }
}
