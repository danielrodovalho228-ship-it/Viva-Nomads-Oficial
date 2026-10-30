import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T686 — E259 (9)(10) (prova de publicação do QA, 30/10): página pública do imóvel. 1280 e 390, com prints.
   (9) "Destaques do imóvel" saem das comodidades principais (trabalho, internet, ar-condicionado) — não só
       "1 vaga de garagem"; e "Aceita crianças" ligado vira linha nas regras.
   (10) A galeria pede a(s) foto(s) da primeira pintura já (priority: fetchpriority alta, sem carregamento tardio).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t686.${sufixo}@lab.vivanomads.test`, nome: "Leo Destaques", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T686 — E259 (9)(10): destaques, crianças e a primeira pintura da galeria", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Apartamento Destaques ${sufixo}`, { ativo: true });
    // Gravado antes de qualquer visita (a página pública guarda cache).
    const { error } = await adm().from("properties").update({ parking_spots: 1, children_allowed: true, internet_mbps: 500 }).eq("id", ids.imovel);
    if (error) throw error;
    await adm().from("property_amenities").delete().eq("property_id", ids.imovel);
    const { error: e2 } = await adm()
      .from("property_amenities")
      .insert([
        { property_id: ids.imovel, category: "trabalho", label: "Home office / escritório dedicado", sort_order: 1 },
        { property_id: ids.imovel, category: "trabalho", label: "Internet fibra de alta velocidade", sort_order: 2 },
        { property_id: ids.imovel, category: "trabalho", label: "Mesa de trabalho", sort_order: 3 },
        { property_id: ids.imovel, category: "conforto", label: "Ar-condicionado", sort_order: 4 },
      ]);
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — destaques das comodidades, crianças nas regras, galeria com prioridade`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const dest = p.getByTestId("destaques-imovel");
      await expect(dest).toBeVisible({ timeout: 30_000 });
      await expect(dest.locator("li")).toHaveCount(3);
      await expect(dest).toContainText("Espaço para trabalhar");
      await expect(dest).toContainText("Internet fibra");
      await expect(dest).toContainText("500 Mbps informados");
      await expect(dest).toContainText("Ar-condicionado");
      await expect(dest).not.toContainText("vaga de garagem");
      await expect(p.locator("body")).toContainText("Aceita crianças");
      // (10) a primeira foto da galeria vem com prioridade (next/image priority → fetchpriority="high", sem lazy).
      const primeira = p.getByTestId("galeria-tile-0").locator("img").first();
      await expect(primeira).toHaveAttribute("fetchpriority", "high");
      expect(await primeira.getAttribute("loading")).not.toBe("lazy");
      await dest.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t686-destaques-${w}.png` });
      await ctx.close();
    });
  }
});
