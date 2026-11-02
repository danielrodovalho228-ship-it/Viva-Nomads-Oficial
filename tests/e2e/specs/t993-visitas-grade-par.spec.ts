import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T993 — #2193 (Pista A, varredura 02/11): a lista de Visitas usa 2 colunas no computador e, com número ÍMPAR de
 * visitas, sobrava um buraco ao lado da última. Agora é grade par (utilidade grade-par): a última ímpar ocupa a linha
 * inteira. Pela tela real (/dashboard/visitas da dona, 3 visitas pedidas em 3 imóveis), 390 e 1280:
 *   1. 1280: as duas primeiras dividem a linha (cada uma com cerca de metade da grade) e a 3ª ocupa a linha inteira;
 *   2. 390: uma coluna — as três com a largura da grade;
 *   3. sem rolagem lateral nos dois tamanhos.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t993.${sufixo}@lab.vivanomads.test`, nome: "Glória Grade Par", role: "owner" as const };
const mor = { email: `mor.t993.${sufixo}@lab.vivanomads.test`, nome: "Paulo Grade Par", role: "tenant" as const };
const ids: { dona?: string; mor?: string } = {};

test.describe("T993 — #2193: Visitas em grade par (a última ímpar ocupa a linha inteira)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.mor = await criarConta(mor, senha);
    for (let i = 1; i <= 3; i++) {
      const imovel = await criarImovelPronto(ids.dona, `Studio Grade Par ${i} ${sufixo}`, { ativo: true, preco: 3000 + i * 100 });
      const quando = new Date(Date.now() + (3 + i) * 86_400_000);
      quando.setUTCHours(17, 0, 0, 0);
      const { error } = await adm().from("visitas_video").insert({ property_id: imovel, owner_id: ids.dona, tenant_id: ids.mor, horarios: [quando.toISOString()], modalidade: "presencial" });
      if (error) throw error;
    }
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("visitas_video").delete().eq("owner_id", ids.dona ?? "");
    await apagarContas([ids.dona, ids.mor]);
  });

  for (const w of [390, 1280] as const) {
    test(`3 visitas: ${w === 1280 ? "a 3ª ocupa a linha inteira" : "uma coluna"} (${w})`, async ({ browser }) => {
      const page = await entrar(browser, dona.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      const grade = page.locator(".grade-par").first();
      await expect(grade).toBeVisible({ timeout: 30_000 });
      await expect(grade.locator(":scope > *")).toHaveCount(3, { timeout: 30_000 });
      const medidas = await grade.evaluate((g) => {
        const larg = g.getBoundingClientRect().width;
        return { larg, itens: Array.from(g.children).map((c) => { const r = c.getBoundingClientRect(); return { w: r.width, top: Math.round(r.top) }; }) };
      });
      const [a, b, c] = medidas.itens;
      if (w === 1280) {
        expect(a.top, "as duas primeiras na mesma linha").toBe(b.top);
        expect(a.w, "a 1ª com cerca de metade").toBeLessThan(medidas.larg * 0.6);
        expect(b.w, "a 2ª com cerca de metade").toBeLessThan(medidas.larg * 0.6);
        expect(c.top, "a 3ª na linha de baixo").toBeGreaterThan(a.top);
        expect(c.w, "a 3ª ocupa a linha inteira").toBeGreaterThan(medidas.larg - 2);
      } else {
        for (const it of medidas.itens) expect(it.w, "uma coluna").toBeGreaterThan(medidas.larg - 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
