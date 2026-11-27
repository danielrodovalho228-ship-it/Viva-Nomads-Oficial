import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T905 — E496 (guarda, sessão real): vindo de /dashboard/notificacoes#avisos, o PRIMEIRO toque em "Início" leva ao
  painel. Dois caminhos: (a) a página aberta direto pelo endereço com #avisos; (b) o caminho do relato — Início → sino →
  "Ver todas" → Início. 390 e 1280. Local (modo demonstração e build de produção) o primeiro clique sempre navegou; esta
  guarda roda com a sessão e os dados reais do laboratório, onde o relato aconteceu.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `inicio.t905.${sufixo}@lab.vivanomads.test`, nome: "Ines Inicio", role: "owner" as const };
const ids: string[] = [];

test.describe("T905 — E496: Início navega no primeiro clique vindo dos avisos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.push(await criarConta(pessoa, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: um clique em Início basta (direto e pelo sino)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);

      const umCliqueNoInicio = async (via: string) => {
        await expect(p.locator("#avisos")).toBeVisible({ timeout: 30_000 });
        const inicio = p.getByRole("link", { name: "Início", exact: true }).locator("visible=true").first();
        await expect(inicio).toHaveAttribute("href", "/dashboard");
        if (w === 390) await inicio.tap();
        else await inicio.click();
        // UM clique: o painel abre sem segundo toque (a página de avisos sai da tela).
        await expect(p, `${via} @${w}`).toHaveURL((u) => u.pathname === "/dashboard", { timeout: 20_000 });
        await expect(p.locator("#avisos"), `${via} @${w}`).toHaveCount(0, { timeout: 20_000 });
      };

      // (a) Direto pelo endereço.
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      await umCliqueNoInicio("direto");

      // (b) O caminho do relato: sino → "Ver todas" → Início.
      await p.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await p.getByRole("button", { name: /^Notificações/ }).locator("visible=true").first().click();
      await p.locator('[data-testid$="-ver-todas"]').locator("visible=true").first().click();
      await expect(p).toHaveURL(/\/dashboard\/notificacoes#avisos$/, { timeout: 30_000 });
      await umCliqueNoInicio("sino");
      await p.screenshot({ path: `tests/laboratorio/saida/t905-inicio-${w}.png` });
      await ctx.close();
    });
  }
});
