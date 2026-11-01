import { test, expect, type Page, type Route } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, statusDoImovel } from "../fixtures/laboratorio";

/*
  T843 — PAUSAR E REATIVAR ANÚNCIO SEM REDE (Pista C, 01/11; merge #1803, "Erros, achado nº 2"). Antes, o selo do
  anúncio chamava pausarAnuncio / reativarAnuncio sem try: com a conexão caída a promessa rejeitava e a página caía no
  limite de erro. Agora o aviso do selo (estado-anuncio-aviso) diz "A conexão caiu. Confira a internet e tente de novo."
  e a tela continua de pé:
   1) confirmar a pausa sem rede → aviso, o anúncio continua "active";
   2) reativar sem rede → aviso, sem lista de faltas, o anúncio continua "paused";
   3) a rede volta → reativar grava "active".
  A queda é simulada abortando só o POST da ação do servidor (cabeçalho next-action) com "internetdisconnected"; a parte
  do servidor (texto cru do banco → frase em português) fica com o teste unitário do #1803 (reativar-erro.test.ts).
  Conta e imóveis do laboratório, criados e apagados aqui (como a t320).
*/
const SEM_CONEXAO = "A conexão caiu. Confira a internet e tente de novo.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t843.${sufixo}@lab.vivanomads.test`, nome: "Rita Rede", role: "owner" as const };
const ids: { dono?: string; ativo?: string; pausado?: string } = {};

async function derrubarAcoes(page: Page): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) return route.abort("internetdisconnected");
    return route.continue();
  };
  await page.route("**/dashboard/imoveis**", handler);
  return () => page.unroute("**/dashboard/imoveis**", handler);
}
const acaoCaiu = (page: Page) => page.waitForEvent("requestfailed", (r) => r.method() === "POST" && !!r.headers()["next-action"]);

test.describe("T843 — pausar e reativar anúncio sem rede (#1803)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativo = await criarImovelPronto(ids.dono, `No ar t843 ${sufixo}`, { ativo: true });
    ids.pausado = await criarImovelPronto(ids.dono, `Pausado t843 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ status: "paused", pausa_motivo: "dono" }).eq("id", ids.pausado);
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("pausar e reativar sem rede dizem 'A conexão caiu' e a tela fica; com a rede, reativar grava", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    const errosDePagina: string[] = [];
    page.on("pageerror", (e) => errosDePagina.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const ativo = page.locator('[data-testid="estado-anuncio"][data-status="active"]');
    const pausado = page.locator('[data-testid="estado-anuncio"][data-status="paused"][data-motivo="dono"]');
    await expect(ativo).toHaveCount(1, { timeout: 20_000 });
    await expect(pausado).toHaveCount(1);
    const aviso = page.getByTestId("estado-anuncio-aviso");

    await test.step("1. confirmar a pausa sem rede", async () => {
      // A confirmação carrega o que está em andamento pela rede; a queda vem só no "Confirmar".
      await ativo.click();
      await page.getByTestId("pausar-anuncio").click();
      await expect(page.getByTestId("confirmar-pausa-painel")).toContainText("sai da busca", { timeout: 20_000 });
      const religar = await derrubarAcoes(page);
      const caiu = acaoCaiu(page);
      await page.getByTestId("confirmar-pausa").click();
      await caiu;
      await expect(aviso).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(page.getByTestId("confirmar-pausa-painel")).toBeVisible();
      expect(await statusDoImovel(ids.ativo!)).toBe("active");
      await religar();
    });

    await test.step("2. reativar sem rede", async () => {
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(pausado).toHaveCount(1, { timeout: 20_000 });
      const religar = await derrubarAcoes(page);
      await pausado.click();
      const caiu = acaoCaiu(page);
      await page.getByTestId("reativar-anuncio").click();
      await caiu;
      await expect(aviso).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(page.getByTestId("reativar-faltas")).toHaveCount(0);
      await expect(pausado).toHaveCount(1);
      expect(await statusDoImovel(ids.pausado!)).toBe("paused");
      await religar();
    });

    await test.step("3. a rede volta: reativar grava", async () => {
      await pausado.click();
      await page.getByTestId("reativar-anuncio").click();
      await expect.poll(() => statusDoImovel(ids.pausado!), { timeout: 30_000 }).toBe("active");
      await expect(aviso).not.toHaveText(SEM_CONEXAO);
    });

    expect(errosDePagina, "a tela não pode lançar erro de página").toEqual([]);
    await page.context().close();
  });
});
