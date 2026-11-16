import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1670 — E976, parte 2: o painel logado e a página 404 têm o link "Pular para o conteúdo principal" (WCAG 2.4.1).
  O painel nunca teve o link; a 404 tinha o destino (#conteudo) mas não o link. A 390 e a 1280 px:
   • o primeiro Tab cai no link de salto, e ele aparece inteiro na tela;
   • Enter leva o foco ao conteúdo da página (o <main id="conteudo">);
   • o Tab seguinte cai DENTRO do conteúdo, não de volta no cabeçalho;
   • o flutuante "Fale com a Viva" não recebe o primeiro Tab (parte 1 do E976).
  O site público é da parte 1 (#3889) e a spec de trava dele é da Pista 3.
*/
const senha = novaSenha();
const conta = { email: `salto.t1670.${novoSufixo()}@lab.vivanomads.test`, nome: "Sara Salto", role: "tenant" as const };
let id: string | undefined;

const LARGURAS = [
  { largura: 1280, altura: 900 },
  { largura: 390, altura: 844 },
] as const;

/** Do topo da página: Tab → link de salto à vista → Enter → foco no conteúdo → Tab → dentro do conteúdo. */
async function cobrarSalto(page: Page, rotulo: string) {
  const salto = page.locator("a.skip-link");
  await expect(salto, `${rotulo}: um link de salto`).toHaveCount(1);
  await expect(page.locator("main#conteudo"), `${rotulo}: o destino do salto`).toHaveCount(1);
  // Sem foco em nada (a página acabou de carregar): o primeiro Tab é o do teclado de quem chega.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.keyboard.press("Tab");
  await expect(salto, `${rotulo}: o primeiro Tab cai no link de salto`).toBeFocused();
  // Nem toda tela tem o flutuante (ex.: Mensagens): o que se cobra é que o foco não esteja nele.
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), `${rotulo}: o flutuante não recebe o primeiro Tab`).not.toBe("fale-com-a-viva");
  await expect(salto).toHaveText("Pular para o conteúdo principal");
  await expect(salto, `${rotulo}: o link aparece inteiro na tela`).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Enter");
  await expect(page.locator("main#conteudo"), `${rotulo}: Enter leva o foco ao conteúdo`).toBeFocused();
  expect(new URL(page.url()).hash).toBe("#conteudo");
  // O Tab seguinte já cai dentro do conteúdo. "Cabeçalho" aqui é o da casca: um <header> da própria tela, dentro do
  // conteúdo (ex.: o "Voltar para Conta" do Perfil no celular), é conteúdo.
  await page.keyboard.press("Tab");
  const ondeCaiu = await page.evaluate(() => {
    const e = document.activeElement;
    return { noConteudo: !!e?.closest("main#conteudo"), noTopo: !e?.closest("main#conteudo") && !!e?.closest("header, [data-testid='topo-celular']"), noSalto: !!e?.classList.contains("skip-link") };
  });
  expect(ondeCaiu.noSalto, `${rotulo}: o Tab seguinte não volta ao link de salto`).toBe(false);
  expect(ondeCaiu.noTopo, `${rotulo}: o Tab seguinte não volta ao cabeçalho`).toBe(false);
  expect(ondeCaiu.noConteudo, `${rotulo}: o Tab seguinte cai dentro do conteúdo`).toBe(true);
}

test.describe("T1670 — E976 parte 2: link de salto no painel logado e na 404", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const t of LARGURAS) {
    test(`${t.largura} px, painel logado: o primeiro Tab é o link de salto e ele leva ao conteúdo`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: t.largura, height: t.altura });
      await entrarNaPagina(page, conta.email, senha);
      for (const rota of ["/dashboard", "/dashboard/mensagens", "/dashboard/conta/perfil"]) {
        await test.step(rota, async () => {
          await page.goto(rota, { waitUntil: "load" });
          await expect(page.locator("[data-painel-main]")).toBeVisible({ timeout: 20_000 });
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          await cobrarSalto(page, `${rota} a ${t.largura} px`);
        });
      }
    });

    test(`${t.largura} px, página 404: o primeiro Tab é o link de salto e ele leva ao conteúdo`, async ({ page }) => {
      await page.setViewportSize({ width: t.largura, height: t.altura });
      const resposta = await page.goto("/esta-pagina-nao-existe-t1670", { waitUntil: "load" });
      expect(resposta?.status()).toBe(404);
      await expect(page.locator("main#conteudo")).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await cobrarSalto(page, `404 a ${t.largura} px`);
    });
  }
});
