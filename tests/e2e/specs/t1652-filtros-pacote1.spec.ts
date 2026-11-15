import { test, expect, type Page } from "@playwright/test";

/*
  T1652 — E954, filtros pacote 1 na folha "Mais filtros" da /buscar: "Ambiente silencioso" (?silencioso=1), "Contas incluídas"
  (?contas=1) e o chip "Ar-condicionado" (?comod=ar). SÓ LEITURA, sem login, sem massa (@ao-vivo-seguro): vale em
  qualquer ambiente, com os dados que houver.
   1. Cada chip está na folha com o número (data-n). O número é EXATAMENTE quantos cartões a lista mostra com ele ligado
      (faceta = cartões). Com 0, o chip aparece desabilitado (não some).
   2. Ida e volta da URL: abrir com o parâmetro liga o chip, o "Limpar tudo" não é preciso para voltar — recarregar mantém
      o parâmetro e o chip ligado; desligar e aplicar tira o parâmetro.
  A prova com massa (quem passa e quem fica de fora) está no t1653 (só laboratório). 390 e 1280 px.
*/
const SAIDA = "tests/laboratorio/saida";

const CHIPS = [
  { nome: "Ambiente silencioso", testId: "faceta-silencioso", param: "silencioso=1", re: /[?&]silencioso=1(&|$)/ },
  { nome: "Contas incluídas", testId: "faceta-contas", param: "contas=1", re: /[?&]contas=1(&|$)/ },
  { nome: "Ar-condicionado", testId: "faceta-comodidade-ar", param: "comod=ar", re: /[?&]comod=ar(&|$)/ },
] as const;

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}

test.describe("T1652 — Filtros pacote 1 na /buscar (silencioso, contas incluídas, ar-condicionado)", { tag: ["@E954", "@filtros-pacote1", "@ao-vivo-seguro"] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: 150_000 });

  for (const largura of [390, 1280] as const) {
    for (const c of CHIPS) {
      test(`a ${largura} px: "${c.nome}" — o número do chip = os cartões; a URL vai e volta`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const folha = await abrirFolha(page, "/buscar");
        const chip = folha.getByTestId(c.testId);
        await expect(chip).toBeVisible();
        await expect(chip).toContainText(c.nome);
        const n = Number(await chip.getAttribute("data-n"));
        expect(Number.isInteger(n) && n >= 0, `data-n de ${c.testId}`).toBe(true);
        await chip.scrollIntoViewIfNeeded();
        await folha.screenshot({ path: `${SAIDA}/t1652-preview-folha-${c.testId}-${largura}.png` });

        if (n > 0) {
          // 1. Faceta = cartões: liga, aplica e conta os cartões.
          await expect(chip).toBeEnabled();
          await chip.click();
          await folha.getByTestId("aplicar-filtros").click();
          await expect(page).toHaveURL(c.re);
          await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 30_000 });
        } else {
          await expect(chip, "com 0 o chip fica desabilitado, não some").toBeDisabled();
          await page.goto(`/buscar?${c.param}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByTestId("card-resultado")).toHaveCount(0, { timeout: 30_000 });
        }

        // 2. Ida e volta: recarregar mantém o parâmetro e o chip ligado; desligar e aplicar tira o parâmetro.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(c.re);
        const folha2 = await abrirFolha(page, page.url());
        const chip2 = folha2.getByTestId(c.testId);
        await expect(chip2).toHaveAttribute("aria-pressed", "true");
        await expect(chip2).toBeEnabled();
        await chip2.click();
        await folha2.getByTestId("aplicar-filtros").click();
        await expect(page).not.toHaveURL(c.re);
      });
    }
  }
});
