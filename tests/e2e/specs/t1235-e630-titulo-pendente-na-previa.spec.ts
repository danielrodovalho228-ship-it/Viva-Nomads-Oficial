import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1235 — E630 (#2839), 05/11. Entrou só com teste de unidade. Num rascunho sem título, a Revisão aponta o título como
 * pendente (E613) e a PRÉVIA do anúncio não pode inventar um ("Apartamento no Saraiva", "Seu imóvel"): o cartão da
 * Revisão e a prévia lateral mostram "Título ainda não definido", marcado como pendente. 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1235.${sufixo}@lab.vivanomads.test`, nome: "Tânia Título", role: "owner" as const };
const ids: { dono?: string } = {};
const INVENTADO = /Apartamento no|Seu imóvel|Quarto privativo/;

test.describe("T1235 — E630: título vazio aparece como pendente na prévia e na Revisão", () => {
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
    test(`a Revisão e a prévia dizem "Título ainda não definido" (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Rascunho sem título t1235 ${w} ${sufixo}`, { semConforto: true, semInternet: true });
      const draft = {
        title: "", propertyType: "Apartamento", description: "", bedrooms: "1", bathrooms: "1", areaM2: "40", maxGuests: "2",
        minPeriod: "30", maxPeriod: "180", monthlyPrice: "", street: "Rua do Laboratório", numero: "102", cep: "38400-100",
        neighborhood: "Saraiva", city: "Uberlândia", uf: "MG", privacidade: { semCamerasInterior: true }, garantias: { caucao_avista: true }, photos: [],
      };
      expect((await adm().from("property_photos").delete().eq("property_id", imovel)).error).toBeNull();
      expect((await adm().from("properties").update({ description: "", monthly_price: 0, photo_count: 0, draft_data: draft }).eq("id", imovel)).error).toBeNull();
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
        // No celular a prévia da Revisão vem recolhida atrás de "Ver como fica o anúncio"; no computador já está aberta.
        if (w === 390) await p.getByTestId("previa-recolhida").click();
        const titulo = p.getByTestId("revisao-titulo");
        await expect(titulo).toBeVisible({ timeout: 30_000 });
        await expect(p.getByTestId("revisao-titulo-pendente")).toHaveText("Título ainda não definido");
        await expect(titulo).not.toContainText(INVENTADO);
        // A prévia lateral some na Revisão (o cartão é o da própria Revisão) e abaixo de 1280: lá ela é conferida num passo anterior.
        await expect(p.getByTestId("previa-anuncio")).toHaveCount(0);
        if (w === 1280) {
          await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
          await expect(p.getByTestId("previa-titulo-pendente")).toHaveText("Título ainda não definido", { timeout: 30_000 });
          await expect(p.getByTestId("previa-titulo")).not.toContainText(INVENTADO);
        }
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
