import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirSecoesPasso10 } from "../fixtures/cadastro";

/**
 * T1237 — E633 (#2853), 05/11. Entrou só com teste de unidade. A matrícula atualizada do imóvel (~R$ 35) é prova de
 * titularidade OPCIONAL: nunca bloqueia a publicação. Na Revisão de um rascunho sem a matrícula, a 390 e 1280 px:
 *   - o cartão do documento (seção "documento" do "Antes de publicar") traz "Matrícula atualizada (opcional)", o custo
 *     ("R$ 35") e "você publica sem ela";
 *   - a matrícula atualizada NÃO está entre os itens que faltam para publicar (o motivo do botão não a cita).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1237.${sufixo}@lab.vivanomads.test`, nome: "Marta Matrícula", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1237 — E633: a matrícula atualizada é opcional e diz quanto custa", () => {
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
    test(`a dica da matrícula atualizada e o motivo do botão (${w})`, async ({ browser }) => {
      const imovel = await criarImovelPronto(ids.dono!, `Rascunho matrícula t1237 ${w} ${sufixo}`, { semConforto: true, semInternet: true });
      const draft = {
        title: `Rascunho matrícula t1237 ${w}`, propertyType: "Studio", description: "", bedrooms: "1", bathrooms: "1", areaM2: "40", maxGuests: "2",
        minPeriod: "30", maxPeriod: "180", monthlyPrice: "", street: "Rua do Laboratório", numero: "102", cep: "38400-100",
        neighborhood: "Centro", city: "Uberlândia", uf: "MG", privacidade: { semCamerasInterior: true }, garantias: { caucao_avista: true }, photos: [],
      };
      expect((await adm().from("property_photos").delete().eq("property_id", imovel)).error).toBeNull();
      expect((await adm().from("properties").update({ description: "", monthly_price: 0, photo_count: 0, draft_data: draft }).eq("id", imovel)).error).toBeNull();
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
        await abrirSecoesPasso10(p, ["documento"]);
        const dica = p.getByTestId("matricula-atualizada-dica");
        await expect(dica).toBeVisible();
        await expect(dica).toContainText("Matrícula atualizada (opcional)");
        await expect(dica).toContainText("R$ 35");
        await expect(dica).toContainText("você publica sem ela");
        // Falta coisa para publicar (rascunho sem fotos/descrição/preço), mas a matrícula não está entre elas.
        const motivo = p.getByTestId("publicar-motivo");
        await expect(motivo).toContainText(/Falt(a|am) \d* ?iten/);
        await expect(motivo).not.toContainText("Matrícula atualizada");
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
