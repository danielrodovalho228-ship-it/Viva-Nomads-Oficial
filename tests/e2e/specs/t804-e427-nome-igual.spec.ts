import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { nomeComInicial } from "../../../src/lib/visitas/nome-visita";

/*
  T804 — E427 (01/11): o nome do dono saía "Daniel P." para o morador (visita) e "Daniel 1." na página pública. Dono com
  nome terminado em número: a página pública mostra exatamente o nome que a visita mostra (nomeComInicial). 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = "Dora Prado 2";
const dono = { email: `dono.t804.${sufixo}@lab.vivanomads.test`, nome: NOME, role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T804 — E427: o mesmo nome abreviado na visita e na página pública", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ full_name: NOME }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio nome t804 ${sufixo}`, { ativo: true, preco: 2600 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: "Dora P." na página pública, igual à visita`, async ({ page }) => {
      expect(nomeComInicial(NOME)).toBe("Dora P.");
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const pagina = page.getByTestId("pagina-proprietario");
      await expect(pagina).toBeVisible({ timeout: 30_000 });
      await expect(pagina.getByRole("heading", { level: 1 })).toHaveText(nomeComInicial(NOME)!);
      await expect(pagina).not.toContainText("Dora 2.");
      await page.screenshot({ path: `tests/laboratorio/saida/t804-proprietario-${w}.png` });
    });
  }
});
