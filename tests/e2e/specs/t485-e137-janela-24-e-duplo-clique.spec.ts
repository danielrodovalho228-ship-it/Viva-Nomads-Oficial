import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";
import { diasLivres, marcarPeriodo } from "../fixtures/calendario-dono";

/*
  T485 — E137 (#1379), guarda permanente da Pista C, no computador (a t476 da Pista A faz os 24 dias a 390 no toque;
  a t425 bloqueia o mesmo período em dois cliques separados):
   1. janela de 24 dias com mínimo de 30, a 1280: aviso "são 24 dias — menos que a duração mínima de 30 dias" e o
      Continuar não avança;
   2. DOIS cliques seguidos no "Bloquear período" (sem esperar o primeiro gravar): uma linha na lista e uma no banco,
      também depois de recarregar.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t485.${sufixo}@lab.vivanomads.test`, nome: "Jana Janela", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T485 — E137: 24 dias no computador e bloqueio com clique duplo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t485 ${sufixo}`, { minPeriod: "30" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. a 1280 px: 24 dias contra o mínimo de 30 é barrado com aviso", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade", 1280);
    await page.getByTestId("disponivel-de").fill(isoParaBR(emDiasBR(2)));
    await page.getByTestId("disponivel-ate").fill(isoParaBR(emDiasBR(26)));
    await expect(page.getByTestId("janela-curta")).toContainText("são 24 dias — menos que a duração mínima de 30 dias", { timeout: 15_000 });
    await page.getByTestId("cadastro-continuar").click();
    await noPasso(page, "disponibilidade");
    await expect(page.getByTestId("passo-erros")).toContainText("menos que a duração mínima de 30 dias");
    await page.screenshot({ path: "tests/laboratorio/saida/t485-janela-24-1280.png" });
    await page.context().close();
  });

  test("2. a 1280 px: dois cliques seguidos no Bloquear período gravam UM bloqueio", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade", 1280);
    const etapa = page.getByTestId("etapa-disponibilidade");
    const [ini, fim] = (await diasLivres(etapa)).slice(5, 7);
    const bloquear = await marcarPeriodo(etapa, ini, fim);
    await Promise.all([bloquear.click(), bloquear.click({ force: true, delay: 0 }).catch(() => {})]);
    const linha = etapa.locator(`[data-testid="bloqueio-item"][data-inicio="${ini}"]`);
    await expect(linha.first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_500);
    await expect(linha, "uma linha na lista").toHaveCount(1);
    const { data } = await adm().from("property_blocks").select("id").eq("property_id", ids.rascunho!).eq("inicio", ini).eq("fim", fim);
    expect(data ?? [], "uma linha no banco").toHaveLength(1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await noPasso(page, "disponibilidade", 30_000);
    await expect(page.locator(`[data-testid="bloqueio-item"][data-inicio="${ini}"]`).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`[data-testid="bloqueio-item"][data-inicio="${ini}"]`), "uma linha depois de recarregar").toHaveCount(1);
    await page.context().close();
  });
});
