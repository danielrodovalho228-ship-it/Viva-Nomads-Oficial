import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T425 — E137 (levantamento do Daniel, 25/10; correção na Pista A). Passo 9, Disponibilidade:
   1. a janela "Disponível a partir de / até" mais curta que a duração mínima (10 dias com mínimo de 30) é recusada,
      com mensagem: o "Continuar" não avança;
   2. bloquear o MESMO período duas vezes no calendário deixa UMA linha só.
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t425.${sufixo}@lab.vivanomads.test`, nome: "Janete Janela", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};
const INI = emDiasBR(5);
const FIM = emDiasBR(7);

test.describe("T425 — E137: janela menor que a duração mínima e bloqueio repetido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio da janela ${sufixo}`, { minPeriod: "30", maxPeriod: "180" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. janela de 10 dias com mínimo de 30: recusada com mensagem, o Continuar não avança", async ({ browser }) => {
    // E137 (corrigido na Pista A): a janela é conferida contra a duração mínima, no passo e no Continuar.
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade");
    await page.getByTestId("disponivel-de").fill(isoParaBR(emDiasBR(10)));
    await page.getByTestId("disponivel-ate").fill(isoParaBR(emDiasBR(20)));
    await page.getByTestId("cadastro-continuar").click();
    await page.waitForTimeout(500);
    await noPasso(page, "disponibilidade");
    await expect(page.getByTestId("etapa-disponibilidade").getByRole("alert").filter({ hasText: /mínim|duração|30 dias/i })).toBeVisible();
    await page.context().close();
  });

  test("2. o mesmo período bloqueado duas vezes vira UMA linha", async ({ browser }) => {
    // E137 + E138 (corrigido na Pista A): addBlock devolve o bloqueio que já existe para o mesmo período (unitário
    // blocks-idempotente-e137.test.ts) e, na tela, o dia já bloqueado não se seleciona de novo: o toque abre as opções
    // do dia (Desbloquear) e o "Bloquear período" continua travado.
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade");
    const etapa = page.getByTestId("etapa-disponibilidade");
    await expect(etapa.getByTestId("calendario-dono-grade")).toBeVisible({ timeout: 30_000 });
    const bloquear = etapa.getByRole("button", { name: "Bloquear período" });
    // O clique antes da hidratação da grade não marca o dia (run 40190996396): marca de novo até o botão destravar.
    await expect(async () => {
      await etapa.locator(`button[data-dia="${INI}"]`).click({ timeout: 5_000 });
      await etapa.locator(`button[data-dia="${FIM}"]`).click({ timeout: 5_000 });
      await expect(bloquear, "o período marcado destrava o Bloquear").toBeEnabled({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await bloquear.click();
    // Depois de gravar, a seleção limpa e o botão volta a ficar travado (ou aparece o erro do servidor).
    await expect(bloquear).toBeDisabled({ timeout: 20_000 });
    // 2ª vez: o dia bloqueado abre as opções do dia; nada a bloquear de novo. Antes, o bloqueio já na lista (a grade só
    // pinta o dia como bloqueado depois de recarregar a lista; tocar antes seleciona o dia como início).
    await expect(etapa.locator(`[data-testid="bloqueio-item"][data-inicio="${INI}"]`).first()).toBeVisible({ timeout: 20_000 });
    await etapa.locator(`button[data-dia="${INI}"]`).click();
    await expect(etapa.getByTestId("dia-bloqueado-opcoes")).toBeVisible();
    await expect(bloquear).toBeDisabled();
    const { data } = await adm().from("property_blocks").select("id").eq("property_id", ids.rascunho!).eq("inicio", INI).eq("fim", FIM);
    await page.reload({ waitUntil: "domcontentloaded" });
    await noPasso(page, "disponibilidade", 30_000);
    await expect(page.locator(`[data-testid="bloqueio-item"][data-inicio="${INI}"]`).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`[data-testid="bloqueio-item"][data-inicio="${INI}"]`), "uma linha para o mesmo período").toHaveCount(1);
    expect(data ?? [], "uma linha no banco para o mesmo período").toHaveLength(1);
    await page.context().close();
  });
});
