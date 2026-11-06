import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1225 — E604 (#2764, 05/11): "Lava-louças" e "TV" moram só em "Conforto do imóvel" (as comodidades do Passo 5) — antes
 * também estavam nos Extras do nível, e a mesma característica podia ser declarada duas vezes. O E604 entrou só com teste
 * de unidade; aqui é a tela, a 390 e 1280, com um anúncio do laboratório que NÃO tem esses extras salvos (os já salvos
 * seguem válidos como legado): a página do nível oferece outros extras, mas nenhum "Lava-louças" nem "TV", e o Passo 5 do
 * assistente continua oferecendo os dois como comodidade.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1225.${sufixo}@lab.vivanomads.test`, nome: "Dina Extras", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1225 — E604: Lava-louças e TV só nas comodidades", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`os Extras do nível não repetem as comodidades (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Anúncio extras t1225 ${w} ${sufixo}`, { ativo: true, preco: 3000 });
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/${imovel}/nivel`, { waitUntil: "domcontentloaded" });
        const extras = p.getByTestId("extras-form");
        await expect(extras).toBeVisible({ timeout: 30_000 });
        expect(await extras.locator('[data-testid^="extra-"]').count(), "os Extras seguem oferecendo outras opções").toBeGreaterThan(0);
        await expect(extras.getByTestId("extra-lava_loucas")).toHaveCount(0);
        await expect(extras.getByTestId("extra-tv")).toHaveCount(0);

        // As duas continuam como comodidade, no Passo 5 do assistente.
        const rascunho = await criarImovelPronto(ids.dono!, `Rascunho comodidades t1225 ${w} ${sufixo}`);
        await p.goto(`/dashboard/imoveis/novo?draft=${rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
        await expect(p.locator('[data-comodidade="lava_loucas"]')).toBeVisible({ timeout: 30_000 });
        await expect(p.locator('[data-comodidade="tv"]')).toBeVisible();
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
