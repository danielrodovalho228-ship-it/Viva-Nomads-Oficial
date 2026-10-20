import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T226 — Ficha do pet para o dono da candidatura + 3 retoques do inquilino (complemento do #876, reteste do Muse),
  390 e 1280 px.
   1. inquilino: cadastra o "Totó (teste QA)"; as linhas de foto e carteira aparecem na hora (sem recarregar);
      com 3 de 3 fotos, "Máximo de 3 fotos. Remova uma para trocar."; Raça e Observações (cortadas, "ver mais");
   2. dono: "Com 1 pet · Totó (teste QA) (cão, porte médio)" no cartão → "Ver ficha do pet" → 3 fotos, carteira,
      raça, observações e "Dentro das regras: aceita cão de porte médio" / "Fora das regras: o anúncio aceita até
      porte pequeno"; os links vencem em 10 minutos e o link de um arquivo não abre outro;
   3. outro dono não vê a ficha; 4. candidatura recusada → a ficha some para o dono.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const PET = "Totó (teste QA)";
const OBS = "Muito calmo e sociável com outros cães, não late quando fica sozinho e já morou em apartamento com elevador e portaria. Passeia duas vezes por dia e usa tapete higiênico."; // > 120 caracteres
const dono = { email: `dono.t226.${sufixo}@lab.vivanomads.test`, nome: "Dalva Pet Sobrenome", role: "owner" as const };
const dono2 = { email: `dono2.t226.${sufixo}@lab.vivanomads.test`, nome: "Dario Outro Sobrenome", role: "owner" as const };
const inq = { email: `inq.t226.${sufixo}@lab.vivanomads.test`, nome: "Inês Pet Sobrenome", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const TITULO_A = `Studio pet médio ${sufixo}`;
const TITULO_B = `Studio pet pequeno ${sufixo}`;
const regras = (porteMax: "P" | "M") => ({ especies: ["cao", "gato"], porteMax, qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "" });

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
const cartao = (page: Page, titulo: string): Locator => page.getByTestId("cartao-candidato").filter({ hasText: titulo });
async function jpeg(cor: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 320, height: 240, channels: 3, background: cor } }).jpeg().toBuffer();
}

test.describe("T226 — ficha do pet para o dono da candidatura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.dono2 = await criarConta(dono2, senha);
    ids.inq = await criarConta(inq, senha);
    ids.a = await criarImovelPronto(ids.dono, TITULO_A, { ativo: true, preco: 3200 });
    ids.b = await criarImovelPronto(ids.dono, TITULO_B, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ pets_allowed: true, pets_regras: regras("M") }).eq("id", ids.a);
    await adm().from("properties").update({ pets_allowed: true, pets_regras: regras("P") }).eq("id", ids.b);
  });

  test.afterAll(async () => {
    await adm().from("leads").delete().in("id", [ids.leadA, ids.leadB].filter(Boolean) as string[]);
    const { data: pets } = await adm().from("pets_inquilino").select("fotos, carteira_vacina").eq("user_id", ids.inq!);
    const arquivos = ((pets ?? []) as { fotos: string[]; carteira_vacina: string | null }[]).flatMap((p) => [...p.fotos, ...(p.carteira_vacina ? [p.carteira_vacina] : [])]);
    if (arquivos.length) await adm().storage.from("pets-fotos").remove(arquivos);
    await apagarContas([ids.inq, ids.dono, ids.dono2]);
  });

  test("1. 390 + 1280 — inquilino: pet novo aparece com foto e carteira na hora; 3/3 fotos; raça e observações com 'ver mais'", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await abrir(browser, inq.email, 390);
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    const form = page.getByTestId("pets-form");
    await expect(form).toBeVisible({ timeout: 15_000 });
    await form.getByLabel("Nome").fill(PET);
    await form.getByLabel("Porte").selectOption("M");
    await form.getByLabel("Raça (opcional)").fill("Vira-lata");
    await form.getByLabel("Observações (opcional)").fill(OBS);
    await form.getByRole("button", { name: "Adicionar pet" }).click();
    // (b) sem recarregar: as linhas de foto e de carteira já estão no cartão do pet novo.
    const toto = page.getByTestId("pets-lista").locator("li", { hasText: PET });
    await expect(toto.getByLabel(`Enviar foto de ${PET}`)).toBeAttached({ timeout: 15_000 });
    await expect(toto.getByLabel(`Enviar carteira de vacina de ${PET}`)).toBeAttached();
    // (c) raça e observações cortadas, com "ver mais".
    await expect(toto.getByTestId(`pet-raca-${PET}`)).toHaveText("Raça: Vira-lata");
    const obs = toto.getByTestId(`pet-observacoes-${PET}`);
    await expect(obs).toContainText("…");
    await toto.getByTestId(`pet-ver-mais-${PET}`).click();
    await expect(obs).toContainText(OBS);
    await expect(toto.getByTestId(`pet-ver-mais-${PET}`)).toHaveText("ver menos");
    // 3 fotos e a carteira.
    for (const [i, cor] of ["#996633", "#336699", "#669933"].entries()) {
      await toto.getByLabel(`Enviar foto de ${PET}`).setInputFiles({ name: `toto${i}.jpg`, mimeType: "image/jpeg", buffer: await jpeg(cor) });
      await expect(toto.getByAltText(`Foto ${i + 1} de ${PET}`)).toBeVisible({ timeout: 20_000 });
    }
    await toto.getByLabel(`Enviar carteira de vacina de ${PET}`).setInputFiles({ name: "carteira.jpg", mimeType: "image/jpeg", buffer: await jpeg("#eeeeee") });
    await expect(toto.getByText("Carteira de vacina enviada")).toBeVisible({ timeout: 20_000 });
    // (a) 3 de 3: no lugar do botão de envio, o aviso.
    await expect(toto.getByTestId(`pet-max-fotos-${PET}`)).toHaveText("Máximo de 3 fotos. Remova uma para trocar.");
    await expect(toto.getByLabel(`Enviar foto de ${PET}`)).toHaveCount(0);
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t226-inquilino-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("pets-lista").locator("li", { hasText: PET }).getByTestId(`pet-max-fotos-${PET}`)).toBeVisible({ timeout: 15_000 });
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t226-inquilino-1280.png`, fullPage: true });
    await page.context().close();

    // A candidatura do inquilino aos dois imóveis do dono (porte médio aceito em A; só pequeno em B).
    ids.leadA = await criarLead(ids.dono!, ids.inq!, ids.a!);
    ids.leadB = await criarLead(ids.dono!, ids.inq!, ids.b!);
  });

  for (const largura of [1280, 390]) {
    test(`2. ${largura} — dono: 'Ver ficha do pet' mostra as 3 fotos, a carteira e a conferência com as regras`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await abrir(browser, dono.email, largura);
      await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const a = cartao(page, TITULO_A);
      await expect(a.getByTestId("ficha-pet-resumo")).toHaveText(`Com 1 pet · ${PET} (cão, porte médio)`, { timeout: 20_000 });
      expect(await a.innerText()).not.toMatch(/Com 1 pet(?! ·)/); // o resumo substitui o "Com 1 pet" solto
      await a.getByTestId("ver-ficha-pet").click();
      const painel = a.getByTestId("ficha-pet-painel");
      await expect(painel.getByTestId("ficha-pet-conferencia")).toHaveText("Dentro das regras: aceita cão de porte médio", { timeout: 20_000 });
      await expect(painel.getByTestId("ficha-pet-raca")).toHaveText("Vira-lata");
      await expect(painel.getByTestId("ficha-pet-observacoes")).toHaveText(OBS);
      const fotos = painel.getByTestId("ficha-pet-fotos").locator("img");
      await expect(fotos).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        await expect.poll(() => fotos.nth(i).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      const carteira = await painel.getByTestId("ficha-pet-carteira").getAttribute("href");
      expect((await page.request.get(carteira!)).status()).toBe(200);
      // Link de 10 minutos (o token assinado diz quando vence).
      const token = new URL(carteira!).searchParams.get("token")!;
      const carga = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      expect(carga.exp - carga.iat).toBe(600);
      // O token de um arquivo não abre outro (a URL assinada de outra candidatura/arquivo não serve).
      const foto1 = (await fotos.nth(0).getAttribute("src"))!;
      const trocado = new URL(foto1);
      trocado.pathname = new URL(carteira!).pathname;
      expect((await page.request.get(trocado.toString())).status()).not.toBe(200);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t226-dono-ficha-${largura}.png`, fullPage: true });

      // Imóvel B só aceita porte pequeno: a conferência diz que está fora.
      const b = cartao(page, TITULO_B);
      await b.getByTestId("ver-ficha-pet").click();
      await expect(b.getByTestId("ficha-pet-conferencia")).toHaveText("Fora das regras: o anúncio aceita até porte pequeno", { timeout: 20_000 });
      await page.context().close();
    });
  }

  test("3. 1280 — outro dono não vê a ficha nem o pet", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await abrir(browser, dono2.email, 1280);
    await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(PET)).toHaveCount(0);
    await expect(page.getByTestId("ver-ficha-pet")).toHaveCount(0);
    await page.context().close();
  });

  test("4. 390 — candidatura recusada: a ficha some para o dono (a outra candidatura continua)", async ({ browser }) => {
    test.setTimeout(90_000);
    expect((await adm().from("leads").update({ status: "rejected" }).eq("id", ids.leadA!)).error).toBeNull();
    const page = await abrir(browser, dono.email, 390);
    await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(cartao(page, TITULO_B).getByTestId("ver-ficha-pet")).toBeVisible({ timeout: 20_000 });
    await expect(cartao(page, TITULO_A).getByTestId("ver-ficha-pet")).toHaveCount(0);
    await expect(cartao(page, TITULO_A)).not.toContainText(PET);
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t226-recusada-390.png`, fullPage: true });
    await page.context().close();
  });
});
