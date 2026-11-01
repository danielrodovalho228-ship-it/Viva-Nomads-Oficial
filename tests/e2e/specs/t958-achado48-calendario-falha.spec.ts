import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T958 — #2068 (varredura de erros, rodada 4, achado 48): o calendário público do anúncio engolia a falha da leitura
 * das datas ocupadas e mostrava tudo livre. Agora avisa: "Não foi possível conferir as datas já ocupadas agora. O
 * proprietário confirma as datas antes de aceitar." com "Tentar de novo". Pela tela real (página do anúncio,
 * visitante), 390 e 1280:
 *   1. a ação do servidor das datas responde 500 (o efeito do "throw" novo): o aviso aparece (role=alert);
 *   2. "Tentar de novo" com o servidor de volta: o aviso some.
 * Os achados 46 (aceite que passava por cima de um contrato) e 47 (calendário do dono sem bloqueios) são do servidor:
 * ficam com o teste de unidade do #2068 (achado46-48-datas.test.ts).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t958.${sufixo}@lab.vivanomads.test`, nome: "Dora Datas", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

async function acoesFalham(page: Page, liga: boolean) {
  const padrao = `**/imoveis/${ids.imovel}**`;
  if (!liga) return page.unroute(padrao);
  await page.route(padrao, (r) =>
    r.request().method() === "POST" && r.request().headers()["next-action"] ? r.fulfill({ status: 500, body: "falha simulada (t958)" }) : r.continue(),
  );
}

test.describe("T958 — #2068 achado 48: o calendário público avisa quando não confere as datas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Datas t958 ${sufixo}`, { ativo: true, preco: 3000 });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`falha → aviso; 'Tentar de novo' → sem aviso (${largura})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await acoesFalham(page, true);
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const aviso = page.getByTestId("calendario-datas-falha");
      await aviso.scrollIntoViewIfNeeded({ timeout: 30_000 });
      await expect(aviso).toBeVisible();
      await expect(aviso).toHaveAttribute("role", "alert");
      await expect(aviso).toContainText("Não foi possível conferir as datas já ocupadas agora. O proprietário confirma as datas antes de aceitar.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await acoesFalham(page, false);
      await page.getByTestId("calendario-datas-tentar").click();
      await expect(page.getByTestId("calendario-datas-falha")).toHaveCount(0, { timeout: 30_000 });
      await ctx.close();
    });
  }
});
