import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1660 — Ordem 75ce56db, item D (pets): o dono escolhe as exigências "Carteira de vacinação em dia" e "Foto do pet".
   1. 390 e 1280 px — editor: marcar as duas → banco guarda exigeCarteiraVacina/exigeFotoPet = true → reabrir o editor
      mostra as duas marcadas → a página pública diz "carteira de vacinação exigida · foto do pet exigida".
   2. 390 e 1280 px — dono em /dashboard/leads: o pet SEM carteira e SEM foto aparece "Fora das regras: falta a foto do
      pet e a carteira de vacinação que o anúncio exige" ANTES de aceitar; a candidatura não é bloqueada (o cartão existe).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const PET = "Bidu (teste QA)";
const dono = { email: `dono.t1660.${sufixo}@lab.vivanomads.test`, nome: "Dora Exige Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1660.${sufixo}@lab.vivanomads.test`, nome: "Ivo Semficha Sobrenome", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const LARGURAS = [1280, 390] as const;
const TITULO = (l: number) => `Studio exige ficha ${l} ${sufixo}`;

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function regras(id: string) {
  return (await adm().from("properties").select("pets_regras").eq("id", id).single()).data?.pets_regras as Record<string, unknown> | null;
}

test.describe("T1660 — exigências de pets do dono (carteira e foto)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.inq = await criarConta(inq, senha);
    const { error } = await adm()
      .from("pets_inquilino")
      .insert({ user_id: ids.inq, nome: PET, especie: "cao", porte: "P", idade_anos: 3, castrado: true, vacinas_em_dia: false });
    expect(error).toBeNull();
    for (const l of LARGURAS) {
      ids[`imovel${l}`] = await criarImovelPronto(ids.dono, TITULO(l), { ativo: true });
      await adm().from("properties").update({ pets_allowed: true, pets_regras: null }).eq("id", ids[`imovel${l}`]);
    }
  });
  test.afterAll(async () => {
    await adm().from("leads").delete().in("id", LARGURAS.map((l) => ids[`lead${l}`]).filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of LARGURAS) {
    test(`1. ${largura} px: editor → banco → editor → página pública`, async ({ browser }) => {
      const id = ids[`imovel${largura}`]!;
      const p = await abrir(browser, dono.email, largura);
      await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("secao-regras");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button", { name: /Regras da casa/ }).click();
      const bloco = secao.getByTestId("pets-regras");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      const carteira = bloco.getByRole("checkbox", { name: "Carteira de vacinação em dia", exact: true });
      const foto = bloco.getByRole("checkbox", { name: "Foto do pet", exact: true });
      await expect(carteira).not.toBeChecked();
      await expect(foto).not.toBeChecked();
      await carteira.check();
      await foto.check();
      await bloco.getByText("O que você exige na ficha do pet?").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1660-editor-${largura}.png` });
      await secao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => await regras(id), { timeout: 20_000 }).toMatchObject({ exigeCarteiraVacina: true, exigeFotoPet: true });

      await p.reload({ waitUntil: "domcontentloaded" });
      const s2 = p.getByTestId("secao-regras");
      await expect(s2).toBeVisible({ timeout: 30_000 });
      if ((await s2.getAttribute("data-aberta")) !== "true") await s2.getByRole("button", { name: /Regras da casa/ }).click();
      const b2 = s2.getByTestId("pets-regras");
      await expect(b2.getByRole("checkbox", { name: "Carteira de vacinação em dia", exact: true })).toBeChecked({ timeout: 20_000 });
      await expect(b2.getByRole("checkbox", { name: "Foto do pet", exact: true })).toBeChecked();

      await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const animais = p.locator("#regras-da-estadia li").filter({ hasText: /^Animais/ });
      await expect(animais).toContainText("carteira de vacinação exigida · foto do pet exigida", { timeout: 20_000 });
      await semRolagemLateral(p);
      await p.context().close();
    });
  }

  for (const largura of LARGURAS) {
    test(`2. ${largura} px: o dono vê, antes de aceitar, que a ficha não cumpre as exigências`, async ({ browser }) => {
      const id = ids[`imovel${largura}`]!;
      ids[`lead${largura}`] = await criarLead(ids.dono!, ids.inq!, id);
      const p = await abrir(browser, dono.email, largura);
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("cartao-candidato").filter({ hasText: TITULO(largura) });
      await expect(cartao.getByTestId("ficha-pet-resumo")).toHaveText(`Com 1 pet · ${PET} (cão, porte pequeno)`, { timeout: 20_000 });
      await cartao.getByTestId("ver-ficha-pet").click();
      const painel = cartao.getByTestId("ficha-pet-painel");
      await expect(painel.getByTestId("ficha-pet-conferencia")).toHaveText(
        "Fora das regras: falta a foto do pet e a carteira de vacinação que o anúncio exige",
        { timeout: 20_000 },
      );
      await painel.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1660-dono-conferencia-${largura}.png` });
      await semRolagemLateral(p);
      await p.context().close();
    });
  }
});
