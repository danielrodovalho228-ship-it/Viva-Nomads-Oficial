import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2227 — E1106 (ORDEM-DUET-485; ensaio de tela do selo, Pista 3) @E1106 — só no laboratório (chave de serviço).
  A conferência manual da equipa (profiles.is_verified, gravada pelo servidor) é insumo da fonte única da identidade:
  o dono conferido mostra, no bloco do dono da página do imóvel, UM selo só — "Conferida pela equipe da Viva", o texto
  do estado `conferida_equipe` — e nunca o antigo "Dono verificado". O dono sem conferência (e sem laudo) não ganha selo.
  Dois donos novos, cada um com o seu anúncio, para nenhum cache de página misturar os dois estados.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conferido = { email: `dono.conf.t2227.${sufixo}@lab.vivanomads.test`, nome: "Clara Conferida", role: "owner" as const };
const semConf = { email: `dono.sem.t2227.${sufixo}@lab.vivanomads.test`, nome: "Sara Semconf", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2227 — E1106: o selo 'Conferida pela equipe da Viva' no bloco do dono @E1106", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.conferido = await criarConta(conferido, senha);
    ids.semConf = await criarConta(semConf, senha);
    // A conferência da equipa, gravada como o servidor grava (só a chave de serviço passa pelo gatilho de confiança).
    const u = await adm().from("profiles").update({ is_verified: true }).eq("id", ids.conferido).select("is_verified").single();
    if (u.error) throw u.error;
    expect(u.data.is_verified).toBe(true);
    // Nenhum laudo para os dois: o que decide é só a conferência da equipa.
    const l = await adm().from("tenant_verifications").select("id").in("tenant_id", [ids.conferido, ids.semConf]);
    expect(l.data ?? []).toHaveLength(0);
    ids.imovelConferido = await criarImovelPronto(ids.conferido, `Studio da Clara ${sufixo}`, { ativo: true });
    ids.imovelSemConf = await criarImovelPronto(ids.semConf, `Studio da Sara ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.conferido, ids.semConf].filter(Boolean));
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — dono conferido pela equipa: o selo da fonte, um só, nunca "Dono verificado"`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovelConferido}`, { waitUntil: "domcontentloaded" });
      const bloco = page.locator("section[aria-labelledby='proprietario-title']");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco.getByTestId("selo-identidade-dono")).toHaveCount(1, { timeout: 30_000 });
      await expect(bloco.getByTestId("selo-identidade-dono")).toHaveText("Conferida pela equipe da Viva");
      await expect(bloco.getByTestId("selo-dono-verificado")).toHaveCount(0);
      await expect(bloco).not.toContainText(/Dono verificado/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });

    test(`${largura} px — dono sem conferência e sem laudo: nenhum selo de identidade`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovelSemConf}`, { waitUntil: "domcontentloaded" });
      const bloco = page.locator("section[aria-labelledby='proprietario-title']");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco).toContainText("Sara", { timeout: 30_000 });
      await expect(bloco.getByTestId("selo-identidade-dono")).toHaveCount(0);
      await expect(bloco).not.toContainText("Conferida pela equipe da Viva");
      await expect(bloco).not.toContainText(/Dono verificado/i);
    });
  }
});
