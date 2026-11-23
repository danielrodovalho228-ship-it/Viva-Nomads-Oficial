// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
import { test, expect, type Locator, type Page } from "@playwright/test";
import { CARTEIRAS_MINIMO_IMOVEIS, TEXTO_CARTEIRAS } from "../../../src/config/planos";
import { FAIXAS_COMISSAO_PADRAO, TAXA_MENOR_TEXTO, escadaTaxasCurta, escadaTaxasTexto, rotuloFaixaTaxa } from "../../../src/lib/cobranca/regra";
import { achadosProibidos } from "../../../src/lib/frases-proibidas";
import { MOTIVO_PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T1677 — prompt 078 (decisão do Daniel, 16/11/2026): lançar SEM o Plano Gestor público de 4%.
  A escada pública da taxa de serviço é 1–2 = 12% · 3–5 = 10% · 6–15 = 8% · 16–19 = 6%. No lugar do Gestor há uma
  linha só, sem taxa: "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva." (TEXTO_CARTEIRAS).

  Em cada página pública que fala da taxa — /, /como-funciona, /para-proprietarios, /parceiros e a Central de Ajuda
  (o hub /ajuda não lista perguntas: a "Quanto custa anunciar?" mora em /ajuda/proprietarios e abre no toque) —, a 390 e
  a 1280 px:
    • a escada nova aparece onde a página a mostra (a frase inteira em /como-funciona e /para-proprietarios; "até 6%" na
      home; a escada curta na resposta da Ajuda);
    • a linha de carteiras aparece e está visível, sem sair da tela;
    • o texto da página inteira não tem "Plano Gestor" nem "4%" em contexto de taxa — as MESMAS duas regras que varrem o
      código (plano-gestor-publico e taxa-de-4-publica, src/lib/frases-proibidas.ts);
    • a 390 px, sem rolagem horizontal.
  /precos está suspensa por chave (E563): o caso dela olha o que a página responde na hora — aberta, mostra a seção das
  carteiras e não o Gestor; suspensa (vai para a home), o caso se declara pulado com o motivo.

  Só leitura de páginas públicas: sem conta, sem formulário enviado, nada gravado (@ao-vivo-seguro, trava do E951).
  As etiquetas @E564 (a decisão do Gestor a 4%, que o 078 revê) e @E805 (a escada inteira nas páginas públicas) são as
  dos itens que este spec prova ao vivo; ficam escritas por extenso em cada `tag: [...]` porque a trava lê o código.
*/
const REGRAS_078 = ["plano-gestor-publico", "taxa-de-4-publica"];
/** A frase da escada de /como-funciona e /para-proprietarios (FRASE_ESCADA_TAXAS), montada da regra. */
const FRASE_ESCADA = `Quanto mais imóveis ativos, menor a taxa: ${escadaTaxasTexto()}. ${TEXTO_CARTEIRAS}`;

/** "Plano Gestor" ou 4% em contexto de taxa no texto da página inteira (linha a linha, como a varredura de src/). */
async function gestorOuQuatroPorCento(page: Page): Promise<{ id: string; trecho: string }[]> {
  return achadosProibidos(await page.locator("body").innerText()).filter((a) => REGRAS_078.includes(a.id));
}

async function abrir(page: Page, rota: string): Promise<void> {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota}: HTTP`).toBe(200);
  expect(new URL(page.url()).pathname, `${rota}: a página abriu no próprio endereço`).toBe(rota);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** A linha de carteiras está no bloco, o bloco está visível e cabe na largura da tela (nada cortado para o lado). */
async function linhaDeCarteirasVisivel(page: Page, bloco: Locator, largura: number): Promise<void> {
  await bloco.scrollIntoViewIfNeeded();
  await expect(bloco).toContainText(TEXTO_CARTEIRAS, { timeout: 30_000 });
  await expect(bloco).toBeVisible();
  await expect(bloco).toBeInViewport();
  const caixa = await bloco.boundingBox();
  expect(caixa, "o bloco da linha de carteiras tem caixa na tela").not.toBeNull();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(largura + 1);
  expect(caixa!.height).toBeGreaterThan(0);
}

async function semGestorNemQuatroPorCento(page: Page, rota: string): Promise<void> {
  expect(await gestorOuQuatroPorCento(page), `${rota}: "Plano Gestor" ou 4% de taxa no texto da página`).toEqual([]);
}

async function semRolagemHorizontalNoCelular(page: Page, largura: number): Promise<void> {
  if (largura !== 390) return;
  const { rolagem, cliente } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, cliente: document.documentElement.clientWidth }));
  expect(rolagem, "rolagem horizontal a 390 px").toBeLessThanOrEqual(cliente);
}

test.describe("T1677 — P078: os números da decisão", { tag: ["@078", "@E564", "@E805", "@ao-vivo-seguro"] }, () => {
  test("a escada, a linha de carteiras e as duas regras de texto são as da decisão (literal)", () => {
    expect(escadaTaxasTexto()).toBe("1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%");
    expect(escadaTaxasCurta()).toBe("1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16–19 = 6%");
    expect(TAXA_MENOR_TEXTO).toBe("6%");
    expect(CARTEIRAS_MINIMO_IMOVEIS).toBe(20);
    expect(TEXTO_CARTEIRAS).toBe("Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
    // As duas regras pegam o que saiu e deixam passar o que ficou (senão os casos de página não provariam nada).
    const antigos = [
      "Quanto mais imóveis, menor a taxa (até 6%; Plano Gestor: 4% a partir de 20 imóveis ou para administradoras).",
      "O Plano Gestor tem taxa de 4%, sem mensalidade.",
      "Carteira de 20 ou mais imóveis: taxa de 4% por contrato.",
    ];
    for (const frase of antigos) expect(achadosProibidos(frase).filter((a) => REGRAS_078.includes(a.id)), frase).not.toEqual([]);
    for (const frase of [FRASE_ESCADA, `${escadaTaxasCurta()}. ${TEXTO_CARTEIRAS}`, "A Viva cobra 12% sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (até 6%)."]) {
      expect(achadosProibidos(frase).filter((a) => REGRAS_078.includes(a.id)), frase).toEqual([]);
    }
  });
});

for (const largura of [390, 1280] as const) {
  test.describe(`T1677 — P078: escada sem o Plano Gestor (${largura}px)`, { tag: ["@078", "@E564", "@E805", "@ao-vivo-seguro"] }, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test('/: "até 6%" e a linha de carteiras no bloco dos proprietários; sem Plano Gestor nem 4%', async ({ page }) => {
      await abrir(page, "/");
      const bloco = page.getByTestId("bloco-proprietarios");
      await linhaDeCarteirasVisivel(page, bloco, largura);
      await expect(bloco).toContainText("A Viva cobra 12% sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade.");
      await expect(bloco).toContainText(`Quanto mais imóveis, menor a taxa (até ${TAXA_MENOR_TEXTO}). Sem mensalidade. ${TEXTO_CARTEIRAS}`);
      await semGestorNemQuatroPorCento(page, "/");
      await semRolagemHorizontalNoCelular(page, largura);
    });

    for (const [rota, marca] of [["/como-funciona", "cf-taxa-proprietario"], ["/para-proprietarios", "anunciar-taxa"]] as const) {
      test(`${rota}: a escada inteira até "16–19 imóveis: 6%" e a linha de carteiras; sem Plano Gestor nem 4%`, async ({ page }) => {
        await abrir(page, rota);
        const bloco = page.getByTestId(marca);
        await linhaDeCarteirasVisivel(page, bloco, largura);
        await expect(bloco).toContainText(escadaTaxasTexto());
        await expect(bloco).toContainText(FRASE_ESCADA);
        await expect(bloco).not.toContainText("16 ou mais"); // ORDEM-DUET-534: antes a negação era de "16–19"
        await semGestorNemQuatroPorCento(page, rota);
        await semRolagemHorizontalNoCelular(page, largura);
      });
    }

    test('/parceiros: o cartão "Gestores e administradoras" traz a linha de carteiras e "Ver as taxas"; sem Plano Gestor nem 4%', async ({ page }) => {
      await abrir(page, "/parceiros");
      const cartao = page.getByTestId("parceiros-tipos").locator(":scope > li").filter({ hasText: "Gestores e administradoras" });
      await expect(cartao).toHaveCount(1);
      await linhaDeCarteirasVisivel(page, cartao, largura);
      await expect(cartao).toContainText(`Taxa menor por volume. ${TEXTO_CARTEIRAS}`);
      // O cartão nunca fica sem saída (E896): leva às taxas — a seção das carteiras em Preços ou, com os preços
      // suspensos (E563), a escada em /para-proprietarios#taxa. Os dois destinos valem; "Ver o Plano Gestor" não existe.
      const links = cartao.getByRole("link");
      await expect(links).toHaveText(["Ver as taxas"]);
      await expect(links.first()).toHaveAttribute("href", /^\/(?:precos#carteiras|para-proprietarios#taxa)$/);
      await expect(page.locator('a[href*="#plano-gestor"]')).toHaveCount(0);
      await semGestorNemQuatroPorCento(page, "/parceiros");
      await semRolagemHorizontalNoCelular(page, largura);
    });

    test('Central de Ajuda: "Quanto custa anunciar?" responde com a escada curta e a linha de carteiras; sem Plano Gestor nem 4%', async ({ page }) => {
      // O hub /ajuda só tem os cartões de tema (E84): nada de taxa, e nada do Gestor.
      await abrir(page, "/ajuda");
      await expect(page.getByTestId("ajuda-tema-proprietarios")).toHaveAttribute("href", "/ajuda/proprietarios");
      await semGestorNemQuatroPorCento(page, "/ajuda");
      await semRolagemHorizontalNoCelular(page, largura);

      // A pergunta mora na página do tema "Para proprietários"; a resposta só aparece depois do toque.
      await abrir(page, "/ajuda/proprietarios");
      const perguntas = page.getByTestId("ajuda-perguntas");
      const pergunta = perguntas.getByRole("button", { name: "Quanto custa anunciar?", exact: true });
      await expect(pergunta).toBeVisible({ timeout: 30_000 });
      // O toque antes da hidratação não abre a resposta: repete até abrir (sem fechar o que já abriu).
      await expect(async () => {
        if ((await pergunta.getAttribute("aria-expanded")) !== "true") await pergunta.click();
        await expect(pergunta).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      // O filtro `has` é relativo ao item da lista: o botão da pergunta dentro do próprio <li>.
      const resposta = perguntas.locator("li").filter({ has: page.getByRole("button", { name: "Quanto custa anunciar?", exact: true }) }).locator("p");
      await expect(resposta).toHaveCount(1);
      await linhaDeCarteirasVisivel(page, resposta, largura);
      await expect(resposta).toContainText(`Faixas por imóveis ativos (publicados, com documento aprovado e calendário em dia): ${escadaTaxasCurta()}. ${TEXTO_CARTEIRAS}`);
      await expect(resposta).toContainText("Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade.");
      await expect(resposta).not.toContainText("16 ou mais"); // ORDEM-DUET-534: antes a negação era de "16–19"
      // Com a resposta aberta, o texto da página inteira continua sem o Gestor e sem 4%.
      await semGestorNemQuatroPorCento(page, "/ajuda/proprietarios");
      await semRolagemHorizontalNoCelular(page, largura);
    });

    test("/precos: aberta, mostra a seção das carteiras e não o Gestor; suspensa (E563), o caso se declara pulado", async ({ page }) => {
      const r = await page.goto("/precos", { waitUntil: "domcontentloaded" });
      const chegou = new URL(page.url()).pathname;
      // Em tempo de execução: com a chave desligada, /precos vai para a home (src/app/(public)/precos/page.tsx).
      test.skip(chegou !== "/precos", `${MOTIVO_PRECOS_SUSPENSA} — /precos levou a ${chegou}`);
      expect(r?.status() ?? 0, "/precos: HTTP").toBe(200);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      const secao = page.getByTestId("carteiras-secao");
      await linhaDeCarteirasVisivel(page, secao, largura);
      await expect(secao).toHaveAttribute("id", "carteiras");
      await expect(secao.getByRole("heading", { level: 3 })).toHaveText("Carteiras e administradoras");
      await expect(page.getByTestId("carteiras-texto")).toHaveText(TEXTO_CARTEIRAS);
      for (const saiu of ["plano-gestor-secao", "plano-gestor-texto", "plano-gestor-diferenciais", "precos-ver-plano-gestor"]) {
        await expect(page.getByTestId(saiu), saiu).toHaveCount(0);
      }
      await expect(page.locator("#plano-gestor")).toHaveCount(0);
      // A tabela de faixas (cartões no celular) termina em "16–19" a 6%.
      const linhas = page.getByTestId(largura === 390 ? "faixas-taxa-cartoes" : "faixas-taxa").locator(largura === 390 ? ":scope > li" : "tbody tr");
      await expect(linhas).toHaveCount(4);
      const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
      await expect(linhas.last()).toContainText(rotuloFaixaTaxa(ultima, largura === 390));
      await expect(linhas.last()).toContainText("6%");
      await expect(page.getByTestId("regra-unica")).toContainText("Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade.");
      await semGestorNemQuatroPorCento(page, "/precos");
      await semRolagemHorizontalNoCelular(page, largura);
    });
  });
}
