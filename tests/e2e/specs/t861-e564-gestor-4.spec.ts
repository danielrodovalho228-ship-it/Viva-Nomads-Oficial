import { test, expect, type Page } from "@playwright/test";
import { GESTOR_DIFERENCIAIS, GESTOR_TEXTO } from "../../../src/config/planos";
import { MOTIVO_PRECOS_SUSPENSA, PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T861 — E564 (parte A, decisão do Daniel, 04/11/2026): o Plano Gestor nas telas é um texto só, "4% para carteiras de 20
  ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva" (GESTOR_TEXTO, regra da parte B #2519).
    1. /para-proprietarios e /parceiros mostram "Plano Gestor: {GESTOR_TEXTO}";
    2. nenhuma tela mostra o texto antigo (mensalidade, imóveis incluídos, "R$ 25 por imóvel", "taxa zero",
       "31+ · taxa negociável", "condições negociadas") nem recurso da fase 2;
    3. /precos (suspensa pelo E563 — o bloco pula com a chave desligada): a seção do Gestor com o texto e os 4 diferenciais.
  390 e 1280 px; sem conta.
*/
const ANTIGOS = [
  /R\$\s?500\s?\/\s?mês/i,
  /imóveis incluídos/i,
  /R\$\s?25 por imóvel/i,
  /taxa de serviço zero/i,
  /taxa negociável/i,
  /condições negociadas/i,
  /31\+/,
];
const FASE_2 = [/vários proprietários/i, /permissões/i, /importação em massa/i, /sincroniza/i];

async function texto(page: Page, rota: string): Promise<string> {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota}: HTTP`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
}

for (const largura of [1280, 390] as const) {
  test.describe(`T861 — E564 Gestor 4% (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const rota of ["/para-proprietarios", "/parceiros"]) {
      test(`${rota}: "Plano Gestor: ${GESTOR_TEXTO}", sem texto antigo nem fase 2`, async ({ page }) => {
        const t = await texto(page, rota);
        expect(t).toContain(`Plano Gestor: ${GESTOR_TEXTO}`);
        for (const r of [...ANTIGOS, ...FASE_2]) expect(t, String(r)).not.toMatch(r);
      });
    }

    test("/precos: a seção do Gestor tem o texto e os 4 diferenciais", async ({ page }) => {
      test.skip(PRECOS_SUSPENSA, MOTIVO_PRECOS_SUSPENSA);
      await page.goto("/precos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("plano-gestor-texto")).toHaveText(`${GESTOR_TEXTO}.`);
      const itens = page.getByTestId("plano-gestor-diferenciais").locator("li");
      await expect(itens).toHaveText([...GESTOR_DIFERENCIAIS]);
      const t = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
      for (const r of [...ANTIGOS, ...FASE_2]) expect(t, String(r)).not.toMatch(r);
    });
  });
}
