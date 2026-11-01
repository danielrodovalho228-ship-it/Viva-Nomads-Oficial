import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T960 — E397 (regressão, ordem do Daniel 01/11): o pet NUNCA entra em candidatura de imóvel que não aceita animais.
 * Morador com um pet cadastrado; anúncio com pets_allowed = false. Pela tela real, 390 e 1280:
 *   1. no anúncio, o bloco "pets que vão junto" da candidatura (pet-candidatura) não aparece e o nome do pet não está
 *      na página;
 *   2. em Interessados do dono, o cartão da candidatura desse morador (#candidato-<lead>) não traz a ficha do pet
 *      (ficha-pet-candidatura) nem o nome do pet.
 * Contraprova (mesmo morador e pet, anúncio que ACEITA animais): o bloco e a ficha aparecem — a regra é do anúncio,
 * não um sumiço geral do pet.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t960.${sufixo}@lab.vivanomads.test`, nome: "Dora Sem Pets", role: "owner" as const };
const mor = { email: `mor.t960.${sufixo}@lab.vivanomads.test`, nome: "Mauro Com Cão", role: "tenant" as const };
const ids: Record<string, string> = {};
const PET = `Bidu${sufixo}`;
const LARGURAS = [390, 1280] as const;

test.describe("T960 — E397: pet nunca entra em candidatura de imóvel que não aceita animais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Sem "serial": o caso do dono roda mesmo com o do morador vermelho.
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    const { error } = await adm().from("pets_inquilino").insert({ user_id: ids.mor, nome: PET, especie: "cao", porte: "M", idade_anos: 4, castrado: true, vacinas_em_dia: true });
    if (error) throw error;
    ids.semPets = await criarImovelPronto(ids.dono, `Studio Sem Animais t960 ${sufixo}`, { ativo: true });
    ids.comPets = await criarImovelPronto(ids.dono, `Studio Aceita Pets t960 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ pets_allowed: false, pets_regras: null }).eq("id", ids.semPets);
    await adm()
      .from("properties")
      .update({ pets_allowed: true, pets_regras: { especies: ["cao", "gato"], porteMax: "G", qtdMax: 2, reforcoCaucao: 0, regrasCondominio: "" } })
      .eq("id", ids.comPets);
    ids.leadSem = await criarLead(ids.dono, ids.mor, ids.semPets);
    ids.leadCom = await criarLead(ids.dono, ids.mor, ids.comPets);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("pets_inquilino").delete().eq("user_id", ids.mor ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.mor, ids.dono]);
  });

  test("morador: o anúncio sem animais não leva o pet; o que aceita mostra (390 e 1280)", async ({ browser }) => {
    // E397 (aberto, aguardando o PR da correção): no anúncio com pets_allowed = false o bloco "pet-candidatura" aparece com
    // o pet (lab do #2085, run 41354306315: Expected 0, Received 1; a contraprova no anúncio que aceita passou). Quem
    // mergear a correção do E397 tira este test.fail no mesmo PR — ou a Pista C tira no merge.
    test.fail(true, "E397: o pet entra na candidatura do anúncio que não aceita animais (bloco pet-candidatura aparece)");
    const page = await entrar(browser, mor.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.comPets}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pet-candidatura").first(), "contraprova: anúncio que aceita animais").toContainText(PET, { timeout: 30_000 });

      await page.goto(`/imoveis/${ids.semPets}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Studio Sem Animais t960", { timeout: 30_000 });
      await expect(page.getByTestId("pet-candidatura")).toHaveCount(0);
      expect(await page.locator("body").innerText(), "o nome do pet não aparece no anúncio sem animais").not.toContain(PET);
    }
    await page.context().close();
  });

  test("dono: em Interessados a candidatura do anúncio sem animais não traz o pet (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      // Um cartão por candidatura (#candidato-<lead>): a do anúncio que aceita traz a ficha; a do sem animais, não.
      const com = page.locator(`#candidato-${ids.leadCom}`);
      const sem = page.locator(`#candidato-${ids.leadSem}`);
      await expect(com.getByTestId("ficha-pet-candidatura"), "contraprova: candidatura do anúncio que aceita").toBeVisible({ timeout: 30_000 });
      await expect(sem.getByTestId("candidato-nome")).toBeVisible();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(sem.getByTestId("ficha-pet-candidatura")).toHaveCount(0);
      await expect(sem, "o nome do pet não aparece na candidatura do anúncio sem animais").not.toContainText(PET);
    }
    await page.context().close();
  });
});
