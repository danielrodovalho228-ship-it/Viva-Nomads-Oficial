import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T906 — E512: o menu de estado do anúncio (Pausar/Reativar) não cobre o título do próprio cartão. Em Meus imóveis,
  anúncio ativo: tocar no selo "Ativo" abre "Pausar anúncio" numa linha própria, no fluxo — o título desce e continua
  inteiro à vista (nenhuma interseção entre o menu e o título). 390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t906.${sufixo}@lab.vivanomads.test`, nome: "Paula Pausa", role: "owner" as const };
const titulo = `Studio T906 ${sufixo}`;
const ids: string[] = [];

test.describe("T906 — E512: menu de estado no fluxo, sem cobrir o título", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    const id = await criarConta(dono, senha);
    ids.push(id);
    await criarImovelPronto(id, titulo, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: "Pausar anúncio" abre abaixo do selo e o título segue à vista`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const tituloCartao = p.getByRole("link", { name: titulo });
      await expect(tituloCartao).toBeVisible({ timeout: 30_000 });
      const cartao = p.locator("li, article, div").filter({ has: tituloCartao }).filter({ has: p.getByTestId("estado-anuncio") }).last();
      await cartao.getByTestId("estado-anuncio").click();
      const menu = cartao.getByTestId("estado-anuncio-menu");
      await expect(menu).toBeVisible();
      await expect(menu.getByTestId("pausar-anuncio")).toBeVisible();

      // Nenhuma interseção: o menu fica inteiro acima do título (o título desceu) e o título continua visível.
      const [m, t] = await Promise.all([menu.boundingBox(), tituloCartao.boundingBox()]);
      expect(m && t).toBeTruthy();
      expect(m!.y + m!.height, JSON.stringify({ m, t })).toBeLessThanOrEqual(t!.y + 1);
      await expect(tituloCartao).toBeVisible();
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t906-menu-estado-${w}.png` });

      // Tocar fora fecha; tocar no item abre a confirmação (o menu tem a própria referência, não fecha antes do clique).
      await menu.getByTestId("pausar-anuncio").click();
      await expect(cartao.getByTestId("confirmar-pausa-painel")).toBeVisible();
      await ctx.close();
    });
  }
});
