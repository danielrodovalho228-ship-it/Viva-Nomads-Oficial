import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, entrarNaPagina } from "../fixtures/laboratorio";

/*
  T1614 — E797 (decisão do chat principal, opção b): o Início (/dashboard) chega em SEÇÕES.
   • o esqueleto de PÁGINA INTEIRA (SkeletonLista do dashboard/loading.tsx, ou o do guarda) não aparece em NENHUM quadro;
   • o topo (inicio-topo) está no 1º quadro: no HTML do servidor ele vem ANTES do bloco de dados (que chega pelo fluxo);
   • a navegação de outra tela do painel até o Início também não passa pelo esqueleto de página inteira.
  Contas da massa da varredura (scripts/lab/massa-varredura.mjs): dono com imóveis, conta com três papéis, inquilina.
*/
const CONTAS = [
  { nome: "DONO17", email: process.env.TESTES_VARREDURA_DONO17_EMAIL, senha: process.env.TESTES_VARREDURA_DONO17_SENHA },
  { nome: "TRES", email: process.env.TESTES_VARREDURA_TRES_EMAIL, senha: process.env.TESTES_VARREDURA_TRES_SENHA },
  { nome: "INQUILINA", email: process.env.TESTES_VARREDURA_INQUILINA_EMAIL, senha: process.env.TESTES_VARREDURA_INQUILINA_SENHA },
];

/** Esqueleto de página inteira: o SkeletonLista (role=status, "Carregando", space-y-4, sem testid) ou o do guarda. */
const ESQUELETO = '[data-testid="auth-guard-carregando"], [role="status"][aria-label="Carregando"].space-y-4:not([data-testid])';

function sonda(seletorEsqueleto: string) {
  const w = window as unknown as { __e797: { esqueleto: boolean; topoEm: number | null; dadosEm: number | null } };
  w.__e797 = { esqueleto: false, topoEm: null, dadosEm: null };
  const olhar = () => {
    if (document.querySelector(seletorEsqueleto)) w.__e797.esqueleto = true;
    if (w.__e797.topoEm === null && document.querySelector('[data-testid="inicio-topo"]')) w.__e797.topoEm = performance.now();
    if (w.__e797.dadosEm === null && document.querySelector('[data-testid="inicio-dono"], [data-testid="inicio-so-morador"], [data-testid="inicio-morador"]')) w.__e797.dadosEm = performance.now();
  };
  new MutationObserver(olhar).observe(document, { subtree: true, childList: true, attributes: true });
  document.addEventListener("DOMContentLoaded", olhar);
}
const lida = (p: Page) => p.evaluate(() => (window as unknown as { __e797: { esqueleto: boolean; topoEm: number | null; dadosEm: number | null } }).__e797);

async function entrar(browser: Browser, email: string, senha: string, largura: number) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 768 ? 844 : 900 } });
  const page = await ctx.newPage();
  await entrarNaPagina(page, email, senha);
  return page;
}

test.describe("T1614 — E797 o Início em seções, sem esqueleto de página inteira", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");

  for (const conta of CONTAS) {
    for (const largura of [1280, 390]) {
      test(`${conta.nome} ${largura}px — carga dura: topo no 1º quadro, nenhum esqueleto de página inteira`, async ({ browser }) => {
        test.skip(!conta.email || !conta.senha, "conta da massa ausente (rode scripts/lab/massa-varredura.mjs)");
        const page = await entrar(browser, conta.email!, conta.senha!, largura);

        // HTML do servidor (a mesma sessão): o topo vem ANTES do bloco de dados; o esqueleto de página inteira não vem.
        const html = await (await page.request.get("/dashboard")).text();
        const iTopo = html.indexOf('data-testid="inicio-topo"');
        const iDados = html.search(/data-testid="(inicio-dono|inicio-so-morador|inicio-morador)"/);
        expect(iTopo, "o topo está no HTML do servidor").toBeGreaterThan(-1);
        expect(iDados, "o bloco de dados chega no mesmo HTML (pelo fluxo)").toBeGreaterThan(-1);
        expect(iTopo, "o topo sai antes do bloco de dados").toBeLessThan(iDados);
        expect(html, "sem o SkeletonLista de página inteira no HTML").not.toMatch(/role="status" aria-label="Carregando" class="space-y-4"/);

        // No navegador, quadro a quadro.
        await page.addInitScript(sonda, ESQUELETO);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator('[data-testid="inicio-dono"], [data-testid="inicio-so-morador"], [data-testid="inicio-morador"]').first()).toBeAttached({ timeout: 30_000 });
        await page.waitForTimeout(500);
        const v = await lida(page);
        expect(v.esqueleto, "o esqueleto de página inteira apareceu em algum quadro").toBe(false);
        expect(v.topoEm, "o topo apareceu").not.toBeNull();
        expect(v.topoEm!, "o topo apareceu antes (ou junto) do bloco de dados").toBeLessThanOrEqual(v.dadosEm ?? Infinity);
        await page.context().close();
      });
    }
  }

  test("navegação de outra tela do painel até o Início: sem esqueleto de página inteira", async ({ browser }) => {
    const conta = CONTAS[0];
    test.skip(!conta.email || !conta.senha, "conta da massa ausente");
    const page = await entrar(browser, conta.email!, conta.senha!, 1280);
    await page.addInitScript(sonda, ESQUELETO);
    await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      (window as unknown as { __e797: { esqueleto: boolean } }).__e797.esqueleto = false;
    });
    await page.locator('a[href="/dashboard"]:visible').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("inicio-topo")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="inicio-dono"], [data-testid="inicio-so-morador"], [data-testid="inicio-morador"]').first()).toBeAttached({ timeout: 30_000 });
    expect((await lida(page)).esqueleto, "o esqueleto de página inteira apareceu na navegação").toBe(false);
    await page.context().close();
  });
});
