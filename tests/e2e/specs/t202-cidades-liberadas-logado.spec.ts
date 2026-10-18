import { test, expect } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/**
 * T202 — cidades liberadas COM LOGIN (ordem b0d6365f, sobre a 335b4064; o t196 cobre só o visitante). Laboratório.
 * Cidade de teste: Anápolis – GO (fechada; nenhum outro spec a usa, então liberar aqui não atrapalha o t196, que usa Goiânia).
 *  1. Dono publica imóvel em cidade fechada → recusado NO SERVIDOR (o imóvel segue rascunho) e o interesse dele (proprietário) é gravado.
 *  2. Inquilino busca a cidade em /buscar → convite → "Avisem-me" grava o interesse (inquilino).
 *  3. Admin vê o ranking proprietário × inquilino em /admin/cidades e libera a cidade.
 *  4. O mesmo dono publica de novo → publicado.
 * 390 px (fluxo todo); a tela do admin também a 1280 px, sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = "Anápolis";
const CHAVE = "anapolis";
const dono = { email: `dono.cidade.${sufixo}@lab.vivanomads.test`, nome: "Daniela Dona de Anápolis", role: "owner" as const };
const inquilino = { email: `inq.cidade.${sufixo}@lab.vivanomads.test`, nome: "Iara Inquilina de Anápolis", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; imovel?: string } = {};

const semRolagemLateral = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function limparCidade(): Promise<void> {
  await adm().from("interesse_cidade").delete().eq("uf", "GO").eq("chave", CHAVE);
  await adm().from("cidades_liberadas").delete().eq("uf", "GO").eq("chave", CHAVE);
}

test.describe("T202 — Cidades liberadas com login", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await limparCidade();
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio em ${CIDADE} do teste ${sufixo}`);
    const { error } = await adm().from("properties").update({ city: CIDADE, state: "GO" }).eq("id", ids.imovel);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await limparCidade();
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("dono em cidade fechada: o servidor recusa, o imóvel segue rascunho e o interesse dele é gravado", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await publicarPeloEditor(page, ids.imovel!);
    await expect(page.getByText(new RegExp(`A Viva ainda não chegou em ${CIDADE}`))).toBeVisible({ timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("draft");
    const { data } = await adm().from("interesse_cidade").select("papel, uf, chave").eq("user_id", ids.dono!);
    expect(data).toEqual([{ papel: "proprietario", uf: "GO", chave: CHAVE }]);
    expect(await semRolagemLateral(page)).toBe(true);
    await page.context().close();
  });

  test("inquilino busca a cidade fechada em /buscar, vê o convite e deixa o interesse", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await page.locator('input:visible[placeholder*="Cidade"]').first().fill(CIDADE);
    const convite = page.getByTestId("convite-cidade");
    await expect(convite).toContainText(`A Viva ainda não chegou em ${CIDADE}`, { timeout: 20_000 });
    await convite.getByTestId("convite-cidade-botao").click();
    await expect(convite).toContainText(`Anotado! Avisamos você quando a Viva chegar em ${CIDADE}.`, { timeout: 15_000 });
    const { data } = await adm().from("interesse_cidade").select("papel").eq("user_id", ids.inquilino!);
    expect(data).toEqual([{ papel: "inquilino" }]);
    expect(await semRolagemLateral(page)).toBe(true);
    await page.context().close();
  });

  test("admin vê o ranking proprietário × inquilino e libera a cidade (390 e 1280 px)", async ({ browser }) => {
    test.setTimeout(120_000);
    // O /admin exige a verificação em duas etapas (AAL2, ordem f7817f00): uma conta admin recém-criada seria mandada para
    // a ativação do 2FA. Usa a admin do laboratório, que já tem o fator TOTP verificado (storageState do global-setup).
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin/cidades", { waitUntil: "domcontentloaded" });
      const ranking = page.getByTestId("ranking-interesse");
      await expect(ranking).toContainText(`${CIDADE} – GO`, { timeout: 20_000 });
      await expect(ranking.locator("li", { hasText: `${CIDADE} – GO` })).toContainText("1 proprietário(s) · 1 inquilino(s) · 2 no total");
      expect(await semRolagemLateral(page)).toBe(true);
    }
    await page.locator("#cidade").fill(CIDADE);
    await page.locator("#uf").fill("GO");
    await page.getByLabel(/Liberar já/).check();
    await page.getByRole("button", { name: "Salvar cidade" }).click();
    await expect(page.getByText(`${CIDADE} liberada.`)).toBeVisible({ timeout: 15_000 });
    const { data } = await adm().from("cidades_liberadas").select("liberada").eq("uf", "GO").eq("chave", CHAVE).single();
    expect(data?.liberada).toBe(true);
    await ctx.close();
  });

  test("cidade liberada: o mesmo dono publica e o anúncio fica no ar", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await publicarPeloEditor(page, ids.imovel!);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    await page.context().close();
  });
});
