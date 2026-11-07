import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1351 — E414 (#3025, na main): quando a medição de internet NÃO conclui, ela não trava o cadastro nem marca o imóvel.
  O servidor devolve a falha (simulada aqui na resposta de /api/internet/medicoes, porque no laboratório o motor é simulado
  e sempre conclui): a tela mostra o motivo (medir-internet-erro), o botão passa a "Tentar de novo", aparece "Nada foi
  registrado no imóvel… medir depois" (medir-internet-depois), nenhuma medição fica gravada e o resto da página segue
  utilizável. Edição do imóvel pelo dono, 390 e 1280 px, sem estouro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1351.${sufixo}@lab.vivanomads.test`, nome: "Iris Internet Falha", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 };

test.describe("T1351 — E414: a medição que falha não trava o cadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Internet falha ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).eq("id", ids.imovel);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (ids.imovel) await adm().from("internet_medicoes").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: falha → motivo, "Tentar de novo", "medir depois" e nada gravado`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.context().grantPermissions(["geolocation"]);
      await page.context().setGeolocation(PERTO);
      await page.route("**/api/internet/medicoes", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, erro: "Não conseguimos medir agora: a conexão com o servidor de teste falhou. Tente de novo." }) });
      });
      await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Comodidades/ }).click();
      const bloco = page.getByTestId("medir-internet");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await bloco.getByTestId("medir-internet-ponto-quarto_principal").click();
      await bloco.getByTestId("medir-internet-wifi").check();
      await bloco.getByTestId("medir-internet-botao").click();
      await expect(bloco.getByTestId("medir-internet-erro")).toContainText("Tente de novo", { timeout: 45_000 });
      await expect(bloco.getByTestId("medir-internet-botao")).toContainText("Tentar de novo");
      await expect(bloco.getByTestId("medir-internet-botao")).toBeEnabled();
      await expect(bloco.getByTestId("medir-internet-depois")).toContainText("Nada foi registrado no imóvel");
      await expect(bloco.getByTestId("medir-internet-resultado")).toHaveCount(0);
      const { data } = await adm().from("internet_medicoes").select("id").eq("property_id", ids.imovel!);
      expect(data ?? [], "a falha não grava medição").toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
