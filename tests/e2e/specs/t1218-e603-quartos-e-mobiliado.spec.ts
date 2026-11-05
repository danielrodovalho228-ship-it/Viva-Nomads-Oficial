import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1218 — E603 (#2814, 05/11): a prévia, a listagem e o Passo 5 dizem o mesmo. Entrou só com teste de unidade; aqui é a
 * tela, a 390 e 1280, com um rascunho do laboratório:
 *   1. QUARTOS — o autosave do Passo 4 grava os quartos também na COLUNA (antes só no draft_data, e Meus imóveis, que lê a
 *      coluna, mostrava 0 num rascunho de 2 quartos): digita 3 em "Quartos" e a coluna `bedrooms` vira 3.
 *   2. MOBILIADO — "Mobiliado" tem UMA fonte, o interruptor "Mobiliado e equipado" do Passo 6: a comodidade "Mobiliado
 *      completo" do Passo 5 espelha esse valor, e tocar nela troca o MESMO estado (volta ao Passo 6 e o interruptor mudou).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1218.${sufixo}@lab.vivanomads.test`, nome: "Lia Quartos", role: "owner" as const };
const ids: { dono?: string } = {};

const interruptorMobiliado = (p: Page) => p.getByRole("button", { name: /Mobiliado e equipado/ });
const chipMobiliado = (p: Page) => p.locator('[data-comodidade="mobiliado"]');

test.describe("T1218 — E603: quartos na coluna e Mobiliado de fonte única", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`autosave grava os quartos na coluna; o Mobiliado do Passo 5 é o do Passo 6 (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Rascunho quartos t1218 ${w} ${sufixo}`);
      await adm().from("properties").update({ bedrooms: 1 }).eq("id", imovel);
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);

        // 1. Quartos: a edição real dispara o autosave (só abrir não grava — E516).
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
        const quartos = p.getByTestId("cadastro-quartos");
        await expect(quartos).toBeVisible({ timeout: 30_000 });
        await quartos.fill("3");
        await expect
          .poll(async () => (await adm().from("properties").select("bedrooms").eq("id", imovel).single()).data?.bedrooms, { timeout: 40_000, message: "o autosave grava os quartos na coluna" })
          .toBe(3);

        // 2. Mobiliado: o Passo 6 manda; o chip do Passo 5 espelha.
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=regras`, { waitUntil: "domcontentloaded" });
        await expect(interruptorMobiliado(p)).toBeVisible({ timeout: 30_000 });
        const noPasso6 = (await interruptorMobiliado(p).getAttribute("aria-pressed")) === "true";

        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
        await expect(chipMobiliado(p)).toBeVisible({ timeout: 30_000 });
        expect((await chipMobiliado(p).getAttribute("aria-pressed")) === "true", "o chip do Passo 5 diz o mesmo que o interruptor do Passo 6").toBe(noPasso6);

        // Tocar no chip troca o MESMO estado: o interruptor do Passo 6 vira o contrário (sem recarregar a página).
        await chipMobiliado(p).click();
        await expect(chipMobiliado(p)).toHaveAttribute("aria-pressed", String(!noPasso6));
        await p.getByTestId("cadastro-continuar").click();
        await expect(interruptorMobiliado(p)).toBeVisible({ timeout: 30_000 });
        await expect(interruptorMobiliado(p)).toHaveAttribute("aria-pressed", String(!noPasso6));
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
