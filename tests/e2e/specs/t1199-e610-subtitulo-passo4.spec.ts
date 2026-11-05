import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1199 — E610 (05/11): o subtítulo do Passo 4 (Detalhes) diz o que o passo pede — "Conte como é o imóvel: quartos,
 * banheiros, área, quantas pessoas podem morar e vagas de garagem." — e não fala em "finalizar o cadastro" no passo 4
 * de 10. O E610 entrou só com teste de unidade; aqui é a tela do assistente, a 390 e 1280.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1199.${sufixo}@lab.vivanomads.test`, nome: "Lara Detalhes", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};
const SUBTITULO = "Conte como é o imóvel: quartos, banheiros, área, quantas pessoas podem morar e vagas de garagem.";

test.describe("T1199 — E610: o subtítulo do Passo 4 diz o que o passo pede", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 90_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho do passo 4 t1199 ${sufixo}`);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`Passo 4 de 10 com o subtítulo novo (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("passo-texto")).toHaveText("Passo 4 de 10", { timeout: 30_000 });
        await expect(p.getByTestId("passo-subtitulo")).toHaveText(SUBTITULO);
        await expect(p.locator("main")).not.toContainText("finalizar o cadastro");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
