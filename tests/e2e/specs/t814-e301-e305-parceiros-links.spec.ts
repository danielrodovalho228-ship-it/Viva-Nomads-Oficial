import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T814 — #1773 (E301–E305, QA do Muse de 31/10), Pista C, bloco 129. Pela tela de verdade, como visitante, a 390 e a
  1280 px:
   1. E301 — o cartão que junta montagem e mudança em /parceiros leva cada link à sua categoria (antes os dois iam só a
      "mudanca");
   2. E302/E303 — "Ver o Plano Gestor" leva à explicação do Gestor em /precos (âncora #plano-gestor), e a seção existe;
   3. E305 — a faixa do avaliador credenciado em /parceiros tem foto, carregada.
  O E304 (UF pela lista do IBGE na busca vazia) tem teste de unidade no merge e depende de uma busca sem resultado.
*/
const altura = (l: number) => (l === 390 ? 844 : 900);
async function visitante(browser: Browser, largura: number, caminho: string): Promise<Page> {
  const p = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: altura(largura) } })).newPage();
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}

test.describe("T814 — E301–E305: links do bloco de parceiros, âncora do Plano Gestor e foto do avaliador (#1773)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: montagem e mudança com links próprios; Plano Gestor com âncora; foto na faixa do avaliador`, async ({ browser }) => {
      const p = await visitante(browser, largura, "/parceiros");
      // E301: os quatro links do cartão, cada um na sua categoria.
      for (const [rotulo, href] of [
        ["Atender montagem", "/parceiros?categoria=montagem#quero-ser-parceiro"],
        ["Atender mudança", "/parceiros?categoria=mudanca#quero-ser-parceiro"],
        ["Procurar montagem", "/parceiros/buscar?categoria=montagem"],
        ["Procurar mudança", "/parceiros/buscar?categoria=mudanca"],
      ] as const) {
        await expect(p.getByRole("link", { name: rotulo, exact: true }).first(), `link "${rotulo}"`).toHaveAttribute("href", href);
      }
      // E302: o botão leva à âncora do Gestor.
      const gestor = p.getByRole("link", { name: "Ver o Plano Gestor", exact: true }).first();
      await expect(gestor).toHaveAttribute("href", "/precos#plano-gestor");
      // E305: a faixa do avaliador tem foto carregada.
      const foto = p.getByTestId("parceiros-avaliador-foto").locator("img").first();
      await foto.scrollIntoViewIfNeeded();
      await expect.poll(() => foto.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0), { timeout: 15_000, message: "foto da faixa do avaliador carregada" }).toBe(true);
      await p.context().close();

      // E302/E303: a seção do Gestor existe em /precos e é o alvo da âncora.
      const pr = await visitante(browser, largura, "/precos#plano-gestor");
      const secao = pr.getByTestId("plano-gestor-secao");
      await expect(secao).toHaveAttribute("id", "plano-gestor");
      await expect(secao).toBeInViewport({ timeout: 15_000 });
      await pr.context().close();
    });
  }
});
