import { defineConfig, devices } from "@playwright/test";

/**
 * Suíte E2E do Viva Nomads (`npm run testes`) — converte o roteiro manual de QA
 * em testes que rodam a cada PR, com REGRESSÃO PERMANENTE dos bugs estruturais
 * (persistência de modo B1, fronteira demo/real B4-B6, isolamento de papéis,
 * bloqueio de contato no pedido, comissão percentual, robots.txt).
 *
 * Alvo: PREVIEW da Vercel (TESTES_BASE_URL) — testa a mudança antes de subir.
 * Credenciais das contas de TESTE só por env/secrets (nunca no código).
 *
 * Browser: no CI o Playwright instala o Chromium; no agente/local, aponte
 * PLAYWRIGHT_CHROMIUM_PATH para o binário pré-instalado do ambiente.
 */
const BASE_URL = (process.env.TESTES_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e/specs",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  outputDir: "./tests/e2e/.artifacts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never", outputFolder: "playwright-report" }], ["github"], ["list"]]
    : [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
      },
    },
  ],
});
