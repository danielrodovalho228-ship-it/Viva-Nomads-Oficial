// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
import { test, expect, type Page } from "@playwright/test";
import { TEXTO_CARTEIRAS } from "../../../src/config/planos";
import { FAIXAS_COMISSAO_PADRAO, escadaTaxasTexto, rotuloFaixaTaxa } from "../../../src/lib/cobranca/regra";
import { achadosProibidos } from "../../../src/lib/frases-proibidas";
import { MOTIVO_PRECOS_SUSPENSA, PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T861 — E564 (parte A, decisão do Daniel, 04/11/2026): o Plano Gestor nas telas era um texto só, "4% para carteiras de
  20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva" (GESTOR_TEXTO).
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública. O roteiro
  cobra o contrário do que cobrava, com a mesma força:
    1. /para-proprietarios mostra a escada inteira até "16–19 imóveis: 6%" e a linha de carteiras (TEXTO_CARTEIRAS);
       /parceiros mostra "Taxa menor por volume." + a linha de carteiras — e nenhuma das duas cita "Plano Gestor" nem 4%;
    2. nenhuma tela mostra o texto antigo (mensalidade, imóveis incluídos, "R$ 25 por imóvel", "taxa zero",
       "31+ · taxa negociável", "condições negociadas", "cadastro assistido da carteira") nem recurso da fase 2;
    3. /precos (suspensa pelo E563 — o bloco pula com a chave desligada): a seção das carteiras com a linha única, sem o
       texto nem os diferenciais do Gestor; a tabela termina em 16–19 = 6%.
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
  // 078 (Daniel, 16/11/2026): o texto único do Gestor (GESTOR_TEXTO) entrou na lista do que não pode mais aparecer.
  /Plano Gestor/i,
  /cadastro assistido da carteira/i,
  /contato direto na Viva/i,
];
const FASE_2 = [/vários proprietários/i, /permissões/i, /importação em massa/i, /sincroniza/i];
/** As duas regras do prompt 078 em src/lib/frases-proibidas.ts: "Plano Gestor" e 4% em contexto de taxa. */
const REGRAS_078 = ["plano-gestor-publico", "taxa-de-4-publica"];

async function texto(page: Page, rota: string): Promise<string> {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota}: HTTP`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
}

/** "Plano Gestor" ou 4% em contexto de taxa no <main>, pelas regras do produto (linha a linha, como a varredura de src/). */
async function gestorOuQuatroPorCento(page: Page): Promise<{ id: string; trecho: string }[]> {
  return achadosProibidos(await page.locator("main").first().innerText()).filter((a) => REGRAS_078.includes(a.id));
}

/** O que cada página mostra no lugar do "Plano Gestor: {GESTOR_TEXTO}". */
const NO_LUGAR_DO_GESTOR: Record<string, string> = {
  "/para-proprietarios": `Quanto mais imóveis ativos, menor a taxa: ${escadaTaxasTexto()}. ${TEXTO_CARTEIRAS}`,
  "/parceiros": `Taxa menor por volume. ${TEXTO_CARTEIRAS}`,
};

for (const largura of [1280, 390] as const) {
  // 078 (Daniel, 16/11/2026): o título era "T861 — E564 Gestor 4%"; a etiqueta @078 entrou ao lado da @E564.
  test.describe(`T861 — E564 revisto pelo 078: sem Gestor 4% (${largura}px)`, { tag: ["@E564", "@078", "@ao-vivo-seguro"] }, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const rota of ["/para-proprietarios", "/parceiros"]) {
      // 078 (Daniel, 16/11/2026): o título era `${rota}: "Plano Gestor: ${GESTOR_TEXTO}", sem texto antigo nem fase 2`.
      test(`${rota}: a linha de carteiras no lugar do Plano Gestor, sem 4%, sem texto antigo nem fase 2`, async ({ page }) => {
        const t = await texto(page, rota);
        // 078 (Daniel, 16/11/2026): antes `toContain("Plano Gestor: " + GESTOR_TEXTO)`; agora a escada nova e a linha de
        // carteiras são cobradas como presentes, e o Gestor e os 4% como ausentes.
        expect(t).toContain(NO_LUGAR_DO_GESTOR[rota]);
        expect(await gestorOuQuatroPorCento(page), `${rota}: Plano Gestor ou 4% na tela`).toEqual([]);
        for (const r of [...ANTIGOS, ...FASE_2]) expect(t, String(r)).not.toMatch(r);
      });
    }

    // 078 (Daniel, 16/11/2026): o título era "/precos: a seção do Gestor tem o texto e os 4 diferenciais".
    test("/precos: a seção das carteiras tem a linha única, sem o texto nem os diferenciais do Gestor", async ({ page }) => {
      test.skip(PRECOS_SUSPENSA, MOTIVO_PRECOS_SUSPENSA);
      await page.goto("/precos", { waitUntil: "domcontentloaded" });
      // 078 (Daniel, 16/11/2026): antes `plano-gestor-texto` = "{GESTOR_TEXTO}." e `plano-gestor-diferenciais` com os 4
      // itens de GESTOR_DIFERENCIAIS; agora a linha das carteiras está presente e os dois blocos do Gestor, ausentes.
      await expect(page.getByTestId("carteiras-secao").getByRole("heading", { level: 3 })).toHaveText("Carteiras e administradoras");
      await expect(page.getByTestId("carteiras-texto")).toHaveText(TEXTO_CARTEIRAS);
      await expect(page.getByTestId("carteiras-secao").locator("li")).toHaveCount(0);
      for (const saiu of ["plano-gestor-secao", "plano-gestor-texto", "plano-gestor-diferenciais", "precos-ver-plano-gestor"]) {
        await expect(page.getByTestId(saiu), saiu).toHaveCount(0);
      }
      // 078 (Daniel, 16/11/2026): a tabela de faixas termina em "16–19" a 6% (antes a última linha era a do Gestor, 4%).
      const faixas = page.getByTestId(largura === 390 ? "faixas-taxa-cartoes" : "faixas-taxa");
      const linhas = faixas.locator(largura === 390 ? ":scope > li" : "tbody tr");
      expect(FAIXAS_COMISSAO_PADRAO).toHaveLength(4);
      await expect(linhas).toHaveCount(FAIXAS_COMISSAO_PADRAO.length);
      const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
      await expect(linhas.last()).toContainText(rotuloFaixaTaxa(ultima, largura === 390));
      await expect(linhas.last()).toContainText("6%");
      const t = (await page.locator("main").first().innerText()).replace(/\s+/g, " ");
      expect(await gestorOuQuatroPorCento(page), "/precos: Plano Gestor ou 4% na tela").toEqual([]);
      for (const r of [...ANTIGOS, ...FASE_2]) expect(t, String(r)).not.toMatch(r);
    });
  });
}
