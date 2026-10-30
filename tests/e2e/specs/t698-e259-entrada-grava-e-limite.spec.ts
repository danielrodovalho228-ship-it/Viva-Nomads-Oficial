import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T698 — E259, o que as specs da Pista A (t687, t690, t692) não gravam nem leem de volta. Pista C, 30/10.
   1. #1583 (2): a entrada respondida no editor GRAVA e a página pública lê dela. "Fechadura com código" + "A senha é
      trocada antes de cada nova estadia" → tipo_entrada, tipo_acesso derivado ("fechadura_senha") e a senha no banco;
      no anúncio, "Acesso: Fechadura com código" e a linha da senha (390 e 1280). Trocar para "Porteiro ou recepção"
      tira a linha da senha do anúncio (ela só vale com a fechadura), mesmo com a senha ainda gravada.
   2. #1586 (4): com o limite diário do preenchimento automático já usado, o Passo 2 diz o que continua — "título,
      descrição e números ficam para você" e "As comodidades vistas nas fotos continuam aparecendo no Passo 5" — e não
      oferece "Tentar de novo" (390 e 1280). O limite é semeado direto em limites_uso, na chave da própria conta.
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);
const IA_LIMITE_DIA = 10;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t698.${sufixo}@lab.vivanomads.test`, nome: "Rui Fechadura", role: "owner" as const };
const ids: Record<string, string> = {};

async function lerEntrada() {
  const { data, error } = await adm().from("properties").select("tipo_entrada, tipo_acesso, senha_trocada_estadia").eq("id", ids.imovel).single();
  if (error) throw error;
  return data as { tipo_entrada: string | null; tipo_acesso: string | null; senha_trocada_estadia: boolean | null };
}

test.describe("T698 — E259: a entrada grava e o anúncio lê; o limite do preenchimento diz o que continua", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Fechadura ${sufixo}`, { ativo: true });
    for (const w of [1280, 390]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Limite ${w} ${sufixo}`, {}, 0);
  });
  test.afterAll(async () => {
    await adm().from("limites_uso").delete().eq("chave", `ia:user:${ids.dono}`);
    await apagarContas([ids.dono]);
  });

  async function salvarEntrada(browser: import("@playwright/test").Browser, entrada: string, senhaTrocada: boolean) {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    const secao = page.getByTestId("secao-regras");
    await expect(secao).toBeVisible({ timeout: 30_000 });
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.locator("button").first().click();
    await secao.getByTestId(`tipo-entrada-${entrada}`).click({ timeout: 20_000 });
    await expect(secao.getByTestId(`tipo-entrada-${entrada}`)).toHaveAttribute("aria-checked", "true");
    if (entrada === "fechadura_com_codigo") {
      const s = secao.getByTestId("senha-trocada");
      await expect(s).toBeVisible();
      if ((await s.getAttribute("aria-checked")) !== String(senhaTrocada)) await s.click();
      await expect(s).toHaveAttribute("aria-checked", String(senhaTrocada));
    } else {
      await expect(secao.getByTestId("senha-trocada")).toHaveCount(0);
    }
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 30_000 });
    await page.context().close();
  }

  async function blocoPublico(browser: import("@playwright/test").Browser, w: number) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });
    const p = await ctx.newPage();
    await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const bloco = p.getByTestId("bloco-privacidade");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    return { p, ctx, bloco };
  }

  test("1a. editor: fechadura com código + senha trocada gravam; tipo_acesso sai da resposta do Passo 6", async ({ browser }) => {
    await salvarEntrada(browser, "fechadura_com_codigo", true);
    await expect.poll(lerEntrada, { timeout: 30_000 }).toEqual({ tipo_entrada: "fechadura_com_codigo", tipo_acesso: "fechadura_senha", senha_trocada_estadia: true });
  });

  for (const w of [1280, 390] as const) {
    test(`1b. ${w} px — o anúncio mostra o acesso e a senha trocada`, async ({ browser }) => {
      const { p, ctx, bloco } = await blocoPublico(browser, w);
      await expect(bloco).toContainText("Acesso: Fechadura com código");
      await expect(bloco).toContainText("A senha é trocada antes de cada nova estadia");
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t698-1-fechadura-${w}.png` });
      await ctx.close();
    });
  }

  test("1c. trocar para porteiro: o anúncio mostra o porteiro e tira a linha da senha (390 e 1280)", async ({ browser }) => {
    await salvarEntrada(browser, "porteiro", false);
    await expect.poll(async () => (await lerEntrada()).tipo_entrada, { timeout: 30_000 }).toBe("porteiro");
    for (const w of [1280, 390]) {
      const { p, ctx, bloco } = await blocoPublico(browser, w);
      await expect(bloco).toContainText("Acesso: Porteiro ou recepção", { timeout: 30_000 });
      await expect(bloco).not.toContainText("Fechadura com código");
      await expect(bloco).not.toContainText("A senha é trocada");
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t698-1-porteiro-${w}.png` });
      await ctx.close();
    }
  });

  test("2. limite do preenchimento: semeado na chave da conta", async () => {
    const linhas = Array.from({ length: IA_LIMITE_DIA }, () => ({ chave: `ia:user:${ids.dono}` }));
    const { error } = await adm().from("limites_uso").insert(linhas);
    if (error) throw error;
  });

  for (const w of [1280, 390] as const) {
    test(`2. ${w} px — Passo 2 com o limite usado: diz o que continua e não oferece "Tentar de novo"`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids[`r${w}`], "fotos", w);
      await expect(p.getByTestId("fotos-contagem-numero")).toHaveText("0", { timeout: 30_000 });
      await p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
      await expect(p.getByTestId("fotos-contagem-numero")).toHaveText("8", { timeout: 90_000 });
      const falha = p.getByTestId("ia-fotos-falha");
      await expect(falha).toBeVisible({ timeout: 60_000 });
      await expect(falha).toHaveAttribute("data-motivo", "limite");
      await expect(falha).toContainText(`Limite de ${IA_LIMITE_DIA} preenchimentos automáticos por dia atingido`);
      await expect(falha).toContainText("título, descrição e números ficam para você nas próximas etapas");
      await expect(falha).toContainText("As comodidades vistas nas fotos continuam aparecendo no Passo 5.");
      await expect(p.getByTestId("ia-fotos-tentar-de-novo")).toHaveCount(0);
      await falha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t698-2-limite-${w}.png` });
      await p.context().close();
    });
  }
});
