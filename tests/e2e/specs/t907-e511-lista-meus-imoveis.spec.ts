import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T907 — E511: Meus imóveis com muitos cartões tem abas de estado, busca, ordem e "Mostrar mais". Dono com 14 imóveis
  (1 ativo + 13 rascunhos): 12 cartões à vista, "Mostrando 12 de 14 imóveis" e "Mostrar mais 2"; a aba Ativos mostra só o ativo; a busca acha
  pelo nome; sem resultado, o aviso. 390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t907.${sufixo}@lab.vivanomads.test`, nome: "Lia Lista", role: "owner" as const };
const ids: string[] = [];
const ATIVO = `Studio Ativo T907 ${sufixo}`;

test.describe("T907 — E511: lista de Meus imóveis com abas, busca, ordem e Mostrar mais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    const donoId = await criarConta(dono, senha);
    ids.push(donoId);
    await criarImovelPronto(donoId, ATIVO, { ativo: true });
    const rascunhos = Array.from({ length: 13 }, (_, i) => ({
      owner_id: donoId, title: `Rascunho ${String(i + 1).padStart(2, "0")} T907 ${sufixo}`, description: "Rascunho de laboratório (T907).",
      property_type: "Apartamento", address: "Santa Mônica", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40,
      min_period_days: 30, max_period_days: 180, monthly_price: 0, status: "draft", draft_data: { title: `Rascunho ${i + 1}` },
    }));
    const { error } = await adm().from("properties").insert(rascunhos);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: 12 à vista, Mostrar mais, abas e busca`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("imoveis-barra")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("imoveis-aba-todos")).toContainText("(14)");
      await expect(p.getByTestId("imoveis-aba-active")).toContainText("(1)");
      await expect(p.getByTestId("imoveis-aba-draft")).toContainText("(13)");
      await expect(p.getByTestId("imoveis-aba-paused")).toHaveCount(0);

      // Página: 12 cartões e "Mostrar mais" com o que falta.
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(12);
      const mais = p.getByTestId("imoveis-mostrar-mais");
      // E624: um número só — as abas, a contagem e o botão leem o mesmo total (14).
      await expect(p.getByTestId("imoveis-contagem")).toHaveText("Mostrando 12 de 14 imóveis");
      await expect(mais).toHaveText("Mostrar mais 2");
      await mais.click();
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(14);
      await expect(p.getByTestId("imoveis-contagem")).toHaveText("14 imóveis");
      await expect(mais).toHaveCount(0);

      // Aba Ativos: só o ativo.
      await p.getByTestId("imoveis-aba-active").click();
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(1);
      await expect(p.getByTestId("meu-anuncio")).toContainText(ATIVO);

      // Busca (em Todos): pelo nome; sem resultado, o aviso.
      await p.getByTestId("imoveis-aba-todos").click();
      await p.getByTestId("imoveis-busca").fill("Rascunho 07");
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(1);
      await p.getByTestId("imoveis-busca").fill("nada-com-esse-nome");
      await expect(p.getByTestId("imoveis-sem-resultado")).toBeVisible();
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(0);

      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.getByTestId("imoveis-busca").fill("");
      await p.screenshot({ path: `tests/laboratorio/saida/t907-lista-${w}.png` });
      await ctx.close();
    });
  }
});
