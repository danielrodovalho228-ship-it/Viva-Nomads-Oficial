import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { TITULO_PASSO, doTipoAoEndereco, noPasso } from "../fixtures/cadastro";

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
    // E104 (#1319): o Passo 1 não tem mais a barra de fotos (nem o campo de arquivo); o editor pronto é o título do passo (ou o aviso de rascunho).
    const comecarOutro = page.getByRole("button", { name: "Começar outro" });
    // E132-A: o cadastro novo abre na Qualificação (antes do Passo 1); "Responder depois" leva ao Passo 1.
    const qualificacao = page.getByTestId("qualificacao");
    await page.getByTestId("passo-titulo").or(comecarOutro).or(qualificacao).first().waitFor({ state: "visible", timeout: 20_000 });
    try {
      await comecarOutro.waitFor({ state: "visible", timeout: 4_000 });
      await comecarOutro.click();
    } catch {
      /* sem rascunho anterior — editor em branco */
    }
    await page.getByTestId("passo-titulo").or(qualificacao).first().waitFor({ state: "visible", timeout: 20_000 });
    if (await qualificacao.isVisible()) await page.getByTestId("qualificacao-depois").click();
  }

  /** Abre o editor em branco, vai ao passo Endereço e preenche o endereço (dispara o autosave). Devolve
   * a marca única usada no bairro, para conferir a restauração depois. */
  async function novoComEndereco(page: Page): Promise<string> {
    const marca = `QA${Date.now().toString().slice(-6)}`;
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    // Se um rascunho anterior for detectado, começa outro para partir do zero.
    await comecarOutroSeHouver(page);
    // Assistente em 10 passos: Tipo → Fotos → Endereço → Detalhes → Comodidades → Regras → Descrição → Preço →
    // Disponibilidade → Revisão. O endereço agora é o 3º passo (as Fotos, antes dele, pedem 1 foto).
    await doTipoAoEndereco(page);
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
  // PROP-6 (#1349): no modo dono o Início é o "Continue seu anúncio" (bloco principal do tipo rascunho); retomar é o
  // "Continuar de onde parou", que abre no primeiro passo que falta, com o mesmo ?draft=.
  const blocoRascunho = (page: Page) => page.locator('[data-testid="inicio-dono-principal"][data-tipo="rascunho"]');
  const retomar = (page: Page) => blocoRascunho(page).getByTestId("inicio-dono-botao");
  /** Depois de retomar, vai ao Endereço pelo nome da etapa, com o mesmo ?draft=. */
  async function noEnderecoDoRascunho(page: Page) {
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/, { timeout: 20_000 });
    const url = new URL(page.url());
    url.searchParams.set("etapa", "endereco");
    await page.goto(url.pathname + url.search, { waitUntil: "domcontentloaded" });
  }

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
    await expect(blocoRascunho(page)).toBeVisible({ timeout: 20_000 });
    await retomar(page).click();
    // "Continuar de onde parou" abre no 1º passo que falta, que pode não ser o Endereço (lab-crítico do #1061, 22/10).
    await noEnderecoDoRascunho(page);
    // Restaurou do SERVIDOR (não do localStorage desta aba): bairro de volta.
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca, { timeout: 15_000 });
  });

  test("T-RASC-6 — 'Continue seu anúncio' traz os próximos passos: ✓ feito / ○ falta, cada item abre o campo certo (ordem de8761b0, item 1)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await novoComEndereco(page);
    await esperarSalvo(page);
    // O "Salvo" pode ser do autosave das fotos, anterior ao endereço (debounce de 2 s):
    // recarrega o Início até o servidor refletir o endereço, em vez de sair cedo.
    // PROP-6 (#1349): o checklist virou "Próximos passos" do bloco "Continue seu anúncio" (até 3: o feito mais recente
    // e os que faltam, cada um "Concluído" ou "Pendente").
    const lista = page.getByTestId("inicio-dono-passos");
    // Até 3 itens: o feito mais recente e os 2 primeiros que faltam (a ordem é a da prontidão).
    const pendente = lista.getByRole("link", { name: /Pendente/ }).first();
    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(pendente).toBeVisible({ timeout: 5_000 });
      await expect(lista.getByRole("link", { name: /Endereço preenchido.*Pendente/ })).toHaveCount(0);
    }).toPass({ timeout: 40_000, intervals: [2_000, 3_000] });
    // Sem rolagem lateral a 390 px.
    const estouro = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(estouro).toBe(false);
    // O quanto falta vem no bloco (% pronto).
    await expect(blocoRascunho(page).getByTestId("inicio-dono-pct")).toBeVisible();
    // Clicar no item que falta abre o editor JÁ na etapa certa: a do próprio link (?draft=…&etapa=…).
    const destino = await pendente.getAttribute("href");
    expect(destino).toMatch(/\/dashboard\/imoveis\/novo\?draft=.*etapa=/);
    await pendente.click();
    await expect(page).toHaveURL(new RegExp(`etapa=${new URL(destino!, "http://x").searchParams.get("etapa")}`), { timeout: 20_000 });
    // Se o editor não montar a tempo (lab-crítico do #1080), reabre a mesma URL em vez de esperar o tempo todo.
    await expect(async () => {
      await expect(page.getByTestId("passo-titulo"))
        .toBeVisible({ timeout: 8_000 })
        .catch(async (e) => {
          await page.goto(page.url(), { waitUntil: "domcontentloaded" });
          throw e;
        });
    }).toPass({ timeout: 40_000 });
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
    // E180: "Novo anúncio" abre na Qualificação, com o aviso dentro dela; "Continuar o outro" retoma o rascunho detectado.
    await expect(page.getByTestId("qualificacao")).toBeVisible();
    await expect(page.getByTestId("qualificacao").getByTestId("rascunho-aviso")).toBeVisible();
    await page.getByTestId("rascunho-continuar").click();
    await expect(page).toHaveURL(new RegExp(`\\?draft=${id}`));
    await expect(page.locator('input[list="novo-bairros"]')).toHaveValue(marca);
  });

  test("T-RASC-5 — o cadastro abre pela Qualificação (E132-A) e 'Responder depois' leva ao passo 1 (Tipo); no Endereço o CEP vem em foco (prompt 10)", async ({ page }) => {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    await comecarOutroSeHouver(page);
    // Assistente em 10 passos: o 1º passo é o Tipo; o CEP (antes no 1º passo) segue com foco ao chegar no Endereço.
    await noPasso(page, "tipo");
    await expect(page.getByText("Conclua a qualificação primeiro")).toHaveCount(0);
    await doTipoAoEndereco(page);
    await expect(page.getByTestId("cadastro-cep")).toBeFocused();
    await expect(page.getByText("Conclua a qualificação primeiro")).toHaveCount(0);
  });

  test("T-RASC-4 — retomar não perde etapas já visitadas nem zera a qualificação (bug 13)", async ({ page }) => {
    await novoComEndereco(page);
    const continuar = page.getByTestId("cadastro-continuar");
    const voltar = page.getByTestId("cadastro-voltar");
    await continuar.click(); // → Detalhes
    await noPasso(page, "detalhes");
    await page.getByTestId("cadastro-banheiros").fill("1");
    await page.getByTestId("cadastro-capacidade").fill("2");
    await page.getByTestId("cadastro-area").fill("30");
    await continuar.click(); // → Comodidades
    await noPasso(page, "comodidades");
    // Volta ao Endereço ("Voltar para o passo anterior", 2×) e deixa salvar: o rascunho fica no Endereço.
    await voltar.click();
    await noPasso(page, "detalhes");
    await voltar.click();
    await noPasso(page, "endereco");
    await esperarSalvo(page);
    await page.waitForTimeout(2_500);
    await esperarSalvo(page);
    // Retoma pela Visão geral: abre no Endereço, e os passos seguintes já visitados seguem com o que foi preenchido.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await retomar(page).click();
    await noEnderecoDoRascunho(page);
    await expect(page.getByTestId("cadastro-rua")).toBeVisible({ timeout: 20_000 });
    // Os 10 passos não têm mais a barra de etapas clicável (nem o "nunca visitado" desabilitado): o caminho para frente
    // é o "Continuar", que valida — e passa porque o rascunho trouxe os Detalhes de volta.
    // Logo depois de retomar, o autosave redesenha a tela; tenta em janelas curtas até a etapa abrir (só clica de novo
    // se ainda estiver no Endereço, para não pular os Detalhes).
    const titulo = page.getByTestId("passo-titulo");
    await expect(async () => {
      if ((await titulo.innerText()).includes(TITULO_PASSO.endereco)) await continuar.click({ timeout: 3_000 });
      await noPasso(page, "detalhes", 3_000);
    }).toPass({ timeout: 30_000 });
    await expect(page.getByTestId("cadastro-area")).toHaveValue("30");
    await continuar.click();
    await noPasso(page, "comodidades");
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
      // Confirmação na página (adendo ao prompt 28): o 2º clique exclui.
      await page.getByTestId("excluir-rascunho-confirmar").first().click();
      await page.waitForTimeout(600);
    }
    await context.close();
  });
});
