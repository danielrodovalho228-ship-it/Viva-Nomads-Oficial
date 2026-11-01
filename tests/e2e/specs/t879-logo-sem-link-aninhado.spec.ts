import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T879 — LOGO DO TOPO DO PAINEL SEM <a> DENTRO DE <a> (Pista C, 01/11; merge #1911, Pista A, varredura 01/11 achado 1).
  O Logo já é um link e ficava dentro de outro <Link> no topo do painel do proprietário: <a> dentro de <a> é HTML
  inválido e quebra a hidratação. O merge trouxe só teste de fonte; aqui, na tela de verdade, com uma conta de
  proprietário do laboratório, a 390 e 1280 px:
   1) a página do painel não tem nenhum link dentro de outro link (a a);
   2) a 1280 px, o logo do topo é UM link para /dashboard, com o nome "VivaNomads — início do painel" (contém o texto
      visível); a 390 px o topo do painel (TopoPainel) não aparece — é `hidden lg:block` —, então o logo só é conferido
      no computador;
   3) a 1280 px, clicado de outra tela do painel (Meus imóveis), leva ao Início do painel;
   4) o console não acusa o aninhamento de links (o erro de hidratação que o <a> dentro de <a> causava).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t879.${sufixo}@lab.vivanomads.test`, nome: "Lino Logo", role: "owner" as const };
const ids: { dono?: string } = {};
// Só o aninhamento de links (o que o #1911 corrigiu); outros avisos de hidratação não entram aqui.
const ERRO_ANINHADO = /<a> cannot be a descendant of <a>|cannot contain a nested <a>|In HTML, <a> cannot be a descendant/i;

test.describe("T879 — logo do topo do painel sem link aninhado (#1911)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`painel do proprietário @${largura}: sem a dentro de a${largura === 1280 ? " e um link só no logo" : ""}`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      const erros: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && ERRO_ANINHADO.test(m.text())) erros.push(m.text());
      });
      page.on("pageerror", (e) => {
        if (ERRO_ANINHADO.test(e.message)) erros.push(e.message);
      });
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });

      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      expect(await page.locator("a a").count(), "nenhum link dentro de outro link").toBe(0);

      if (largura === 1280) {
        // O topo do painel (com o logo) só aparece a partir de lg (1024 px).
        const logo = page.getByRole("link", { name: "VivaNomads — início do painel" });
        await expect(logo).toHaveCount(1, { timeout: 30_000 });
        await expect(logo).toHaveAttribute("href", "/dashboard");
        await logo.click();
        await expect(page).toHaveURL(/\/dashboard\/?(\?.*)?$/, { timeout: 30_000 });
        await expect(page.getByRole("link", { name: "VivaNomads — início do painel" })).toHaveCount(1, { timeout: 30_000 });
      } else {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      }
      expect(await page.locator("a a").count(), "Início do painel: nenhum link dentro de outro link").toBe(0);

      await page.waitForTimeout(1000);
      expect(erros, "console sem o aviso de <a> dentro de <a>").toEqual([]);
      await page.context().close();
    });
  }
});
