import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T896 — achado nº 23 (#1942, Pista B): na confirmação de pausa do anúncio, a conferência do que está em andamento passou
  a lançar quando uma contagem falha, e a tela diz "Não foi possível conferir o que está em andamento agora…" em vez de
  omitir contratos, propostas e visitas. A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada
  (fica com os testes unitários do PR); aqui, o caminho NORMAL depois da troca, a 1280 e a 390 px:
   - anúncio com 1 candidatura aberta → a confirmação lista "1 candidatura aberta continua; você pode responder a ela."
     e não traz a frase de falha;
   - anúncio sem nada em andamento → a confirmação não traz lista nem a frase de falha.
  Não pausa nada (só abre e fecha a confirmação).
*/
const SAIDA = "tests/laboratorio/saida";
const FALHA = "Não foi possível conferir o que está em andamento agora.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t896.${sufixo}@lab.vivanomads.test`, nome: "Paula Pausa", role: "owner" as const };
const inq = { email: `inq.t896.${sufixo}@lab.vivanomads.test`, nome: "Ivo Pausa", role: "tenant" as const };
const ids: { dono?: string; inq?: string; comLead?: string; vazio?: string; lead?: string } = {};
const TITULO_LEAD = `Studio com candidatura t896 ${sufixo}`;
const TITULO_VAZIO = `Studio vazio t896 ${sufixo}`;

async function abrirConfirmacao(page: Page, titulo: string) {
  await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
  const cartao = page.locator("article, li, div").filter({ hasText: titulo }).filter({ has: page.locator('[data-testid="estado-anuncio"][data-status="active"]') }).last();
  await expect(cartao).toBeVisible({ timeout: 30_000 });
  await cartao.locator('[data-testid="estado-anuncio"][data-status="active"]').click();
  await page.getByTestId("pausar-anuncio").click();
  const painel = page.getByTestId("confirmar-pausa-painel");
  await expect(painel).toContainText("sai da busca");
  // A conferência terminou (sai o "Conferindo…").
  await expect(painel).not.toContainText("Conferindo o que está em andamento", { timeout: 20_000 });
  return painel;
}

test.describe("T896 — achado nº 23: a confirmação de pausa confere o andamento sem aviso falso (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.comLead = await criarImovelPronto(ids.dono, TITULO_LEAD, { ativo: true, preco: 3200 });
    ids.vazio = await criarImovelPronto(ids.dono, TITULO_VAZIO, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.comLead);
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [1280, 390] as const) {
    test(`@${largura}: com candidatura aberta, a lista; sem nada, nem lista nem falha`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      const comLead = await abrirConfirmacao(page, TITULO_LEAD);
      await expect(page.getByTestId("pausa-em-andamento")).toContainText("1 candidatura aberta continua; você pode responder a ela.");
      await expect(comLead, "sem a frase de falha").not.toContainText(FALHA);
      await page.screenshot({ path: `${SAIDA}/t896-com-candidatura-${largura}.png` });

      const vazio = await abrirConfirmacao(page, TITULO_VAZIO);
      await expect(page.getByTestId("pausa-em-andamento"), "nada em andamento: sem lista").toHaveCount(0);
      await expect(vazio, "sem a frase de falha").not.toContainText(FALHA);
      // Nada foi pausado.
      const { data } = await adm().from("properties").select("status").in("id", [ids.comLead!, ids.vazio!]);
      expect((data ?? []).map((d) => d.status)).toEqual(["active", "active"]);
      await page.context().close();
    });
  }
});
