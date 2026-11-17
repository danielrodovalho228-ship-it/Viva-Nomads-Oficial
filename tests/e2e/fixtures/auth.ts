import path from "node:path";
import type { Page } from "@playwright/test";
import { account, type Role } from "./accounts";
import { gerarCodigoTotp } from "./totp";
import { mensagemDaFalhaDeLogin } from "./falha-de-login";

// Ancorado na raiz do repo (a suíte roda a partir dela) — evita import.meta,
// que quebra sob o transpile CJS do Playwright.
const AUTH_DIR = path.join(process.cwd(), "tests", "e2e", ".auth");

/** Caminho do storageState (sessão salva) de um papel — gerado no global-setup. */
export function authFile(role: Role): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

/**
 * Login REAL via formulário (/auth): preenche e-mail/senha da conta de teste e
 * espera cair no /dashboard. Usado no global-setup para gravar o storageState de
 * cada papel uma vez só (os specs reusam sem relogar).
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const acc = account(role);
  await page.goto("/auth?senha=1", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(acc.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(acc.senha);
  // "Entrar" scopeado ao form: há também um botão "Entrar" no alternador
  // login/cadastro (fora do form) — sem o escopo daria strict-mode violation.
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  // O login cai no /dashboard (ou no destino do ?redirect=). Espera a casca: a barra lateral ou, no modo dono no
  // computador (PROP-1), o topo do dono — a barra continua no DOM, escondida, por isso o filtro de visível.
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  } catch {
    throw new Error(mensagemDaFalhaDeLogin({ papel: role, etapa: "senha", caminho: new URL(page.url()).pathname, aviso: await avisoDaTela(page) }));
  }
  await page.locator('aside nav, [data-testid="topo-dono"], [data-testid="topo-morador"], [data-testid="topo-parceiro"], [data-testid="topo-celular"]').filter({ visible: true }).first().waitFor({ state: "visible", timeout: 15_000 });
  // Conta de teste já "viu" o modal de boas-vindas (escolha de papel): sem isso
  // ele abre em todo teste e bloqueia os cliques. O próprio modal grava esta
  // marca quando a pessoa escolhe.
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  if (role === "admin") await elevarAdminParaAal2(page);
}

/**
 * Admin exige verificação em duas etapas (AAL2, ordem f7817f00): sem o código a
 * sessão cai em /auth/verificar-codigo e o lab "fica cego" no /admin. Com
 * TESTES_ADMIN_TOTP_SEGREDO (fator TOTP já ativado na conta de teste) digita o
 * código gerado e grava a sessão já elevada. Sem o segredo, não faz nada.
 */
async function elevarAdminParaAal2(page: Page): Promise<void> {
  const segredo = process.env.TESTES_ADMIN_TOTP_SEGREDO;
  if (!segredo) return;
  await page.goto("/admin", { waitUntil: "networkidle" });
  if (!/\/auth\/verificar-codigo/.test(page.url())) return; // já em AAL2
  await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
  await page.getByRole("button", { name: /confirmar e entrar/i }).click();
  // Entrou (saiu da tela do código) ou a tela recusou o código: o que vier primeiro. Sem isto, um código recusado só
  // aparecia como "Timeout 20000ms" depois de 20 s, três vezes.
  const entrou = page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 20_000 }).then(
    () => "entrou" as const,
    () => "tempo" as const,
  );
  const recusou = page.waitForFunction(TEM_AVISO, undefined, { timeout: 20_000 }).then(
    () => "recusou" as const,
    () => "tempo" as const,
  );
  const primeiro = await Promise.race([entrou, recusou]);
  const resultado = primeiro === "tempo" ? await entrou : primeiro;
  if (resultado !== "entrou") {
    throw new Error(mensagemDaFalhaDeLogin({ papel: "admin", etapa: "duas-etapas", caminho: new URL(page.url()).pathname, aviso: await avisoDaTela(page) }));
  }
}

/** Há um aviso com texto na página? Só o documento (o anunciador de rotas do Next vive num shadow root e fica de fora). */
const TEM_AVISO = () => [...document.querySelectorAll('[role="alert"]')].some((e) => (e.textContent ?? "").trim().length > 0);

/** O primeiro aviso com texto que a tela está mostrando, ou null. */
async function avisoDaTela(page: Page): Promise<string | null> {
  return page
    .evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => (e.textContent ?? "").trim()).find((t) => t.length > 0) ?? null)
    .catch(() => null);
}
