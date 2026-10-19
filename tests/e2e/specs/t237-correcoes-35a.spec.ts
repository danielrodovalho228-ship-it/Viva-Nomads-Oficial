import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { account, hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, lerSaida, novaSenha, novoSufixo, pdf } from "../fixtures/laboratorio";

/*
  T237 — Correções do Prompt 35A (390 e 1280 px):
   1. /qualificar: o documento entra na fila NO ENVIO. A pessoa envia e SAI sem concluir → o item aparece em
      /admin/documentos ("Documento sem imóvel ligado", com o dono) e o admin recebe o aviso (LAB_OUTBOX). Falha
      simulada da action: a tela NÃO diz "Enviado" e oferece "Tentar de novo" (que, de volta a rede, enfileira).
   2. "Ideal para": o ube-001 mostra "Com pet" em 1º na /buscar.
   3. Página do imóvel sem "Verificação de identidade: em breve".
   4. Rodapé e /ajuda com o link do Instagram oficial (rel="noopener", nome acessível).
  As partes 2–4 são públicas (rodam fora do laboratório); a 1 só no laboratório.
*/
const SAIDA = "tests/laboratorio/saida";
const INSTAGRAM = "https://www.instagram.com/vivanomads/";
const LARGURAS = [390, 1280] as const;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

// ─────────────────────────── 1. Documento enfileirado no envio ───────────────────────────
test.describe("T237 — 1. documento do /qualificar entra na fila no envio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const donos = {
    390: { email: `dono390.t237.${sufixo}@lab.vivanomads.test`, nome: `Otávio Fila Celular ${sufixo}`, role: "owner" as const },
    1280: { email: `dono1280.t237.${sufixo}@lab.vivanomads.test`, nome: `Olívia Fila Larga ${sufixo}`, role: "owner" as const },
  };
  const falha = { email: `falha.t237.${sufixo}@lab.vivanomads.test`, nome: `Fábio Falha Rede ${sufixo}`, role: "owner" as const };
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    for (const l of LARGURAS) ids[l] = await criarConta(donos[l], senha);
    ids.falha = await criarConta(falha, senha);
  });

  test.afterAll(async () => {
    await apagarContas(Object.values(ids));
  });

  async function pendentes(ownerId: string) {
    const { data } = await adm()
      .from("qualification_checklists")
      .select("id, property_id, document_path, document_status")
      .eq("owner_id", ownerId)
      .eq("document_status", "pending");
    return data ?? [];
  }

  async function abrirQualificar(browser: Browser, email: string, largura: number) {
    const page = await entrar(browser, email, senha);
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/qualificar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Qualificação do imóvel" })).toBeVisible({ timeout: 20_000 });
    return page;
  }

  const avisosAoAdmin = async () =>
    (await lerSaida()).filter(
      (l) => l.servico === "email" && String(l.para ?? "").toLowerCase() === account("admin").email.toLowerCase() && /documento de im[óo]vel para conferir/i.test(String(l.assunto ?? ""))
    ).length;

  for (const largura of LARGURAS) {
    test(`${largura} px — enviar e SAIR sem concluir: o documento está na fila e o admin foi avisado`, async ({ browser }) => {
      test.setTimeout(120_000);
      const avisosAntes = await avisosAoAdmin();
      const page = await abrirQualificar(browser, donos[largura].email, largura);
      await page.getByLabel(/Enviar documentação do imóvel/).setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
      await expect(page.getByText("Enviado para conferência")).toBeVisible({ timeout: 20_000 });
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t237-qualificar-enviado-${largura}.png`, fullPage: false });

      // Sai da tela SEM salvar a qualificação.
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.context().close();

      // A linha "em análise" existe (sem imóvel ligado), uma só.
      const linhas = await pendentes(ids[largura]);
      expect(linhas).toHaveLength(1);
      expect(linhas[0].property_id).toBeNull();
      expect(String(linhas[0].document_path)).toMatch(new RegExp(`^${ids[largura]}/`));
      // O aviso aos admins saiu (documento_recebido).
      await expect.poll(avisosAoAdmin, { timeout: 30_000 }).toBeGreaterThan(avisosAntes);

      // A fila do admin mostra o item, com o dono e "Documento sem imóvel ligado".
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const adminPage = await ctx.newPage();
      await adminPage.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const card = adminPage.locator(`[data-testid="doc-card"][data-dono="${donos[largura].nome}"]`);
      await expect(card).toHaveCount(1, { timeout: 20_000 });
      await expect(card).toHaveAttribute("data-sem-imovel", "1");
      await expect(card).toContainText("Documento sem imóvel ligado");
      await expect(card).toContainText(/Enviado \d{2}\/\d{2}\/\d{4}/);
      await card.scrollIntoViewIfNeeded();
      await semRolagemLateral(adminPage);
      await adminPage.screenshot({ path: `${SAIDA}/t237-admin-sem-imovel-${largura}.png`, fullPage: false });
      await ctx.close();
    });
  }

  test("falha simulada da action: nada de \"Enviado\"; \"Tentar de novo\" enfileira o mesmo arquivo", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await abrirQualificar(browser, falha.email, 390);
    // Derruba SÓ a Server Action (POST com o cabeçalho Next-Action); o upload (/api/upload/documento) passa.
    let derrubar = true;
    await page.route("**/qualificar**", async (route) => {
      const req = route.request();
      if (derrubar && req.method() === "POST" && req.headers()["next-action"]) return route.abort("failed");
      return route.continue();
    });
    await page.getByLabel(/Enviar documentação do imóvel/).setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
    const erro = page.getByTestId("doc-erro");
    await expect(erro).toBeVisible({ timeout: 20_000 });
    await expect(erro.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByText("Enviado para conferência")).toHaveCount(0);
    await expect(page.getByText("Documentação do imóvel — enviada ✓")).toHaveCount(0);
    expect(await pendentes(ids.falha)).toHaveLength(0);
    await page.screenshot({ path: `${SAIDA}/t237-qualificar-falha-390.png`, fullPage: false });

    // De volta a rede: "Tentar de novo" põe o MESMO arquivo na fila (sem subir de novo).
    derrubar = false;
    await erro.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByText("Enviado para conferência")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await pendentes(ids.falha)).length, { timeout: 15_000 }).toBe(1);
    await page.context().close();
  });
});

// ─────────────────────────── 2–4. Públicas ───────────────────────────
for (const largura of LARGURAS) {
  test.describe(`T237 — públicas a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("2. /buscar: o ube-001 mostra \"Com pet\" em 1º no \"Ideal para\"", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const linha = page.locator('a[href="/imoveis/ube-001"]').first().getByTestId("ideal-para");
      await expect(linha).toContainText(/Ideal para:\s*Com pet · /, { timeout: 20_000 });
      await semRolagemLateral(page);
    });

    test("3. página do imóvel sem \"Verificação de identidade: em breve\"", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ideal-para").first()).toContainText("Ideal para: Com pet · Home office · Família");
      const texto = await page.locator("body").innerText();
      expect(texto).not.toMatch(/verifica[çc][ãa]o de identidade[^.]{0,20}em breve/i);
      expect(texto).not.toMatch(/candidate-se direto pela plataforma/i);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t237-imovel-${largura}.png`, fullPage: false });
    });

    test("4. rodapé e /ajuda com o Instagram oficial (rel=noopener, nome acessível)", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const noRodape = page.locator(`footer a[href="${INSTAGRAM}"]`);
      await expect(noRodape).toHaveCount(1);
      await expect(noRodape).toHaveAttribute("rel", /noopener/);
      await expect(noRodape).toHaveAttribute("aria-label", /Instagram/);
      await noRodape.scrollIntoViewIfNeeded();
      await expect(noRodape).toBeVisible();
      await semRolagemLateral(page);

      await page.goto("/ajuda", { waitUntil: "domcontentloaded" });
      const fale = page.getByRole("heading", { name: "Fale com a Viva" }).locator("xpath=..");
      const naAjuda = fale.locator(`a[href="${INSTAGRAM}"]`);
      await expect(naAjuda).toHaveCount(1);
      await expect(naAjuda).toHaveAttribute("rel", /noopener/);
      await expect(naAjuda).toHaveAttribute("aria-label", /Instagram/);
      await expect(naAjuda).toContainText("@vivanomads");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t237-ajuda-${largura}.png`, fullPage: false });
    });
  });
}
