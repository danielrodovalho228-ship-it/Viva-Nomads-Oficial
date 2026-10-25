import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T213 — Adendo ao prompt 28, item 3 (reteste do Muse, 18/10): o botão "Nova jornada de teste" não fazia nada (o
  window.confirm era cancelado pelo navegador automatizado). Agora:
   1. clicar → confirmar NA PÁGINA → "Jornada criada" com o número e os links (Fechamento, Candidaturas, Leads);
      "Cancelar" não cria nada; nenhuma janela do navegador abre;
   2. a candidatura nova aparece em /dashboard/candidaturas (inquilino) e em /dashboard/leads (dono);
   3. clicar de novo → "reaproveitada", com o mesmo número e o motivo; a lista "Últimas jornadas de teste" mostra as duas;
   4. Locações: o proprietário cai em "Contratos & blocos" e não tem "Locações" no menu; o inquilino continua com Locações.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string | undefined> = {};
const dono = { email: `dono.t213.${sufixo}@lab.vivanomads.test`, nome: "Paula Jornada Sobrenome", role: "owner" as const };
const inq = { email: `inq.t213.${sufixo}@lab.vivanomads.test`, nome: "Iara Jornada Sobrenome", role: "tenant" as const };
const TITULO = `[TESTE QA] Studio jornada ${sufixo}`;

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T213 — Nova jornada de teste com confirmação na página (adendo ao prompt 28)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
  });

  test.afterAll(async () => {
    if (ids.imovel) {
      const { data: leads } = await adm().from("leads").select("id").eq("property_id", ids.imovel);
      const leadIds = ((leads ?? []) as { id: string }[]).map((l) => l.id);
      if (leadIds.length) {
        await adm().from("documentos_inquilino").delete().in("lead_id", leadIds);
        await adm().from("moderacao_log").delete().in("alvo_id", leadIds);
      }
      await adm().from("moderacao_log").delete().eq("alvo_id", ids.imovel);
      await adm().from("leads").delete().eq("property_id", ids.imovel);
    }
    await apagarContas([ids.inq, ids.dono]);
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    for (const largura of [1280, 390]) {
      test(`1–3. ${largura} — confirmar na página → criada (com links) → de novo: reaproveitada com o mesmo número; o log mostra`, async ({ page }) => {
        test.setTimeout(150_000);
        let abriuJanela = false;
        page.on("dialog", async (d) => {
          abriuJanela = true;
          await d.dismiss();
        });
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await abrir(page, "/admin/dados-de-teste");
        await page.getByTestId("jornada-inquilino").selectOption(ids.inq!);
        await page.getByTestId("jornada-anuncio").selectOption(ids.imovel!);
        const antes = (await adm().from("leads").select("id").eq("property_id", ids.imovel!)).data?.length ?? 0;

        // Cancelar não cria nada.
        await page.getByTestId("jornada-criar").click();
        await expect(page.getByTestId("jornada-confirmacao")).toContainText("A candidatura e o contrato antigos ficam como histórico");
        await page.getByTestId("jornada-cancelar").click();
        await expect(page.getByTestId("jornada-confirmacao")).toHaveCount(0);
        expect((await adm().from("leads").select("id").eq("property_id", ids.imovel!)).data?.length ?? 0).toBe(antes);

        // Confirmar cria (no 1º teste) ou reaproveita (no 2º) — sempre com texto na tela.
        await page.getByTestId("jornada-criar").click();
        await page.getByTestId("jornada-confirmar").click();
        const ok = page.getByTestId("jornada-ok");
        await expect(ok).toBeVisible({ timeout: 30_000 });
        const numero = (await page.getByTestId("jornada-numero").innerText()).trim();
        expect(numero).toMatch(/^[0-9a-f]{8}$/);
        await expect(page.getByTestId("jornada-link")).toHaveAttribute("href", /\/dashboard\/fechamento\?c=[0-9a-f-]{36}$/);
        await expect(page.getByTestId("jornada-link-candidaturas")).toHaveAttribute("href", "/dashboard/candidaturas");
        await expect(page.getByTestId("jornada-link-leads")).toHaveAttribute("href", "/dashboard/leads");
        await expect(ok).toContainText(TITULO);
        if (largura === 1280) {
          await expect(ok).toContainText("Jornada criada");
          ids.numero = numero;
          const href = (await page.getByTestId("jornada-link").getAttribute("href"))!;
          ids.lead = href.split("c=")[1];
          expect(ids.lead.startsWith(numero)).toBe(true);
        } else {
          await expect(ok).toContainText("Jornada reaproveitada");
          expect(numero, "o mesmo número da jornada aberta").toBe(ids.numero);
          await expect(page.getByTestId("jornada-motivo")).toContainText(`a candidatura ${ids.numero}`);
          await expect(page.getByTestId("jornada-motivo")).toContainText("ainda não tem contrato");
        }
        // Log na página: a última linha é desta ação.
        await page.reload({ waitUntil: "domcontentloaded" });
        const linha = page.getByTestId("log-jornada").first();
        await expect(linha).toHaveAttribute("data-resultado", largura === 1280 ? "criada" : "reaproveitada", { timeout: 20_000 });
        await expect(linha).toContainText(`candidatura ${ids.numero}`);
        expect(abriuJanela, "nenhuma janela do navegador").toBe(false);
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t213-jornada-${largura}.png`, fullPage: true });
      });
    }
  });

  for (const largura of [390, 1280]) {
    test(`2. ${largura} — a candidatura nova aparece em Candidaturas (inquilino) e em Leads (dono)`, async ({ browser }) => {
      test.setTimeout(120_000);
      test.skip(!ids.lead, "depende da jornada criada no passo 1");
      const t = await entrar(browser, inq.email, senha);
      await t.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(t, "/dashboard/candidaturas");
      await expect(t.locator("main")).toContainText(TITULO, { timeout: 25_000 });
      await t.screenshot({ path: `${SAIDA}/t213-candidaturas-${largura}.png`, fullPage: true });
      await t.context().close();
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(d, "/dashboard/leads");
      await expect(d.locator("main")).toContainText(TITULO, { timeout: 25_000 });
      await d.screenshot({ path: `${SAIDA}/t213-leads-${largura}.png`, fullPage: true });
      await d.context().close();
    });
  }

  for (const largura of [390, 1280]) {
    test(`4. ${largura} — Locações: o proprietário cai em Contratos & blocos; o inquilino continua com Locações`, async ({ browser }) => {
      test.setTimeout(150_000);
      // O dono desta suíte tem imóvel e nenhuma estadia como inquilino.
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // O redirecionamento é do servidor e a 1ª carga fria de /contratos passou de 20 s no lab (19/10, 1280 px): teto maior na navegação e na URL final.
      await d.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(d).toHaveURL(/\/dashboard\/contratos$/, { timeout: 60_000 });
      await expect(d.locator("main")).not.toContainText("avaliar o proprietário ao final da estadia");
      if (largura === 1280) await expect(d.getByRole("link", { name: /^Locações$/ })).toHaveCount(0);
      await d.context().close();
      // O inquilino (sem imóvel) continua em Locações.
      const t = await entrar(browser, inq.email, senha);
      await t.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(t, "/dashboard/locacoes");
      expect(new URL(t.url()).pathname).toBe("/dashboard/locacoes");
      await expect(t.getByRole("heading", { name: "Minhas estadias" })).toBeVisible();
      await semRolagemLateral(t);
      await t.context().close();
    });
  }
});
