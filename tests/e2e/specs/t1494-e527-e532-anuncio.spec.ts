import { test, expect, type Page } from "@playwright/test";

/*
  T1494 — dois resíduos que a QA manteve abertos na rodada 10:00 (08/11) e propôs como teste determinístico; os dois ficam como test.fail
  ligados aos itens da lista-master (E527 e E532 (i)), porque o produto ainda não os corrigiu. Quem corrigir remove o test.fail no mesmo PR.
    T-E527: na legenda do calendário do anúncio ([data-testid=calendario-legenda]), o contraste entre a amostra "Disponível" e o fundo branco
            é ≥ 3:1 e entre "Disponível" e "Ocupado" também (WCAG 1.4.11). A QA mediu em produção 1,10:1 (e 1,23:1 entre as duas).
    T-E532: em /imoveis/ube-001, o resumo do cartão "Segurança" (Bom saber) não repete "Câmeras externas" quando o bloco "Privacidade" já traz.
  Visitante, 390 e 1280 px (o contraste é o mesmo nas duas larguras; o E532 é conferido a 390).
*/
test.use({ storageState: { cookies: [], origins: [] } });

const lum = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

async function corDaAmostra(page: Page, rotulo: RegExp): Promise<[number, number, number]> {
  const rgb = await page
    .getByTestId("calendario-legenda")
    .locator("span", { hasText: rotulo })
    .first()
    .locator("span")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const m = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!m || m.length < 3) throw new Error(`cor ilegível: ${rgb}`);
  return m as [number, number, number];
}

test.describe("T1494 — E527 (legenda do calendário) e E532 (i) (prévia do cartão Segurança)", () => {
  for (const w of [1280, 390] as const) {
    test(`E527 a ${w} px: amostras Disponível e Ocupado com contraste ≥ 3:1`, async ({ page }) => {
      test.fail(true, "E527: a amostra 'Disponível' (1,10:1 contra o branco) e 'Ocupado' (1,23:1 entre si) ficam abaixo de 3:1");
      await page.setViewportSize({ width: w, height: 844 });
      const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await page.getByTestId("calendario-legenda").first().scrollIntoViewIfNeeded();
      const branco: [number, number, number] = [255, 255, 255];
      const disponivel = await corDaAmostra(page, /Disponível/);
      const ocupado = await corDaAmostra(page, /Ocupado|já reservado/);
      expect(contraste(disponivel, branco), "Disponível × fundo").toBeGreaterThanOrEqual(3);
      expect(contraste(disponivel, ocupado), "Disponível × Ocupado").toBeGreaterThanOrEqual(3);
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
