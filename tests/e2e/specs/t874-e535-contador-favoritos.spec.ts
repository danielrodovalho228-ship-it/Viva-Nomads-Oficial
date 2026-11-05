import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T874 — E535: o cartão "Favoritos" do painel não oscila entre cargas. Morador com 1 favorito salvo NA CONTA; o painel
 * é aberto 3 vezes, cada uma num aparelho novo (sem cache nem lista local). Em cada carga, todos os valores que o
 * cartão mostrou até estabilizar são lidos: nunca "0"; antes de pronto, "—"; no fim, "1" — o mesmo da página Favoritos.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t874.${sufixo}@lab.vivanomads.test`, nome: "Dora Favoritos", role: "owner" as const };
const morador = { email: `mor.t874.${sufixo}@lab.vivanomads.test`, nome: "Mira Favoritos", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};

test.describe("T874 — E535: contador de Favoritos estável", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Favorito T874 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("favorites").insert({ tenant_id: ids.morador, property_id: ids.imovel });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("favorites").delete().eq("tenant_id", ids.morador!);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("3 cargas em aparelhos novos: nunca '0', sempre termina em '1'", async ({ browser }) => {
    test.setTimeout(180_000);
    for (let carga = 1; carga <= 3; carga++) {
      const page = await entrar(browser, morador.email, senha);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("inicio-morador-kpis").getByRole("link", { name: /Favoritos/ });
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      const vistos: string[] = [];
      await expect(async () => {
        const v = ((await cartao.innerText()).match(/\d+|—/) ?? [""])[0];
        vistos.push(v);
        expect(v).toBe("1");
      }).toPass({ timeout: 30_000, intervals: [100, 200, 300] });
      expect(vistos, `carga ${carga}: ${vistos.join(",")}`).not.toContain("0");
      await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toContainText(`Favorito T874 ${sufixo}`, { timeout: 30_000 });
      await page.context().close();
    }
  });
});
