import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T-RASC — RASCUNHO: SALVAMENTO E RETOMADA DE VERDADE (@criticos)
 *
 * Regressão do P0 de perda de dados. O editor autossalva no SERVIDOR (não só no
 * localStorage): o rascunho sobrevive a reload, reaparece na Visão geral e pode
 * ser retomado por qualquer caminho — sem zerar a qualificação (selo 6/6).
 *
 * Requer a migration 0043 (properties.draft_data) aplicada no banco de teste.
 */
test.describe("T-RASC — Rascunho salva e retoma @criticos", () => {
  // Em ordem, num worker só: os testes deste arquivo mexem no MESMO estado da
  // conta (modo preferido / rascunhos) e se atrapalhavam com fullyParallel.
  test.describe.configure({ mode: "default" });
  test.use({ storageState: authFile("proprietario") });

  // A qualificação (elegível) é pré-requisito para abrir o editor. Injetamos o
  // resultado na sessionStorage — com selo + etiqueta "trabalhar de casa" — para
  // provar depois que a retomada não zera esse estado.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem(
          "vivanomads-qualification",
          JSON.stringify({ eligible: true, baseBadge: true, tHome: true, tWork: false, score: 5 })
        );
      } catch {
        /* ambiente sem sessionStorage — ignora */
      }
    });
    // Confirma diálogos (excluir rascunho) automaticamente.
    page.on("dialog", (d) => d.accept());
  });

  /** Sem networkidle (o painel mantém conexões abertas): espera um pouco o aviso de rascunho
   * e, se ele aparecer, começa outro; se não aparecer, segue com o editor em branco. */
  async function comecarOutroSeHouver(page: Page) {
    await page.locator('input[type="file"]').first().waitFor({ state: "attached", timeout: 20_000 });
    const comecarOutro = page.getByRole("button", { name: "Começar outro" });
    try {
      await comecarOutro.waitFor({ state: "visible", timeout: 4_000 });
      await comecarOutro.click();
    } catch {
      /* sem rascunho anterior — editor em branco */
    }
  }

  /** Abre o editor em branco e preenche o endereço na etapa 1, "Onde fica" (dispara o autosave). Devolve
   * a marca única usada no bairro, para conferir a restauração depois. */
  async function novoComEndereco(page: Page): Promise<string> {
    const marca = `QA${Date.now().toString().slice(-6)}`;
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    // Se um rascunho anterior for detectado, começa outro para partir do zero.
    await comecarOutroSeHouver(page);
    // Cadastro em 5 etapas (prompt 10): Onde fica → Fotos → O que encontramos → Preço → Revisar.
    await expect(page.getByRole("heading", { name: "Onde fica" })).toBeVisible();
    await page.getByTestId("cadastro-rua").fill(`Rua ${marca}`);
    await page.getByTestId("cadastro-numero").fill("100");
    await page.locator('input[list="novo-bairros"]').fill(marca);
    return marca;
  }

  async function esperarSalvo(page: Page) {
    // Debounce de 2s: um "Salvo" antigo (do autosave anterior) ainda pode estar na tela logo depois da última
    // digitação. Passa o debounce, e só então exige "Salvo" sem "Salvando…" — senão sai da página com o servidor sem o endereço.
    await page.waitForTimeout(2_500);
    await expect(page.getByText("Salvando…")).toHaveCount(0, { timeout: 12_000 });
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 12_000 });
  }

  /** Link que retoma o rascunho de onde parou (o botão principal agora leva ao próximo passo do checklist). */
  const retomar = (page: Page) => page.getByTestId("retomar-rascunho");

  test("T-RASC-1 — autosave mostra 'Salvando…' → 'Salvo' e reload mantém", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Reload na mesma URL: o rascunho volta (cinto local + servidor).
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-2 — rascunho reaparece na Visão geral e retoma no servidor", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Sai do editor SEM publicar; a Visão geral deve oferecer retomar.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const card = page.getByText(/Anúncio em andamento/i);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await retomar(page).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/);
    // Restaurou do SERVIDOR (não do localStorage desta aba): bairro de volta.
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-6 — 'Anúncio em andamento' é um checklist: ✓ feito / ○ falta, cada item abre o campo certo (ordem de8761b0, item 1)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await novoComEndereco(page);
    await esperarSalvo(page);
    // O "Salvo" pode ser do autosave das fotos, anterior ao endereço (debounce de 2 s):
    // recarrega a Visão geral até o servidor refletir o endereço, em vez de sair cedo.
    const lista = page.getByTestId("anuncio-checklist");
    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(lista.getByTestId("check-feito").filter({ hasText: "Endereço preenchido" })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 40_000, intervals: [2_000, 3_000] });
    // Endereço já preenchido = feito; fotos (só 1 de 8) = falta e é clicável.
    await expect(lista.getByTestId("check-falta").filter({ hasText: "Endereço preenchido" })).toHaveCount(0);
    // Sem rolagem lateral a 390 px.
    const estouro = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(estouro).toBe(false);
    // O próximo passo vem em destaque no resumo e no botão.
    await expect(page.getByTestId("prontidao-visao-geral")).toContainText(/Próximo passo:/);
    // Clicar no item que falta abre o editor JÁ na etapa certa (Fotos).
    await lista.getByTestId("check-falta").filter({ hasText: "Pelo menos 8 fotos" }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=.*&etapa=1/);
    await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible({ timeout: 15_000 });
  });

  test("T-RASC-3 — 'Novo anúncio' detecta rascunho e 'Começar outro' limpa", async ({ page }) => {
    const marca = await novoComEndereco(page);
    await esperarSalvo(page);
    // Bug 12: o 1º autosave fixa ?draft=<id> na URL (F5 retoma o mesmo rascunho).
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/);
    const id = new URL(page.url()).searchParams.get("draft");
    // Abre o editor de novo, em branco: deve detectar o rascunho anterior, sem
    // aplicar a cópia local nem criar outro rascunho por baixo (bug 12).
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Você tem um anúncio em andamento/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000); // passa o debounce do autosave
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo$/);
    await expect(page.getByText(/Você tem um anúncio em andamento/i)).toBeVisible();
    // "Continuar" retoma o rascunho detectado.
    await page.getByRole("button", { name: "Continuar", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`\\?draft=${id}`));
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-5 — o cadastro abre pela etapa Onde fica, com o CEP em foco (prompt 10), não pela qualificação", async ({ page }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    await comecarOutroSeHouver(page);
    await expect(page.getByRole("heading", { name: "Onde fica" })).toBeVisible();
    await expect(page.getByTestId("cadastro-cep")).toBeFocused();
    await expect(page.getByText("Conclua a qualificação primeiro")).toHaveCount(0);
  });

  test("T-RASC-4 — retomar não trava etapas já visitadas nem zera a qualificação (bug 13)", async ({ page }) => {
    await novoComEndereco(page);
    const continuar = page.getByRole("button", { name: "Continuar", exact: true });
    await continuar.click(); // → Fotos
    await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles("public/images/imoveis/ube/ube-001-sala.webp");
    await expect(page.getByText(/^1\/40 fotos/)).toBeVisible({ timeout: 20_000 });
    await continuar.click(); // → O que encontramos
    await expect(page.getByRole("heading", { name: "O que encontramos" })).toBeVisible();
    // Volta a "Onde fica" pelo topo e deixa salvar: o rascunho fica na etapa 1.
    await page.getByRole("button", { name: /Onde fica/ }).click();
    await esperarSalvo(page);
    await page.waitForTimeout(2_500);
    await esperarSalvo(page);
    // Retoma pela Visão geral: abre em "Onde fica", e "O que encontramos" segue clicável.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await retomar(page).click();
    await expect(page).toHaveURL(/\?draft=/);
    await expect(page.getByTestId("cadastro-rua")).toBeVisible();
    const encontramos = page.getByRole("button", { name: /O que encontramos/i });
    await expect(encontramos).toBeEnabled();
    await expect(page.getByRole("button", { name: /Preço e disponibilidade/i })).toBeDisabled(); // nunca visitada
    await encontramos.click();
    // A etiqueta da qualificação veio do rascunho (não da sessionStorage).
    await expect(page.getByText(/trabalhar de casa”? ativa/i)).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Limpeza: remove os rascunhos de teste criados (evita órfãos acumulando).
    const context = await browser.newContext({ storageState: authFile("proprietario") });
    const page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    for (let i = 0; i < 20; i++) {
      const botao = page.getByRole("button", { name: "Excluir rascunho" }).first();
      if (!(await botao.isVisible().catch(() => false))) break;
      await botao.click();
      await page.waitForTimeout(600);
    }
    await context.close();
  });
});
