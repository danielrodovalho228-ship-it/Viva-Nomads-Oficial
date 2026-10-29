import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Portão de #1483 (E217) e #1484 (E190 parte 2) (Pista C, 29/10): roda no lab-crítico deste PR.
/*
  T464 — PROP-6: Início do dono como no mockup painel-proprietario. Só no laboratório (contas novas).
   1. Dono com rascunho incompleto (390 e 1280): "Continue seu anúncio", % pronto, "Continuar de onde parou", próximos
      passos, a capa do rascunho, "Peça na Viva" (um botão cheio) e os três atalhos. Nada do lado morador.
   2. Dono sem anúncio: "Anuncie seu primeiro imóvel" SEM foto (a imagem padrão aprovada ainda não foi definida).
  E218-A (29/10): o guia de ativação do dono mora DENTRO do bloco principal, nos "Próximos passos" (um guia só na tela):
  sem rascunho, os 4 passos do guia (2); com rascunho, os passos do rascunho (1); rascunho PRONTO e não publicado →
  "Publique seu anúncio", que leva a revisar ESSE rascunho, nunca a um anúncio novo (3). Nenhum ChecklistAtivacaoBloco
  do dono à parte.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const comRascunho = { email: `dono.p6a.${sufixo}@lab.vivanomads.test`, nome: "Lúcia Rascunho", role: "owner" as const };
const semNada = { email: `dono.p6b.${sufixo}@lab.vivanomads.test`, nome: "Otto Novo", role: "owner" as const };
const comPronto = { email: `dono.p6c.${sufixo}@lab.vivanomads.test`, nome: "Pia Pronta", role: "owner" as const };
const prontoId: { v?: string } = {};
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
    const c = await criarConta(comPronto, senha);
    ids.push(c);
    // Rascunho que já publica (o padrão do laboratório: internet e padrão mínimo confirmados).
    prontoId.v = await criarImovelPronto(c, `Studio pronto PROP-6 ${sufixo}`);
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
      // E218-A: com rascunho, os passos são os do rascunho; nenhum guia à parte (um guia só na tela).
      await expect(page.locator('[data-testid="checklist-ativacao"]')).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t464-inicio-rascunho-${w}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  for (const w of [390, 1280] as const) {
    test(`2. a ${w} px: dono sem anúncio — 'Anuncie seu primeiro imóvel', sem foto, com os 4 passos do guia DENTRO do bloco`, async ({ browser }) => {
      const page = await entrar(browser, semNada.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("inicio-dono-principal");
      await expect(bloco).toHaveAttribute("data-tipo", "primeiro_anuncio", { timeout: 30_000 });
      await expect(page.getByTestId("inicio-dono-foto")).toHaveCount(0);
      const passos = bloco.getByTestId("inicio-dono-passos").locator("li");
      await expect(passos).toHaveCount(4);
      for (const [i, t] of ["Endereço e dados do imóvel", "Fotos do imóvel", "Valor mensal", "Publicar"].entries()) await expect(passos.nth(i)).toContainText(t);
      await expect(passos.nth(1)).toContainText("Mínimo de 8, de dia e na horizontal.");
      // Um guia só: nada de checklist do dono à parte.
      await expect(page.locator('[data-testid="checklist-ativacao"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await bloco.screenshot({ path: `${SAIDA}/t464-guia-no-bloco-${w}.png` });
      await page.screenshot({ path: `${SAIDA}/t464-inicio-sem-anuncio-${w}.png`, fullPage: true });
      await page.context().close();
    });
  }

  for (const w of [390, 1280] as const) {
    test(`3. a ${w} px: rascunho PRONTO e não publicado — 'Publique seu anúncio' revisa ESSE rascunho`, async ({ browser }) => {
      const page = await entrar(browser, comPronto.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("inicio-dono-principal");
      await expect(bloco.getByRole("heading", { name: "Publique seu anúncio" })).toBeVisible({ timeout: 30_000 });
      const botao = page.getByTestId("inicio-dono-botao");
      await expect(botao).toContainText("Revisar e publicar");
      await expect(botao).toHaveAttribute("href", `/dashboard/imoveis/novo?draft=${prontoId.v}&etapa=revisao`);
      await expect(page.locator('[data-testid="checklist-ativacao"]')).toHaveCount(0);
      await bloco.screenshot({ path: `${SAIDA}/t464-pronto-${w}.png` });
      await page.context().close();
    });
  }
});
