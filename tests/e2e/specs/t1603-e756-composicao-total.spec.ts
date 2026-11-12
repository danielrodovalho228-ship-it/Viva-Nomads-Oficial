import { test, expect } from "@playwright/test";

/*
  T1603 — E756 (reprovado ao vivo em 11/11): no ube-001 o total de 1 mês (R$ 3.960) excluía as limpezas que a conta da página somava
  (R$ 4.660), e o de 6 meses incluía. Regra única: N × total do mês + limpeza de preparação + limpeza de saída, para qualquer N,
  com a conta aberta. Visitante; 1280 (cartão lateral) e 390 (barra do celular).
*/
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const CASOS = [
  { meses: 1, total: "R$ 4.660 em 1 mês", conta: "1 × R$ 3.960 + limpeza de preparação R$ 450 + limpeza de saída R$ 250" },
  { meses: 6, total: "R$ 24.460 em 6 meses", conta: "6 × R$ 3.960 + limpeza de preparação R$ 450 + limpeza de saída R$ 250" },
];

for (const c of CASOS) {
  test(`ube-001, ${c.meses} mês(es): cartão lateral e barra do celular dão o mesmo total, com a conta`, async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    await page.evaluate((m) => localStorage.setItem("vn:ultima-busca", JSON.stringify({ inicio: "", meses: m, pessoas: 0 })), c.meses);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const lateral = page.locator("#cartao-preco");
    await expect(lateral.getByTestId("cartao-lateral-estadia")).toContainText(c.total.split(" em ")[1], { timeout: 20_000 });
    expect(sem(await lateral.getByTestId("cartao-lateral-estadia").innerText())).toContain(c.total);
    expect(sem(await lateral.getByTestId("cartao-lateral-estadia-conta").innerText())).toContain(c.conta);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    // A duração da última busca é lida do aparelho depois da hidratação (antes disso vale a estadia mínima): espera o texto, não só a barra.
    await expect(page.getByTestId("barra-total-estadia")).toContainText(c.total.split(" em ")[1], { timeout: 20_000 });
    expect(sem(await page.getByTestId("barra-total-estadia").innerText())).toContain(c.total);
  });
}
