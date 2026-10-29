// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";
import { diasLivres, marcarPeriodo } from "../fixtures/calendario-dono";

/*
  T533 — E138 (#1379), guarda permanente da Pista C: desbloquear pelo toque/clique no PRÓPRIO dia bloqueado do
  calendário (a t476 da Pista A faz no iPhone sem conferir o banco). A 1280 (mouse) e a 390:
   bloqueia um período → clique no dia bloqueado → "Desbloquear" → confirma → a linha sai da lista E do banco; depois
   de recarregar continua livre e o dia volta a ser selecionável (o clique não abre mais as opções do dia bloqueado).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t533.${sufixo}@lab.vivanomads.test`, nome: "Duda Desbloqueia", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T533 — E138: desbloquear no próprio dia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.r1280 = await prepararRascunho(ids.dono, `Studio t533 a ${sufixo}`);
    ids.r390 = await prepararRascunho(ids.dono, `Studio t533 b ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: bloqueia, clica no dia, desbloqueia e some do banco`, async ({ browser }) => {
      const id = ids[`r${w}`];
      const page = await abrirPasso(browser, { email: dono.email, senha }, id, "disponibilidade", w);
      const etapa = page.getByTestId("etapa-disponibilidade");
      const [ini, fim] = (await diasLivres(etapa)).slice(5, 7);
      const bloquear = await marcarPeriodo(etapa, ini, fim);
      await bloquear.click();
      const linha = etapa.locator(`[data-testid="bloqueio-item"][data-inicio="${ini}"]`);
      await expect(linha.first()).toBeVisible({ timeout: 20_000 });

      await etapa.locator(`button[data-dia="${ini}"]`).first().click();
      await expect(etapa.getByTestId("dia-bloqueado-opcoes")).toBeVisible();
      await page.screenshot({ path: `tests/laboratorio/saida/t533-opcoes-${w}.png` });
      await etapa.getByTestId("calendario-desbloquear").click();
      await etapa.getByTestId("calendario-desbloquear-confirmar").click();
      await expect(linha).toHaveCount(0, { timeout: 20_000 });
      await expect
        .poll(async () => (await adm().from("property_blocks").select("id").eq("property_id", id)).data?.length ?? -1, { timeout: 15_000 })
        .toBe(0);

      await page.reload({ waitUntil: "domcontentloaded" });
      await noPasso(page, "disponibilidade", 30_000);
      const depois = page.getByTestId("etapa-disponibilidade");
      await expect(depois.getByTestId("calendario-dono-grade")).toBeVisible({ timeout: 40_000 });
      await expect(depois.locator('[data-testid="bloqueio-item"]')).toHaveCount(0);
      // O dia volta a ser livre: o clique não abre as opções de dia bloqueado.
      await depois.locator(`button[data-dia="${ini}"]`).first().click();
      await expect(depois.getByTestId("dia-bloqueado-opcoes")).toHaveCount(0);
      await page.context().close();
    });
  }
});
