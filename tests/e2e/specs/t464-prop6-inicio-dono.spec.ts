import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Portão de #1483 (E217) e #1484 (E190 parte 2) (Pista C, 29/10): roda no lab-crítico deste PR.
/*
  T464 — PROP-6: Início do dono como no mockup painel-proprietario. Só no laboratório (contas novas).
   1. Dono com rascunho incompleto (390 e 1280): "Continue seu anúncio", % pronto, "Continuar de onde parou", próximos
      passos, a capa do rascunho, "Peça na Viva" (um botão cheio) e os três atalhos. Nada do lado morador.
   2. Dono sem anúncio: "Anuncie seu primeiro imóvel" SEM foto (a imagem padrão aprovada ainda não foi definida).
  E218 (L-71): o checklist de ativação do dono ("Para publicar seu anúncio", Prompt 50) volta ao Início — DENTRO do
  bloco "Anuncie seu primeiro imóvel" (2) e logo ABAIXO do bloco "Continue seu anúncio" (1).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const comRascunho = { email: `dono.p6a.${sufixo}@lab.vivanomads.test`, nome: "Lúcia Rascunho", role: "owner" as const };
const semNada = { email: `dono.p6b.${sufixo}@lab.vivanomads.test`, nome: "Otto Novo", role: "owner" as const };
const ids: string[] = [];
const SAIDA = "tests/laboratorio/saida";

test.describe("T464 — PROP-6: Início do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas novas).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    const a = await criarConta(comRascunho, senha);
    ids.push(a);
    // Rascunho que ainda não publica (sem a velocidade da internet e sem o padrão mínimo).
    await criarImovelPronto(a, `Studio PROP-6 ${sufixo}`, { semInternet: true, semConforto: true });
    ids.push(await criarConta(semNada, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: Continue seu anúncio, Peça na Viva e os atalhos`, async ({ browser }) => {
      const page = await entrar(browser, comRascunho.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("inicio-dono-principal");
      await expect(bloco).toHaveAttribute("data-tipo", "rascunho", { timeout: 30_000 });
      await expect(bloco.getByRole("heading", { name: "Continue seu anúncio" })).toBeVisible();
      await expect(page.getByTestId("inicio-dono-pct")).toContainText("% pronto");
      await expect(page.getByTestId("inicio-dono-linha")).toContainText("Próximo passo:");
      await expect(page.getByTestId("inicio-dono-botao")).toContainText("Continuar de onde parou");
      await expect(page.getByTestId("inicio-dono-passos").locator("li").first()).toBeVisible();
      await expect(page.getByTestId("inicio-dono-foto")).toBeVisible();
      await expect(page.getByTestId("inicio-dono-pedido")).toHaveText("Publicar pedido de moradia");
      await expect(page.getByTestId("inicio-dono-servico")).toHaveText("Pedir um serviço");
      await expect(page.getByTestId("inicio-dono-atalhos").locator("li")).toHaveCount(3);
      await expect(page.getByText("Para encontrar seu imóvel")).toHaveCount(0);
      // E218: com rascunho, o checklist do dono vem logo abaixo do bloco principal (fora dele).
      const checklist = page.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]');
      await expect(checklist).toBeVisible();
      await expect(checklist).toContainText("Para publicar seu anúncio");
      await expect(bloco.locator('[data-testid="checklist-ativacao"]')).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t464-inicio-rascunho-${w}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  test("2. dono sem anúncio: 'Anuncie seu primeiro imóvel', sem foto", async ({ browser }) => {
    const page = await entrar(browser, semNada.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("inicio-dono-principal");
    await expect(bloco).toHaveAttribute("data-tipo", "primeiro_anuncio", { timeout: 30_000 });
    await expect(page.getByTestId("inicio-dono-foto")).toHaveCount(0);
    // E218: sem anúncio, o checklist do dono vem DENTRO do bloco "Anuncie seu primeiro imóvel".
    const checklist = bloco.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]');
    await expect(checklist).toHaveAttribute("data-lugar", "dentro");
    await expect(checklist).toContainText("Para publicar seu anúncio");
    await expect(checklist.locator("li")).toHaveCount(4);
    await page.screenshot({ path: `${SAIDA}/t464-inicio-sem-anuncio-1280.png`, fullPage: true });
    await page.context().close();
  });
});
