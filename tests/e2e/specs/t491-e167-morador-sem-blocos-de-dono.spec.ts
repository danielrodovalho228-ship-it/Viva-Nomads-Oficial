import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T491 — E167, guarda permanente da Pista C: a área do MORADOR não mistura o painel do dono. Conta única que também é
  proprietária (um anúncio ativo), com o papel MORADOR ativo (profiles.preferred_mode = tenant, papel_ativo = morador,
  o mesmo que a troca pelo selo grava):
   1. 1280 e 390: o Início do morador não mostra blocos de proprietário (seção "Como proprietário", anúncios,
      recebimentos, ferramentas do dono);
   2. 1280: a barra lateral do morador não tem itens de dono ("Meus imóveis", "Contratos e garantias", "Ferramentas")
      e tem a entrada "Minha estadia".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `dupla.t491.${sufixo}@lab.vivanomads.test`, nome: "Duda Dupla", role: "owner" as const };
const ids: Record<string, string> = {};
const ITENS_DE_DONO = ["Meus imóveis", "Contratos e garantias", "Ferramentas"];

test.describe("T491 — E167: o papel morador sem blocos nem menus de dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    ids.imovel = await criarImovelPronto(ids.conta, `Studio do dono-morador t491 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const w of [1280, 390] as const) {
    test(`1. a ${w} px: o Início do morador sem blocos de proprietário`, async ({ browser }) => {
      // E167 (Pista A): com o papel morador ativo, o Início ainda monta a seção "Como proprietário" para quem tem imóvel
      // (visao-geral-client.tsx: ehDono → inicio-proprietario; só o modo owner troca de Início). lab-crítico 40211777060
      // (tentativa 2): inicio-proprietario = 1 com data-papel="morador". Quem corrigir tira este test.fail.
      test.fail(true, "E167: o Início do morador mostra a seção 'Como proprietário'");
      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      // Confere que o papel ativo é mesmo morador (senão o teste não diz nada sobre o E167).
      await expect(page.getByTestId("papel-ativo").first()).toHaveAttribute("data-papel", "morador", { timeout: 30_000 });
      await expect(page.getByTestId("inicio-morador")).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: `tests/laboratorio/saida/t491-inicio-morador-${w}.png`, fullPage: true });
      await expect(page.getByTestId("inicio-proprietario"), "seção 'Como proprietário' no Início do morador").toHaveCount(0);
      await expect(page.getByTestId("inicio-dono")).toHaveCount(0);
      await page.context().close();
    });
  }

  test("2. a 1280 px: a barra lateral do morador sem itens de dono e com 'Minha estadia'", async ({ browser }) => {
    // E167 (Pista A): as seções de dono entram no menu para quem tem imóvel mesmo com o papel morador ativo,
    // "Ferramentas" é de todos os papéis (config/menu-por-papel.ts) e a estadia se chama "Locações". lab-crítico
    // 40215697341: barra = ["Visão geral","Minha moradia","Mensagens","Meus imóveis","Contratos e garantias",
    // "Ferramentas","Minha conta"], sem "Minha estadia". Quem corrigir tira este test.fail.
    test.fail(true, "E167: a barra do morador tem 'Ferramentas' e não tem 'Minha estadia'");
    const page = await entrar(browser, conta.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("papel-ativo").first()).toHaveAttribute("data-papel", "morador", { timeout: 30_000 });
    const barra = page.getByTestId("barra-lateral");
    await expect(barra).toBeVisible({ timeout: 30_000 });
    const topo = (await barra.locator('[data-testid="menu-cascata"] > li').allInnerTexts()).map((t) => t.split("\n")[0].trim());
    console.log(`t491 barra do morador: ${JSON.stringify(topo)}`);
    const deDono = topo.filter((t) => ITENS_DE_DONO.includes(t));
    expect(deDono, `itens de dono na barra do morador: ${JSON.stringify(topo)}`).toEqual([]);
    await expect(barra.getByText("Minha estadia", { exact: true }), `"Minha estadia" na barra: ${JSON.stringify(topo)}`).toHaveCount(1);
    await page.context().close();
  });
});
