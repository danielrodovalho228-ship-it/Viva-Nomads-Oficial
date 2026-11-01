import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T875 — ADMIN: CADA NÚMERO DE UMA FONTE SÓ (Pista C, 01/11; merges da Pista B #1897, #1898, #1900 e #1901, itens E331,
  E330, E333 e E334). Os quatro trouxeram só teste de unidade; aqui, na tela de verdade, com a sessão de admin do
  laboratório, a 390 e 1280 px:
   1) #1898 (E330) — /admin/pendencias: o título conta o mesmo que a fila ("Nada pendente agora" / "N pendência(s)
      esperando ação") e o topo separado "Hoje você tem N decisões" saiu;
   2) #1900 (E333) — /admin/retencao: "O que seria apagado hoje (dd/mm/aaaa)" traz a data do DIA DA LEITURA em Brasília,
      não a do último relatório;
   3) #1901 (E334) — /admin/retencao: a coluna se chama "Guardados agora"; /admin/dados-de-teste: o título das contas de
      teste é "Contas de teste · …" (o resumo pela regra de Usuários), não mais "Contas de teste (N)";
   4) #1897 (E331) — Admin → Documentos → Emitidos: cada linha mostra "Registro nº N", e os números não se repetem
      (pula se o laboratório não tiver emitido nenhum).
  A #1904 (E335, Central de Agentes) traz a migração 0274 e depende das rondas gravadas; fica com o teste de unidade do
  merge.
*/
const hojeBRT = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

async function abrirAdmin(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  return ctx.newPage();
}

for (const largura of [390, 1280] as const) {
  test.describe(`T875 — admin, cada número de uma fonte só @${largura}`, () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

    test(`#1898 Pendências: título conta a fila, sem o "Hoje você tem" (${largura} px)`, async ({ browser }) => {
      const page = await abrirAdmin(browser, largura);
      const r = await page.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
      const titulo = page.getByText(/^(Nada pendente agora|1 pendência esperando ação|\d+ pendências esperando ação)$/).first();
      await expect(titulo).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Hoje você tem \d+ decis/)).toHaveCount(0);
      await expect(page.getByTestId("admin-erro")).toHaveCount(0);
      await page.context().close();
    });

    test(`#1900 + #1901 Retenção: "hoje" é o dia da leitura e a coluna é "Guardados agora" (${largura} px)`, async ({ browser }) => {
      const page = await abrirAdmin(browser, largura);
      const r = await page.goto("/admin/retencao", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
      await expect(page.getByText(`O que seria apagado hoje (${hojeBRT()})`, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      const coluna = page.getByRole("columnheader", { name: "Guardados agora", exact: true });
      if (await coluna.count()) await expect(coluna.first()).toBeAttached();
      else test.info().annotations.push({ type: "sem-tabela", description: "sem relatório de retenção no laboratório: a tabela dos guardados não aparece" });
      await expect(page.getByRole("columnheader", { name: "Guardados", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("admin-erro")).toHaveCount(0);
      await page.context().close();
    });

    test(`#1901 Dados de teste: "Contas de teste · …" pela regra de Usuários (${largura} px)`, async ({ browser }) => {
      const page = await abrirAdmin(browser, largura);
      const r = await page.goto("/admin/dados-de-teste", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
      const painel = page.getByTestId("contas-teste");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      await expect(painel).toContainText("Contas de teste · ");
      await expect(painel).not.toContainText(/Contas de teste \(\d+\)/);
      await page.context().close();
    });

    test(`#1897 Emitidos: cada linha com "Registro nº", sem repetir (${largura} px)`, async ({ browser }) => {
      const page = await abrirAdmin(browser, largura);
      const r = await page.goto("/admin/documentos?aba=emitidos", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
      await expect(page.getByTestId("admin-erro")).toHaveCount(0);
      await expect(page.getByTestId("documentos-aba-emitidos")).toBeVisible({ timeout: 30_000 });
      const registros = page.getByTestId("emitido-registro");
      await page.waitForTimeout(1500);
      const textos = (await registros.allInnerTexts()).map((t) => t.trim());
      test.skip(textos.length === 0, "nenhum documento emitido no laboratório");
      for (const t of textos) expect(t).toMatch(/^Registro nº \d+$/);
      expect(new Set(textos).size, "os números de registro não se repetem").toBe(textos.length);
      await page.context().close();
    });
  });
}
