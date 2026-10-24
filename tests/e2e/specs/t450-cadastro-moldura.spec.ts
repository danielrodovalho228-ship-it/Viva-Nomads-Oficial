import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { NUMERO_PASSO, TITULO_PASSO, type PassoCadastro } from "../fixtures/cadastro";

/*
  T450 — CADASTRO-MOLDURA (E89). Só no laboratório (conta nova de proprietário, sem rascunho).
  Nos 10 passos, a 390 e 1280 px:
   - nenhum elemento do DashboardShell no DOM (lateral, topo do painel, botão de menu, selo de papel, barra inferior);
   - o topo mínimo (logo sem link, "Precisa de ajuda?", "Sair") e o rodapé do fluxo ("Passo N de 10", barra, Voltar a
     partir do Passo 2, um só primário: "Continuar"; "Publicar anúncio" no Passo 10);
   - um botão primário por passo e nenhum "Fale com a Viva" flutuante;
   - no fim da página, o rodapé não cobre o conteúdo.
  "Sair" volta a Meus imóveis com "Seu rascunho fica salvo.". Prints de todos os passos.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.moldura.${sufixo}@lab.vivanomads.test`, nome: "Lia Moldura", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];

async function semCascaDoPainel(page: Page) {
  // A lateral do painel (a prévia do anúncio é um <aside> da própria página e fica).
  await expect(page.locator('aside:not([data-testid="novo-resumo"])')).toHaveCount(0);
  await expect(page.locator("nav[data-papel]")).toHaveCount(0);
  await expect(page.locator('[aria-label="Abrir menu"]')).toHaveCount(0);
  await expect(page.locator('[aria-label^="Papel ativo"]')).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
}

test.describe("T450 — CADASTRO-MOLDURA: o assistente fora da casca do painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: os 10 passos com o topo mínimo, o rodapé do fluxo e um primário só`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      for (const passo of PASSOS) {
        await page.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO[passo], { timeout: 30_000 });
        const n = NUMERO_PASSO[passo];

        // Moldura: topo mínimo, sem nada da casca do painel.
        await semCascaDoPainel(page);
        const topo = page.locator("header");
        await expect(topo.locator("a[data-logo]")).toHaveCount(0);
        await expect(topo.locator("[data-logo]")).toBeVisible();
        await expect(topo.getByTestId("assistente-ajuda")).toHaveText("Precisa de ajuda?");
        await expect(topo.getByTestId("assistente-sair")).toContainText("Sair");

        // Rodapé do fluxo.
        const rodape = page.getByTestId("assistente-rodape");
        await expect(rodape.getByTestId("passo-texto")).toHaveText(`Passo ${n} de 10`);
        await expect(rodape.getByRole("progressbar", { name: "Progresso do cadastro" })).toHaveAttribute("aria-valuenow", String(n * 10));
        await expect(rodape.getByTestId("cadastro-voltar")).toHaveCount(n === 1 ? 0 : 1);
        if (n < 10) await expect(rodape.getByTestId("cadastro-continuar")).toContainText("Continuar");
        else await expect(rodape.getByTestId("publicar-anuncio")).toHaveText("Publicar anúncio");

        // Um primário por passo, e é o do rodapé.
        const primarios = page.locator('[data-cta="primary"]:visible');
        await expect(primarios).toHaveCount(1);
        expect(await rodape.locator('[data-cta="primary"]').count()).toBe(1);

        // Sem "Salvar": o rascunho salva sozinho.
        await expect(page.getByRole("button", { name: /^Salvar( como rascunho)?$/ })).toHaveCount(0);

        // No fim da página, o rodapé não cobre o conteúdo e não há rolagem para o lado.
        // O fim do conteúdo: o espaçador do rodapé é o último elemento da página (quem rola é a página ou o <main>).
        // <html> tem scroll-smooth: a rolagem é instantânea, senão a medida pega a página no meio do caminho.
        await page.getByTestId("assistente-rodape-espaco").evaluate((el) => el.scrollIntoView({ block: "end", behavior: "instant" }));
        const conteudo = (await page.getByTestId("novo-duas-colunas").boundingBox())!;
        const caixaRodape = (await rodape.boundingBox())!;
        expect(conteudo.y + conteudo.height).toBeLessThanOrEqual(caixaRodape.y + 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: `${SAIDA}/t450-passo-${String(n).padStart(2, "0")}-${passo}-${w}.png`, fullPage: true });
      }
      await page.context().close();
    });
  }

  test("'Sair' volta a Meus imóveis com 'Seu rascunho fica salvo.'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO.tipo, { timeout: 30_000 });
    await page.getByTestId("assistente-sair").click();
    await page.waitForURL(/\/dashboard\/imoveis\?saiu=assistente$/, { timeout: 30_000 });
    await expect(page.getByTestId("rascunho-fica-salvo")).toHaveText("Seu rascunho fica salvo.");
    await page.context().close();
  });
});
