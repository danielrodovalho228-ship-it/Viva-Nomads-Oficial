import { test, expect, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T355 — CONTA-A, entrega 1 (Perfil): topo único, foto que envia de verdade, avatar sem nome, o espelho e o progresso.
 *   1. sem nome: silhueta (nunca "?") no cartão da foto e no cabeçalho; um H1 visível ("Perfil") — 360, 390, 1280;
 *   2. o seletor de arquivo abre no clique e no teclado (topo e convite), a 390 e 1280;
 *   3. JPG com recorte (zoom) → "Foto atualizada" → aparece no topo, no cabeçalho e no perfil público → recarregar
 *      mantém → PNG troca → "Remover" volta às iniciais;
 *   4. erros: arquivo que não é imagem e HEIC que o navegador não lê ("Envie em JPG ou PNG") com "Tentar de novo";
 *   5. o espelho monta ao vivo (nome curto, pílula, balão) — à direita no computador, abaixo no celular com "Salvar
 *      alterações" preso no fim; salvar grava cidade e frase.
 * A1: a tela do Perfil é /dashboard/conta/perfil (no computador também /dashboard/conta).
 */
const SAIDA = "tests/laboratorio/saida";
const altura = (w: number) => (w === 1280 ? 900 : 844);

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
const imagem = (formato: "jpeg" | "png", w = 900, h = 600) =>
  sharp({ create: { width: w, height: h, channels: 3, background: formato === "jpeg" ? "#2a7a4b" : "#c87a2a" } })
    [formato]()
    .toBuffer();

test.describe("T355 — CONTA-A Perfil: topo, foto, espelho", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const semNome = { email: `semnome.t355.${sufixo}@lab.vivanomads.test`, nome: "Sem Nome", role: "tenant" as const };
  const dono = { email: `dono.t355.${sufixo}@lab.vivanomads.test`, nome: "Helena Prado", role: "owner" as const };
  const ids: Record<string, string> = {};

  async function como(browser: Browser, email: string, w: number) {
    const p = await entrar(browser, email, senha);
    await p.setViewportSize({ width: w, height: altura(w) });
    return p;
  }

  test.beforeAll(async () => {
    ids.semNome = await criarConta(semNome, senha);
    ids.dono = await criarConta(dono, senha);
    // Conta de fato sem nome: nem no perfil nem nos dados do login (a sessão lê os dois).
    await adm().from("profiles").update({ full_name: null }).eq("id", ids.semNome);
    await adm().auth.admin.updateUserById(ids.semNome, { user_metadata: { full_name: null } });
    ids.imovel = await criarImovelPronto(ids.dono, `Perfil t355 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.semNome, ids.dono]);
  });

  for (const w of [360, 390, 1280]) {
    test(`1. a ${w} px: sem nome → silhueta; um H1 visível ("Perfil")`, async ({ browser }) => {
      const p = await como(browser, semNome.email, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
      await expect(p.locator("h1:visible")).toHaveCount(1);
      await expect(p.locator("h1:visible")).toHaveText("Perfil");
      const topo = p.getByTestId("topo-conta");
      await expect(topo.locator('[data-rosto="silhueta"]')).toHaveCount(1);
      await expect(topo).not.toContainText("?");
      // O selo do cabeçalho também mostra a silhueta (não o "P"/"M" do papel, nem "?").
      await expect(p.locator('[data-testid="papel-ativo"]:visible [data-rosto="silhueta"]')).toHaveCount(1);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t355-sem-nome-${w}.png` });
      await p.context().close();
    });
  }

  for (const w of [390, 1280]) {
    test(`2. a ${w} px: o seletor de arquivo abre no clique e no teclado (topo e convite)`, async ({ browser }) => {
      const p = await como(browser, dono.email, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
      const botao = p.getByTestId("topo-foto");
      await expect(botao).toHaveAccessibleName("Adicionar foto");
      let fc = p.waitForEvent("filechooser", { timeout: 5_000 });
      await botao.click();
      expect((await fc).isMultiple()).toBe(false);
      fc = p.waitForEvent("filechooser", { timeout: 5_000 });
      await botao.focus();
      await p.keyboard.press("Enter");
      await fc;
      // O input é acessível (sr-only), nunca display:none.
      expect(await p.getByTestId("topo-foto-input").evaluate((i) => getComputedStyle(i).display)).not.toBe("none");
      // O convite do painel abre o MESMO fluxo (não é mais uma âncora).
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const convite = p.getByTestId("convite-foto-adicionar");
      if (await convite.count()) {
        expect(await convite.evaluate((e) => e.tagName.toLowerCase())).toBe("button");
        fc = p.waitForEvent("filechooser", { timeout: 5_000 });
        await convite.click();
        await fc;
      }
      await p.context().close();
    });
  }

  test("3. JPG com recorte → topo, cabeçalho e perfil público; recarregar mantém; PNG troca; Remover volta às iniciais", async ({ browser }) => {
    const p = await como(browser, dono.email, 390);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
    await p.getByTestId("topo-foto-input").setInputFiles({ name: "rosto.jpg", mimeType: "image/jpeg", buffer: await imagem("jpeg") });
    const recorte = p.getByTestId("foto-recorte");
    await expect(recorte).toBeVisible();
    await p.getByTestId("foto-zoom").fill("1.6");
    await p.getByTestId("foto-recorte-area").focus();
    await p.keyboard.press("ArrowLeft");
    await p.screenshot({ path: `${SAIDA}/t355-recorte-390.png` });
    await p.getByTestId("foto-salvar").click();
    await expect(p.getByTestId("topo-foto-msg")).toHaveText("Foto atualizada", { timeout: 20_000 });
    await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(1);
    await expect(p.getByTestId("topo-foto")).toHaveAccessibleName("Trocar foto");
    // C8/E55: na Conta a foto aparece no topo e (menor) no espelho; o cabeçalho fica só nas iniciais.
    await expect(p.locator('[data-testid="espelho-perfil"]:visible img:visible')).toHaveCount(1);
    await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(0);
    // O medidor andou sem recarregar: "Foto de perfil" saiu da linha de faltas.
    await expect(p.getByTestId("perfil-falta")).not.toContainText("Foto de perfil", { timeout: 15_000 });
    const caminho = (await adm().from("profiles").select("avatar_url").eq("id", ids.dono).single()).data?.avatar_url as string;
    expect(caminho).toBe(`${ids.dono}/avatar.webp`);
    // Fora da Conta, o cabeçalho mostra a foto nova.
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(1);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
    await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(1);
    // Perfil público do proprietário (tem anúncio): a foto aparece.
    const pub = await (await browser.newContext()).newPage();
    await pub.goto(`/proprietario/${ids.dono}`, { waitUntil: "networkidle" });
    await expect(pub.getByAltText(/^Foto de Helena/)).toBeVisible({ timeout: 20_000 });
    await pub.context().close();
    // PNG troca; "Remover" volta às iniciais.
    await p.getByTestId("topo-foto-input").setInputFiles({ name: "rosto.png", mimeType: "image/png", buffer: await imagem("png") });
    await p.getByTestId("foto-salvar").click();
    await expect(p.getByTestId("topo-foto-msg")).toHaveText("Foto atualizada", { timeout: 20_000 });
    await p.getByTestId("topo-foto-remover").click();
    await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(0, { timeout: 15_000 });
    await expect(p.getByTestId("topo-conta").locator('[data-rosto="iniciais"]')).toHaveText("HP");
    await p.context().close();
  });

  test("4. erros com a causa e 'Tentar de novo': arquivo que não é imagem e HEIC ilegível", async ({ browser }) => {
    const p = await como(browser, dono.email, 390);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
    await p.getByTestId("topo-foto-input").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("não sou imagem") });
    await expect(p.getByTestId("topo-foto-msg")).toContainText("Escolha um arquivo de imagem");
    await expect(p.getByTestId("topo-foto-msg").getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await p.getByTestId("topo-foto-input").setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("ftypheic-falso") });
    await expect(p.getByTestId("topo-foto-msg")).toContainText("Envie em JPG ou PNG");
    const fc = p.waitForEvent("filechooser", { timeout: 5_000 });
    await p.getByTestId("topo-foto-msg").getByRole("button", { name: "Tentar de novo" }).click();
    await fc;
    await p.screenshot({ path: `${SAIDA}/t355-erro-heic-390.png` });
    await p.context().close();
  });

  for (const w of [390, 1280]) {
    test(`5. a ${w} px: o espelho monta ao vivo; celular com "Salvar alterações" preso`, async ({ browser }) => {
      const p = await como(browser, dono.email, w);
      await p.goto("/dashboard/conta#perfil-publico", { waitUntil: "networkidle" });
      await expect(p).toHaveURL(/\/dashboard\/conta\/perfil$/);
      await p.getByTestId("perfil-cartao").waitFor();
      const espelho = p.locator('[data-testid="espelho-perfil"]:visible');
      await expect(espelho.getByRole("heading")).toHaveText("É assim que o proprietário te vê");
      await expect(espelho.getByTestId("espelho-nome")).toHaveText("Helena P.");
      await expect(espelho.getByTestId("espelho-email")).toHaveText("E-mail confirmado");
      await p.locator("#perfil-cidade").fill("Santa Mônica");
      await p.locator("#perfil-bio").fill("Professora, tranquila, cuido bem da casa.");
      // O balão mostra a frase entre aspas, como uma mensagem.
      await expect(espelho.getByTestId("espelho-sobre")).toContainText("Professora, tranquila, cuido bem da casa.");
      const form = await p.getByTestId("perfil-cartao").boundingBox();
      const esp = await espelho.boundingBox();
      if (w === 1280) {
        expect(esp!.x).toBeGreaterThan(form!.x + form!.width - 1);
        await expect(p.getByTestId("perfil-salvar-celular")).toBeHidden();
        await espelho.scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${SAIDA}/t355-espelho-1280.png` });
        await p.getByTestId("perfil-salvar").click();
        await expect(p.getByTestId("perfil-salvar-msg")).toHaveText("Alterações salvas.");
      } else {
        expect(esp!.y).toBeGreaterThan(form!.y + form!.height - 1);
        const salvar = p.getByTestId("perfil-salvar-celular");
        await expect(salvar).toBeVisible();
        await expect(p.getByTestId("perfil-salvar")).toBeHidden();
        await espelho.scrollIntoViewIfNeeded();
        await semRolagemLateral(p);
        await p.screenshot({ path: `${SAIDA}/t355-espelho-390.png` });
        // Preso no fim da tela, acima da barra de abas, enquanto o perfil está à vista.
        const caixa = await salvar.boundingBox();
        expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(altura(w));
        await salvar.click();
        await expect(p.getByTestId("perfil-salvar-msg")).toHaveText("Alterações salvas.");
      }
      expect((await adm().from("profiles").select("cidade, bio").eq("id", ids.dono).single()).data).toEqual({ cidade: "Santa Mônica", bio: "Professora, tranquila, cuido bem da casa." });
      await p.context().close();
    });
  }
});
