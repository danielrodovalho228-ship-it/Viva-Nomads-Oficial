import { test, expect, type Page, type Route } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T847 — NENHUMA TELA CAI SEM REDE AO CHAMAR UMA AÇÃO DO SERVIDOR (Pista C, 01/11; merge #1816). O #1816 embrulhou 49
  chamadas de ação em 32 telas com semQuedaDeRede (erro-de-rede.ts) e pôs uma guarda de fonte para o repo todo
  (transicoes-sem-queda.test.ts). Esta é a prova de ponta a ponta numa tela representativa sem id — Respostas rápidas
  do proprietário, as duas ações (salvar e apagar):
   1) salvar sem rede → "A conexão caiu. Confira a internet e tente de novo.", o que foi digitado fica, nada gravado;
   2) a rede volta → salvar grava ("Resposta salva.");
   3) apagar sem rede → mesmo aviso, a resposta continua na lista e no banco;
   4) a rede volta → apagar apaga ("Resposta apagada.").
  Nenhum erro de página em todo o teste (antes, a transição rejeitava e a tela caía no limite de erro). A queda é
  simulada abortando só o POST da ação (cabeçalho next-action) com "internetdisconnected". Conta do laboratório.
*/
const SEM_CONEXAO = "A conexão caiu. Confira a internet e tente de novo.";
const ROTA = "/dashboard/respostas-rapidas";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t847.${sufixo}@lab.vivanomads.test`, nome: "Sara Semrede", role: "owner" as const };
const ids: { dono?: string } = {};
const TITULO = "Horário de entrada";
const TEXTO = "A entrada é a partir das 14h; a chave fica no cofre ao lado da porta.";

async function derrubarAcoes(page: Page): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) return route.abort("internetdisconnected");
    return route.continue();
  };
  await page.route(`**${ROTA}**`, handler);
  return () => page.unroute(`**${ROTA}**`, handler);
}
const acaoCaiu = (page: Page) => page.waitForEvent("requestfailed", (r) => r.method() === "POST" && !!r.headers()["next-action"]);
async function respostasNoBanco(): Promise<number> {
  const { count, error } = await adm().from("respostas_rapidas").select("id", { count: "exact", head: true }).eq("owner_id", ids.dono!);
  expect(error).toBeNull();
  return count ?? 0;
}

test.describe("T847 — Respostas rápidas não caem sem rede (#1816)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await adm().from("respostas_rapidas").delete().eq("owner_id", ids.dono!);
    await apagarContas([ids.dono]);
  });

  test("salvar e apagar sem rede dizem 'A conexão caiu' e a tela fica; com a rede, gravam", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    const errosDePagina: string[] = [];
    page.on("pageerror", (e) => errosDePagina.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROTA, { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("resposta-form");
    const msg = page.getByTestId("resposta-msg");
    await expect(form).toBeVisible({ timeout: 20_000 });

    await test.step("1. salvar sem rede", async () => {
      await page.getByTestId("resposta-titulo").fill(TITULO);
      await page.getByTestId("resposta-texto").fill(TEXTO);
      const religar = await derrubarAcoes(page);
      const caiu = acaoCaiu(page);
      await page.getByTestId("resposta-salvar").click();
      await caiu;
      await expect(msg).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(page.getByTestId("resposta-titulo")).toHaveValue(TITULO);
      await expect(page.getByTestId("resposta-texto")).toHaveValue(TEXTO);
      expect(await respostasNoBanco()).toBe(0);
      await religar();
    });

    await test.step("2. a rede volta: salvar grava", async () => {
      await page.getByTestId("resposta-salvar").click();
      await expect(msg).toHaveText("Resposta salva.", { timeout: 20_000 });
      await expect.poll(respostasNoBanco, { timeout: 20_000 }).toBe(1);
      await expect(page.getByTestId("resposta-item")).toHaveCount(1, { timeout: 20_000 });
    });

    await test.step("3. apagar sem rede", async () => {
      const religar = await derrubarAcoes(page);
      await page.getByTestId("resposta-apagar").click();
      const caiu = acaoCaiu(page);
      await page.getByTestId("resposta-apagar-confirmar").click();
      await caiu;
      await expect(msg).toHaveText(SEM_CONEXAO, { timeout: 20_000 });
      await expect(page.getByTestId("resposta-item")).toHaveCount(1);
      expect(await respostasNoBanco()).toBe(1);
      await religar();
    });

    await test.step("4. a rede volta: apagar apaga", async () => {
      await page.getByTestId("resposta-apagar").click();
      await page.getByTestId("resposta-apagar-confirmar").click();
      await expect(msg).toHaveText("Resposta apagada.", { timeout: 20_000 });
      await expect.poll(respostasNoBanco, { timeout: 20_000 }).toBe(0);
    });

    expect(errosDePagina, "a tela não pode lançar erro de página").toEqual([]);
    await page.context().close();
  });
});
