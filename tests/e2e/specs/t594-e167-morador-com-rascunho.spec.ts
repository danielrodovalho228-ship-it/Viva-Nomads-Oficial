import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T594 — E167 (reteste do Muse, 28/10), no formato da conta do QA (inquilino1): cadastro de MORADOR com UM RASCUNHO de
  anúncio e nenhum imóvel ativo, papel morador gravado (preferred_mode = tenant, papel_ativo = morador). O T540 cobre a
  conta dona com anúncio ativo; este cobre o rascunho, que alimenta o checklist "Para publicar seu anúncio".
   1. 1280 e 390, papel morador: o Início é só do morador — sem "Para publicar seu anúncio", sem "Como proprietário",
      sem o Início do dono, sem barra lateral; abas/barra de baixo do morador.
   2. Simétrico, papel proprietário: o Início do dono, sem os blocos do morador.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `mor.t594.${sufixo}@lab.vivanomads.test`, nome: "Iara Rascunho", role: "tenant" as const };
const ids: Record<string, string> = {};
const MORADOR_5 = ["Início", "Buscar", "Pedidos", "Mensagens", "Estadia"];
const SAIDA = "tests/laboratorio/saida";

const papel = (preferred_mode: "tenant" | "owner", papel_ativo: "morador" | "proprietario") =>
  adm().from("profiles").update({ preferred_mode, papel_ativo }).eq("id", ids.conta);

async function abrirInicio(browser: import("@playwright/test").Browser, w: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, conta.email, senha);
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  return page;
}

test.describe("T594 — E167: morador com rascunho de anúncio, Início e navegação só do papel ativo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    ids.rascunho = await criarImovelPronto(ids.conta, `Rascunho do morador t594 ${sufixo}`, { ativo: false });
    const { error } = await papel("tenant", "morador");
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — papel morador: sem checklist nem blocos de dono, navegação do morador`, async ({ browser }) => {
      const page = await abrirInicio(browser, w);
      await expect(page.getByTestId("inicio-so-morador")).toBeVisible({ timeout: 30_000 });
      if (w === 1280) {
        await expect(page.getByTestId("abas-morador").locator("a")).toHaveText(MORADOR_5, { timeout: 30_000 });
        await expect(page.getByTestId("abas-dono")).toHaveCount(0);
      } else {
        const barra = page.getByRole("navigation", { name: "Navegação principal" });
        await expect.poll(async () => (await barra.locator("a").allInnerTexts()).map((t) => t.trim()), { timeout: 30_000 }).toEqual(MORADOR_5);
      }
      await expect(page.getByTestId("barra-lateral")).toHaveCount(0);
      await expect(page.getByText("Para publicar seu anúncio")).toHaveCount(0);
      await expect(page.getByText("Como proprietário")).toHaveCount(0);
      await expect(page.getByTestId("inicio-proprietario")).toHaveCount(0);
      await expect(page.getByTestId("inicio-dono")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t594-morador-${w}.png`, fullPage: true });
      await page.context().close();
    });
  }

  test("1280 e 390 — papel proprietário (simétrico): Início do dono, sem os blocos do morador", async ({ browser }) => {
    const { error } = await papel("owner", "proprietario");
    if (error) throw error;
    for (const w of [1280, 390] as const) {
      const page = await abrirInicio(browser, w);
      await expect(page.getByTestId("inicio-dono")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("inicio-so-morador")).toHaveCount(0);
      await expect(page.getByTestId("inicio-morador")).toHaveCount(0);
      await expect(page.getByText("Como morador")).toHaveCount(0);
      await expect(page.getByTestId("barra-lateral")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t594-dono-${w}.png`, fullPage: true });
      await page.context().close();
    }
  });
});
