import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T440 — E98-A, página do imóvel. Só no laboratório.
   1. JSON-LD: o preço da oferta é o TOTAL do mês (2.900 + 220 de condomínio + 220 de contas fixas = 3.340), por mês,
      com "Valor do mês com condomínio e contas fixas incluídos".
   2. "Bom saber" com as 4 linhas (cancelamento, regras, segurança, manutenção); cada uma abre o detalhe. A manutenção
      não fica mais solta embaixo do bloco.
  Em 390 e 1280 px, com prints.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e98.${sufixo}@lab.vivanomads.test`, nome: "Rita Premium", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const SAIDA = "tests/laboratorio/saida";

test.describe("T440 — E98-A: total do mês no JSON-LD e Bom saber completo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Premium E98 ${sufixo}`, { ativo: true, preco: 2900 });
    const { error } = await adm()
      .from("properties")
      .update({ condo_fee: 220, utilities_mode: "fixed", utilities_estimate: 220, limpeza_estadia: null })
      .eq("id", ids.imovel);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: JSON-LD com o total do mês e Bom saber com 4 linhas`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });

      // 1. JSON-LD do anúncio.
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      const grafo = ld.map((t) => JSON.parse(t)).flatMap((j) => j["@graph"] ?? [j]);
      const oferta = grafo.find((n) => n.offers)?.offers;
      expect(oferta.price).toBe(3340);
      expect(oferta.priceSpecification.price).toBe(3340);
      expect(oferta.priceSpecification.unitCode).toBe("MON");
      expect(oferta.description).toBe("Valor do mês com condomínio e contas fixas incluídos");

      // 2. Bom saber.
      const bloco = page.getByTestId("bom-saber");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      for (const c of ["cancelamento", "regras", "seguranca", "manutencao"]) await expect(bloco.getByTestId(`bom-saber-${c}`)).toBeVisible();
      await expect(bloco.getByTestId("bom-saber-manutencao")).toContainText("Urgente com solução provisória em até 24 h");
      await expect(page.getByTestId("compromisso-manutencao")).toHaveCount(0);
      await bloco.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t440-bom-saber-${w}.png` });

      await bloco.getByTestId("bom-saber-manutencao").click();
      const folha = page.getByRole("dialog");
      await expect(folha).toContainText("Comum em até 72 h");
      await expect(folha).toContainText("Demais em até 7 dias");
      await page.screenshot({ path: `${SAIDA}/t440-bom-saber-manutencao-${w}.png` });
      await ctx.close();
    });
  }
});
