// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
import { test, expect, type Page } from "@playwright/test";
import { FAIXAS_COMISSAO_PADRAO, rotuloFaixaTaxa } from "../../../src/lib/cobranca/regra";
import { MOTIVO_PRECOS_SUSPENSA, PRECOS_SUSPENSA } from "../fixtures/precos";
import { CARTEIRAS_MINIMO_IMOVEIS, TEXTO_CARTEIRAS } from "../../../src/config/planos";

/*
  T659 — E236 (#1524): o Plano Gestor começava em 20 imóveis em todo texto público — antes, várias telas diziam 31.
  A faixa de comissão "31 ou mais" dos Termos continua (é a faixa dos Termos, não o Plano Gestor); o que não pode é
  "Plano Gestor" junto de 31.
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública. O 20
  continua valendo — agora na linha de carteiras (CARTEIRAS_MINIMO_IMOVEIS, TEXTO_CARTEIRAS) —, e as telas que citavam
  o Plano Gestor passam a ser cobradas SEM ele:
    1. /parceiros: "Taxa menor por volume. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva."
    2. /modelodenegocio: a mesma linha de carteiras, sem "Plano Gestor".
    3. /precos: a janela "Fale com a Viva sobre carteiras" diz "Para carteira a partir de 20 imóveis ou administradora
       de imóveis." — sem "Plano Gestor" e sem 31.
    4. /termos: nenhum "Plano Gestor" ao lado de 31.
    5. /precos: a última faixa da tabela é 16–19 a 6% — sem a faixa do Gestor (20+, 4%).
  390 e 1280 px; sem conta. /modelodenegocio é dos sócios e abre pela porta /acesso-socios (SOCIOS_ACCESS_CODE).
*/
const GESTOR_COM_31 = /Plano Gestor[^.]{0,60}\b31\b|\b31\b[^.]{0,60}Plano Gestor/;
// 078 (Daniel, 16/11/2026): a regra do E236 ("o mínimo é 20, nunca 31") agora vale para a linha de carteiras.
const CARTEIRA_SEM_O_MINIMO = new RegExp(`Carteira a partir de (?!${CARTEIRAS_MINIMO_IMOVEIS}\\b)\\d+ imóveis`, "i");

async function textoDe(page: Page, rota: string): Promise<string> {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota}: HTTP`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // /modelodenegocio pode não ter <main>: lê o corpo da página nesse caso.
  const alvo = (await page.locator("main").count()) > 0 ? page.locator("main").first() : page.locator("body");
  return (await alvo.innerText()).replace(/\s+/g, " ");
}

/**
 * Texto da página sem as tabelas de faixa da taxa (a <table> e, em /precos, os cartões do celular `faixas-taxa-cartoes`):
 * o rótulo da faixa sem teto é o segundo caso, abaixo.
 */
async function textoSemFaixas(page: Page): Promise<string> {
  return (
    await page.evaluate(() => {
      const raiz = (document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement;
      raiz.querySelectorAll("table, [data-testid='faixas-taxa-cartoes']").forEach((t) => t.remove());
      return raiz.textContent ?? "";
    })
  ).replace(/\s+/g, " ");
}

// 078 (Daniel, 16/11/2026): o título era "T659 — E236: Plano Gestor a partir de 20 imóveis em todo texto público".
test.describe("T659 — E236/078: carteira a partir de 20 imóveis em todo texto público, sem o Plano Gestor", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — /parceiros, /modelodenegocio, /precos e /termos`, async ({ page }) => {
      test.skip(PRECOS_SUSPENSA, MOTIVO_PRECOS_SUSPENSA);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      const parceiros = await textoDe(page, "/parceiros");
      // 078 (Daniel, 16/11/2026): antes `toContain("Plano Gestor: " + GESTOR_TEXTO)` (E564, parte A); agora a linha de
      // carteiras é cobrada como presente e o Plano Gestor como ausente.
      expect(parceiros).toContain(`Taxa menor por volume. ${TEXTO_CARTEIRAS}`);
      expect(parceiros).not.toMatch(/Plano Gestor/i);
      expect(parceiros).not.toMatch(CARTEIRA_SEM_O_MINIMO);
      expect(parceiros).not.toMatch(GESTOR_COM_31);

      // /modelodenegocio é dos sócios: entra pela porta /acesso-socios com o código do laboratório (sem ele, pula só esta tela).
      const codigo = process.env.SOCIOS_ACCESS_CODE;
      if (codigo) {
        await page.goto(`/acesso-socios?next=${encodeURIComponent("/modelodenegocio")}`, { waitUntil: "domcontentloaded" });
        await page.locator('input[name="codigo"]').fill(codigo);
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page).toHaveURL(/\/modelodenegocio$/);
        const modelo = await textoDe(page, "/modelodenegocio");
        // 078 (Daniel, 16/11/2026): antes `toContain("Plano Gestor: " + GESTOR_TEXTO)`; agora a linha de carteiras
        // presente e o Plano Gestor ausente.
        expect(modelo).toContain(TEXTO_CARTEIRAS);
        expect(modelo).not.toMatch(/Plano Gestor/i);
        expect(modelo).not.toMatch(CARTEIRA_SEM_O_MINIMO);
        expect(await textoSemFaixas(page)).not.toMatch(GESTOR_COM_31);
      } else {
        test.info().annotations.push({ type: "pulado", description: "SOCIOS_ACCESS_CODE não definido: /modelodenegocio não conferida" });
      }

      const precos = await textoDe(page, "/precos");
      // 078 (Daniel, 16/11/2026): /precos não cita mais o Plano Gestor fora da janela — só a linha de carteiras.
      expect(precos).toContain(TEXTO_CARTEIRAS);
      expect(precos).not.toMatch(/Plano Gestor/i);
      expect(await textoSemFaixas(page)).not.toMatch(GESTOR_COM_31);
      const botao = page.getByTestId("plano-gestor-botao").filter({ visible: true }).first();
      await expect(botao).toBeVisible({ timeout: 15_000 });
      await botao.click();
      // 078 (Daniel, 16/11/2026): a janela era achada por "Plano Gestor" e trazia "Plano Gestor: {GESTOR_TEXTO}" (a
      // porta inteira do Gestor, E321). Agora é a janela "Fale com a Viva sobre carteiras", com o 20 de
      // CARTEIRAS_MINIMO_IMOVEIS, e não cita o Plano Gestor.
      const janela = page.getByRole("dialog", { name: "Fale com a Viva sobre carteiras" });
      await expect(janela).toContainText(`Para carteira a partir de ${CARTEIRAS_MINIMO_IMOVEIS} imóveis ou administradora de imóveis.`, { timeout: 10_000 });
      await expect(janela).not.toContainText(/Plano Gestor/i);
      await expect(janela).not.toContainText(/\b31\b/);
      await page.keyboard.press("Escape");

      const termos = await textoDe(page, "/termos");
      expect(termos).not.toMatch(GESTOR_COM_31);
      await page.screenshot({ path: `tests/laboratorio/saida/t659-termos-${largura}.png` });
    });

    // 078 (Daniel, 16/11/2026): o título era "/precos: a última faixa da tabela é a do Plano Gestor, a 4% (sem 31+)".
    // A última faixa da tabela de /precos é "16–19" a 6% (ORDEM-DUET-534; antes "16 ou mais"); a do Gestor (20+, 4%) e a "31+ negociável" saíram.
    test(`${largura} px — /precos: a última faixa da tabela é 16–19 a 6%, sem a faixa do Gestor a 4% (sem 31+)`, async ({ page }) => {
      test.skip(PRECOS_SUSPENSA, MOTIVO_PRECOS_SUSPENSA);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await textoDe(page, "/precos");
      const faixas = page.getByTestId(largura === 390 ? "faixas-taxa-cartoes" : "faixas-taxa");
      await expect(faixas).toBeVisible();
      // O rótulo da faixa sem teto, exato (o innerText junta "R$ 540" ao "16–19", então nada de \b antes do 16).
      const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
      await expect(faixas).toContainText(rotuloFaixaTaxa(ultima, largura === 390));
      // 078 (Daniel, 16/11/2026): antes `toContainText("4%")` (a faixa do Gestor); agora a última linha é "16–19" a 6%,
      // e a tabela não tem 4%, "20+" nem "Gestor".
      const ultimaLinha = faixas.locator(largura === 390 ? ":scope > li" : "tbody tr").last();
      await expect(ultimaLinha).toContainText(largura === 390 ? "16–19 imóveis" : "16–19");
      await expect(ultimaLinha).toContainText("6%");
      const texto = (await faixas.innerText()).replace(/\s+/g, " ");
      expect(texto).not.toMatch(/(?<![\d.,])4\s?%/);
      expect(texto).not.toMatch(/20\+|Gestor/i);
      expect(texto).not.toMatch(GESTOR_COM_31);
      expect(texto).not.toMatch(/31\+|Negociado|negociável/);
    });
  }
});
