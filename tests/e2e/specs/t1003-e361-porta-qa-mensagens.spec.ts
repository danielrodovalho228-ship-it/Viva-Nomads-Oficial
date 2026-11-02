import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { NO_LABORATORIO, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1003 — E361 (#2224): a porta da QA (/qa/entrar) diz a CAUSA da recusa em vez do genérico "Não foi possível entrar.".
 * A porta só existe com QA_LOGIN_KEY_HASH: esta spec sobe um servidor extra do mesmo build (porta 3133, chave e hash
 * aleatórios só na memória), como a t596. Pela tela real do atalho, 390 e 1280:
 *   1. recusa DE VERDADE (chave errada, a rota responde 404): "Não entrou. Causas possíveis: …" com as causas e o
 *      apontamento para o log (qa_porta_recusa) — e o genérico de antes nunca aparece;
 *   2. limite (429, resposta trocada no navegador): "Limite de 30 entradas por hora atingido … em até 1 hora.";
 *   3. falha da conferência do limite (503): "A porta não conseguiu conferir o limite de entradas agora. …";
 *   4. sem conexão (a requisição cai): "Sem conexão com o servidor. …".
 * A rota segue com o MESMO corpo em todo 404 (a t596 confere): a mensagem lista as causas sem dizer qual foi.
 */
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3133;
const BASE = `http://localhost:${PORTA}`;
const CHAVE = `t1003-${randomBytes(16).toString("hex")}`;
const HASH = createHash("sha256").update(CHAVE, "utf8").digest("hex");
const sufixo = novoSufixo();
const PADRAO = String.raw`qa\+t1003${sufixo}-[a-z0-9]+@lab\.vivanomads\.test`;
const EMAIL = `qa+t1003${sufixo}-porta@lab.vivanomads.test`;
const GENERICO = "Não foi possível entrar.";
const MSG = {
  404: "Não entrou. Causas possíveis: chave inválida (ou a porta está fechada); conta que não é conta de teste ou que tem 2FA; e-mail novo fora do padrão das contas de teste. O motivo exato fica no log do servidor (qa_porta_recusa).",
  429: "Limite de 30 entradas por hora atingido (por aparelho ou por conta). Tente de novo em até 1 hora.",
  503: "A porta não conseguiu conferir o limite de entradas agora. Tente de novo em instantes.",
  rede: "Sem conexão com o servidor. Confira a internet e tente de novo.",
};
let servidor: ChildProcess | null = null;
let ipSeq = 0;

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: largura, height: largura === 390 ? 844 : 900 },
    extraHTTPHeaders: { "x-vn-origem": "e2e", "x-forwarded-for": `10.61.3.${++ipSeq}` },
  });
  const page = await ctx.newPage();
  await page.goto(`/qa/entrar?email=${encodeURIComponent(EMAIL)}&destino=${encodeURIComponent("/dashboard")}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("qa-entrar")).toHaveAttribute("data-pronto", "1", { timeout: 30_000 });
  return page;
}
async function tentar(page: Page, chave: string) {
  await page.getByTestId("qa-chave").fill(chave);
  await page.getByTestId("qa-entrar").click();
  return page.getByTestId("qa-erro");
}

test.describe("T1003 — E361: a porta da QA diz a causa da recusa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (servidor extra do mesmo build).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(150_000);
    mkdirSync(SAIDA, { recursive: true });
    const log = createWriteStream(`${SAIDA}/t1003-servidor-qa.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, QA_LOGIN_KEY_HASH: HASH, QA_EMAIL_PADRAO: PADRAO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    // A rota responde 404 ao GET quando o servidor está de pé (só aceita POST).
    await expect.poll(async () => (await fetch(`${BASE}/api/qa/entrar`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(404);
  });
  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
  });

  for (const w of [390, 1280] as const) {
    test(`recusa de verdade (chave errada): as causas possíveis, nunca o genérico (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      const erro = await tentar(page, `errada-${randomBytes(8).toString("hex")}`);
      await expect(erro).toHaveText(MSG[404], { timeout: 20_000 });
      await expect(page.getByText(GENERICO, { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });

    test(`limite (429), conferência que falha (503) e sem conexão: cada causa com a sua frase (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      for (const status of [429, 503] as const) {
        await page.route("**/api/qa/entrar", (r) => (r.request().method() === "POST" ? r.fulfill({ status, body: "{}", contentType: "application/json" }) : r.continue()));
        await expect(await tentar(page, CHAVE)).toHaveText(MSG[status], { timeout: 20_000 });
        await page.unrouteAll({ behavior: "wait" });
      }
      await page.route("**/api/qa/entrar", (r) => (r.request().method() === "POST" ? r.abort("internetdisconnected") : r.continue()));
      await expect(await tentar(page, CHAVE)).toHaveText(MSG.rede, { timeout: 20_000 });
      await page.unrouteAll({ behavior: "wait" });
      await expect(page.getByText(GENERICO, { exact: true })).toHaveCount(0);
      expect(new URL(page.url()).pathname, "nenhuma das recusas entrou").toBe("/qa/entrar");
      await page.context().close();
    });
  }
});
