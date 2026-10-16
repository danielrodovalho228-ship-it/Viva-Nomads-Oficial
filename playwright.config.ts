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

// Preview da Vercel com Deployment Protection: sem o bypass, o Playwright cairia
// na tela de login da Vercel. Com o segredo (VERCEL_AUTOMATION_BYPASS_SECRET),
// cada request leva os headers oficiais de bypass. Ausente → nenhum header
// (rodada local/produção sem proteção).
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const BYPASS_HEADERS = BYPASS
  ? { "x-vercel-protection-bypass": BYPASS, "x-vercel-set-bypass-cookie": "true" }
  : undefined;

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
    ...(BYPASS_HEADERS ? { extraHTTPHeaders: BYPASS_HEADERS } : {}),
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
    {
      // Ordem c27c7ae6: login no Safari do iPhone (WebKit). Só o t82 roda aqui.
      name: "webkit-iphone",
      testMatch: /t(82-login-celular|151-modo-app-iphone)\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
    {
      // Modo app (Android/iPhone): tela de celular + o marcador "VivaNomadsApp"
      // que o app nativo acrescenta ao user-agent. T14, T39 e T46 rodam aqui.
      name: "app-mobile",
      testMatch: /t(14-app-mode|39-app-ida-e-volta|46-modo-do-app)\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        userAgent: `${devices["Pixel 7"].userAgent} VivaNomadsApp/1.0 (expo)`,
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
      },
    },
  ],
});
