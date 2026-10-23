import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T318 — PAPEL-B: papel ativo com fonte única (profiles.papel_ativo) e troca explícita.
 *   1. troca pela Conta ("Usar este") grava, leva ao painel, sobrevive a recarregar e a outro aparelho (390 e 1280);
 *   2. uma sessão percorre as páginas do painel: o selo e a barra sempre batem com a página; páginas comuns mantêm o
 *      papel; abrir /dashboard/imoveis como morador troca para Proprietário e GRAVA;
 *   3. intenção salva depois na Conta não muda o papel ativo.
 * O menu do selo do topo (TrocaPapel) entra quando a Pista A trocar o link do PapelAtivo pelo componente (pedido no PR).
 */
const SAIDA = "tests/laboratorio/saida";

test.describe("T318 — papel ativo com fonte única (PAPEL-B)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const conta = { email: `papel.t318.${novoSufixo()}@lab.vivanomads.test`, nome: "Paula Dois Papéis", role: "tenant" as const };
  const ids: Record<string, string> = {};

  const gravado = async () => (await adm().from("profiles").select("papel_ativo").eq("id", ids.conta).single()).data?.papel_ativo ?? null;
  const selo = (p: Page) => p.locator('[data-testid="papel-ativo"]').filter({ visible: true }).first();

  async function abrir(browser: Browser, largura: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: largura, height: largura < 500 ? 844 : 900 });
    return p;
  }

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    // Morador e proprietário na mesma conta: tem um anúncio publicado.
    ids.imovel = await criarImovelPronto(ids.conta, `Studio t318 ${novoSufixo()}`, { ativo: true });
    await adm().from("profiles").update({ papel_ativo: "morador", preferred_mode: "tenant" }).eq("id", ids.conta);
  });

  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const largura of [390, 1280]) {
    test(`1. troca pela Conta grava, leva ao painel e sobrevive a recarregar e a outro aparelho (${largura})`, async ({ browser }) => {
      test.setTimeout(120_000);
      const alvo = largura === 390 ? "proprietario" : "morador";
      if (largura === 1280) await adm().from("profiles").update({ papel_ativo: "proprietario", preferred_mode: "owner" }).eq("id", ids.conta);
      const p = await abrir(browser, largura);
      await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const papeis = p.getByTestId("seus-papeis").filter({ visible: true });
      await expect(papeis.getByRole("heading", { name: "Papéis e intenção" })).toBeVisible({ timeout: 20_000 });
      await expect(papeis.getByTestId(`usar-papel-${alvo}`)).toBeVisible({ timeout: 20_000 });
      await p.screenshot({ path: `${SAIDA}/t318-conta-papeis-${largura}.png`, fullPage: true });
      await papeis.getByTestId(`usar-papel-${alvo}`).click();
      await expect.poll(gravado, { timeout: 20_000 }).toBe(alvo);
      await p.waitForURL((u) => u.pathname === "/dashboard", { timeout: 20_000 });
      await expect(selo(p)).toHaveAttribute("data-papel", alvo, { timeout: 15_000 });
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(selo(p)).toHaveAttribute("data-papel", alvo, { timeout: 15_000 });
      await p.context().close();
      // Outro aparelho (contexto novo, sem nada guardado): o mesmo papel.
      const outro = await abrir(browser, largura);
      await outro.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(selo(outro)).toHaveAttribute("data-papel", alvo, { timeout: 20_000 });
      await outro.context().close();
    });
  }

  test("2. selo = barra = página numa sessão; página de outra área troca e grava; comuns mantêm", async ({ browser }) => {
    test.setTimeout(180_000);
    await adm().from("profiles").update({ papel_ativo: "morador", preferred_mode: "tenant" }).eq("id", ids.conta);
    const p = await abrir(browser, 390);
    const roteiro: [string, "morador" | "proprietario"][] = [
      ["/dashboard", "morador"],
      ["/dashboard/favoritos", "morador"],
      ["/dashboard/mensagens", "morador"],
      ["/dashboard/imoveis", "proprietario"], // morador abrindo tela de dono: troca e grava
      ["/dashboard", "proprietario"],
      ["/dashboard/mensagens", "proprietario"],
      ["/dashboard/conta", "proprietario"],
      ["/dashboard/buscas", "morador"],
      ["/dashboard", "morador"],
    ];
    for (const [rota, papel] of roteiro) {
      await p.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(selo(p), rota).toHaveAttribute("data-papel", papel, { timeout: 20_000 });
      const barra = p.locator("nav[data-papel]").filter({ visible: true });
      if (await barra.count()) await expect(barra.first(), rota).toHaveAttribute("data-papel", papel);
      if (rota === "/dashboard/imoveis") {
        await expect.poll(gravado, { timeout: 20_000 }).toBe("proprietario");
        await p.screenshot({ path: `${SAIDA}/t318-imoveis-troca-390.png` });
      }
    }
    await expect.poll(gravado, { timeout: 20_000 }).toBe("morador");
    await p.context().close();
  });

  test("3. intenção salva depois não muda o papel ativo", async ({ browser }) => {
    test.setTimeout(120_000);
    await adm().from("profiles").update({ papel_ativo: "proprietario", preferred_mode: "owner", intencao: ["anunciar"] }).eq("id", ids.conta);
    const p = await abrir(browser, 1280);
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    const intencao = p.getByTestId("minha-intencao").filter({ visible: true });
    await expect(intencao.getByTestId("intencao-morar")).toBeVisible({ timeout: 20_000 });
    await intencao.getByTestId("intencao-anunciar").click();
    await intencao.getByTestId("intencao-morar").click();
    await intencao.getByRole("button", { name: /Salvar/ }).click();
    await expect.poll(async () => (await adm().from("profiles").select("intencao").eq("id", ids.conta).single()).data?.intencao, { timeout: 15_000 }).toEqual(["morar"]);
    expect(await gravado()).toBe("proprietario");
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(selo(p)).toHaveAttribute("data-papel", "proprietario", { timeout: 15_000 });
    await p.context().close();
  });
});
