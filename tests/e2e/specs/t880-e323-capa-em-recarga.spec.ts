import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T880 — E323: A FOTO DE CAPA EM "MEUS IMÓVEIS" NÃO SOME NA RECARGA (Pista C, 01/11; observação pedida na vigia). O E323
  relata que a foto do VN-A02690 some ao recarregar "Meus imóveis". O VN-A02690 é um anúncio real (fora do laboratório);
  aqui, a reprodução do cenário com uma conta e um imóvel do laboratório, com as fotos reais do Storage local, a 390 e
  1280 px: abre "Meus imóveis" e recarrega 3 vezes. Em cada carga:
   - o cartão mostra a foto (img com o título do imóvel no alt), nunca o placeholder "sem foto";
   - a foto carrega de verdade (complete && naturalWidth > 0);
   - a capa é a mesma foto (o mesmo src) em todas as cargas — a 1ª foto do imóvel, sem trocar de ordem.
  As cargas ficam anotadas no relatório (src e tamanho natural), como evidência de recorrência ou de ausência.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t880.${sufixo}@lab.vivanomads.test`, nome: "Rosa Recarga", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const TITULO = `Studio capa recarga t880 ${sufixo}`;

async function capa(page: Page): Promise<{ src: string; largura: number }> {
  const img = page.locator(`img[alt="${TITULO}"]`).first();
  await expect(img, "o cartão mostra a foto, não o placeholder").toBeVisible({ timeout: 30_000 });
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
  return img.evaluate((el: HTMLImageElement) => ({ src: el.currentSrc || el.src, largura: el.naturalWidth }));
}

test.describe("T880 — E323: a capa em Meus imóveis não some na recarga", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`@${largura}: a capa aparece e carrega na 1ª carga e em 3 recargas, sempre a mesma`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cargas = [await capa(page)];
      for (let i = 0; i < 3; i++) {
        await page.reload({ waitUntil: "domcontentloaded" });
        cargas.push(await capa(page));
      }
      test.info().annotations.push({ type: "E323", description: cargas.map((c, i) => `carga ${i + 1}: ${c.largura}px ${c.src.split("/").pop()?.split("?")[0]}`).join(" · ") });
      const base = (u: string) => decodeURIComponent(new URL(u).searchParams.get("url") ?? u).split("?")[0];
      expect(new Set(cargas.map((c) => base(c.src))).size, "a capa é a mesma foto em todas as cargas").toBe(1);
      await page.context().close();
    });
  }
});
