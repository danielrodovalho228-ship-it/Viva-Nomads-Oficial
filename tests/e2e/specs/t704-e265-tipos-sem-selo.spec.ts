import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T704 — E265 (reprova do E259 no QA, 30/10): as fotos dos cartões de tipo do Passo 1 aparecem sem o selo "Imagem
  ilustrativa" por cima (dava cara de modelo pronto). As 9 fotos seguem carregando, com o alt que descreve o tipo.
  Desktop (1280) e celular (390).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t704.${sufixo}@lab.vivanomads.test`, nome: "Sel Sem", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T704 — E265: Passo 1 sem selo sobre as fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: os 9 cartões de tipo com foto e sem selo por cima`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const linha = p.getByRole("radiogroup", { name: "Tipo do imóvel" });
      await expect(linha).toBeVisible({ timeout: 30_000 });
      const fotos = linha.locator("img");
      await expect(fotos).toHaveCount(9);
      for (let i = 0; i < 9; i++) {
        const img = fotos.nth(i);
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
        expect(await img.getAttribute("alt")).toMatch(/^Foto ilustrativa de /);
      }
      // Nada escrito por cima das fotos: dentro da moldura de cada foto só há a imagem.
      await expect(linha.getByText("Imagem ilustrativa")).toHaveCount(0);
      await expect(p.getByTestId("selo-ilustrativa")).toHaveCount(0);
      const textoSobreFoto = await fotos.evaluateAll((els) => els.map((e) => (e.parentElement?.textContent ?? "").trim()).filter(Boolean));
      expect(textoSobreFoto, "texto dentro da moldura da foto").toEqual([]);
      await fotos.first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t704-passo1-${largura}.png` });
      await p.context().close();
    });
  }
});
