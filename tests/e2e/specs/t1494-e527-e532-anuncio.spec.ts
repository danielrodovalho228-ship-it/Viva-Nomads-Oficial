import { test, expect, type Page } from "@playwright/test";

/*
  T1494 — dois resíduos que a QA manteve abertos na rodada 10:00 (08/11) e propôs como teste determinístico; os dois ficam como test.fail
  ligados aos itens da lista-master (E527 e E532 (i)), porque o produto ainda não os corrigiu. Quem corrigir remove o test.fail no mesmo PR.
    T-E527: na legenda do calendário do anúncio ([data-testid=calendario-legenda]), o pixel mais escuro de cada amostra (Disponível, Ocupado,
            Bloqueado, Hoje; captura com folga de 3 px, preenchimento OU contorno) tem contraste ≥ 3:1 contra o branco (WCAG 1.4.11). Medida
            ajustada a pedido da QA (rodada 10:45): a cor de preenchimento não enxergava o anel do #3432.
    T-E532: em /imoveis/ube-001, o resumo do cartão "Segurança" (Bom saber) não repete "Câmeras externas" quando o bloco "Privacidade" já traz.
  Visitante, 390 e 1280 px (o contraste é o mesmo nas duas larguras; o E532 é conferido a 390).
*/
test.use({ storageState: { cookies: [], origins: [] } });

const AMOSTRAS: [string, RegExp][] = [
  ["Disponível", /Disponível/],
  ["Ocupado", /Ocupado|já reservado/],
  ["Bloqueado", /Bloqueado/],
  ["Hoje", /Hoje/],
];

/** Pixel mais escuro da amostra (preenchimento OU contorno), em captura com folga de 3 px: é o que o olho enxerga (QA, rodada 10:45). */
async function contrasteDoPixel(page: Page, rotulo: RegExp): Promise<number> {
  const amostra = page.getByTestId("calendario-legenda").locator("span", { hasText: rotulo }).first().locator("span").first();
  const caixa = await amostra.boundingBox();
  if (!caixa) throw new Error("amostra sem caixa");
  const png = await page.screenshot({ clip: { x: Math.max(0, caixa.x - 3), y: Math.max(0, caixa.y - 3), width: caixa.width + 6, height: caixa.height + 6 } });
  const lido = await page.context().newPage();
  try {
    await lido.goto("about:blank");
    return await lido.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const lumi = (r: number, gg: number, b: number) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
      };
      let menor = 1;
      for (let k = 0; k < d.length; k += 4) menor = Math.min(menor, lumi(d[k], d[k + 1], d[k + 2]));
      return 1.05 / (menor + 0.05);
    }, png.toString("base64"));
  } finally {
    await lido.close();
  }
}

test.describe("T1494 — E527 (legenda do calendário) e E532 (i) (prévia do cartão Segurança)", () => {
  for (const w of [1280, 390] as const) {
    test(`E527 a ${w} px: cada amostra da legenda tem o pixel mais escuro com contraste ≥ 3:1 contra o branco`, async ({ page }) => {
      test.fail(true, "E527: 'Ocupado', 'Bloqueado' e 'Hoje' (e o 'Disponível', até o #3432) ficam abaixo de 3:1");
      await page.setViewportSize({ width: w, height: 844 });
      const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await page.getByTestId("calendario-legenda").first().scrollIntoViewIfNeeded();
      const baixas: string[] = [];
      for (const [nome, rotulo] of AMOSTRAS) {
        const c = await contrasteDoPixel(page, rotulo);
        if (c < 3) baixas.push(`${nome} ${c.toFixed(2)}:1`);
      }
      expect(baixas, `amostras abaixo de 3:1: ${baixas.join("; ")}`).toEqual([]);
    });
  }

  test("E532 (i) a 390 px: a prévia do cartão Segurança não repete as câmeras do bloco Privacidade", async ({ page }) => {
    test.fail(true, "E532 (i): a linha-resumo do cartão Segurança é montada com os fatos de câmeras e acesso e repete o bloco Privacidade");
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    const privacidade = ((await page.getByTestId("bloco-privacidade").innerText()) ?? "").replace(/\s+/g, " ");
    expect(privacidade, "o bloco Privacidade traz as câmeras externas").toContain("Câmeras externas");
    const previa = ((await page.getByTestId("bom-saber-seguranca").innerText()) ?? "").replace(/\s+/g, " ");
    expect(previa, "a prévia do cartão Segurança").not.toContain("Câmeras externas");
  });
});
