import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T94 — Valor pet no anúncio (ordem 0a746da1, parte 1): o dono informa "Valor pet" (Caução pet reembolsável
 * ou Taxa pet não reembolsável); o anúncio mostra o valor; sem valor ou sem pet, nada aparece.
 * Um imóvel por cenário: a página do anúncio é cacheada por 60 s.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.pet94.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: { dono?: string; taxa?: string; caucao?: string; semValor?: string; semPet?: string } = {};
const regras = (extra: Record<string, unknown>) => ({
  especies: ["cao", "gato"], porteMax: "M", qtdMax: 2, valorPet: 0, valorPetTipo: "reembolsavel", regrasCondominio: "", ...extra,
});

test.describe("T94 — Valor pet no anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const criar = async (titulo: string, petsAllowed: boolean, r: Record<string, unknown> | null) => {
      const id = await criarImovelPronto(ids.dono!, `${titulo} ${sufixo}`, { ativo: true });
      const { error } = await adm().from("properties").update({ pets_allowed: petsAllowed, pets_regras: r }).eq("id", id);
      expect(error).toBeNull();
      return id;
    };
    ids.taxa = await criar("Studio Taxa Pet", true, regras({ valorPet: 300, valorPetTipo: "nao_reembolsavel" }));
    ids.caucao = await criar("Studio Caução Pet", true, regras({ valorPet: 450, valorPetTipo: "reembolsavel" }));
    ids.semValor = await criar("Studio Sem Valor Pet", true, regras({}));
    ids.semPet = await criar("Studio Sem Pet", false, null);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. Taxa pet: anúncio diz que não é reembolsável", async ({ page }) => {
    await page.goto(`/imoveis/${ids.taxa}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Taxa pet R$ 300,00 — não reembolsável").first()).toBeVisible({ timeout: 20_000 });
  });

  test("2. Caução pet: anúncio diz que é devolvida no fim", async ({ page }) => {
    await page.goto(`/imoveis/${ids.caucao}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Caução pet R$ 450,00 — devolvida no fim").first()).toBeVisible({ timeout: 20_000 });
  });

  test("3. sem valor pet ou sem pet: nada de valor pet no anúncio", async ({ page }) => {
    for (const id of [ids.semValor, ids.semPet]) {
      await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
      await expect(page.locator("body")).toContainText("Studio");
      await expect(page.getByText(/(Taxa|Caução) pet R\$/)).toHaveCount(0);
    }
  });

  test("4. editor do dono: campo Valor pet e escolha reembolsável/não reembolsável, sem rolagem lateral a 390 px", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/imoveis/${ids.taxa}/editar`, { waitUntil: "networkidle" });
    const campo = page.getByTestId("valor-pet");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    await expect(campo).toHaveValue("300");
    await expect(page.getByTestId("valor-pet-tipo")).toHaveValue("nao_reembolsavel");
    // Campo único: o antigo "Reforço de Caução" não aparece mais ao lado.
    await expect(page.getByText(/Reforço de Caução/)).toHaveCount(0);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(largura).toBeLessThanOrEqual(0);
    await page.context().close();
  });
});
