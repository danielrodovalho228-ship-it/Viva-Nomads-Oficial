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

// Escopo ampliado (12/11): a diferença entre anúncios é de dado (condomínio, contas fixas, pacote de limpeza, contas medidas).
// E899 (Daniel, 13/11): o cartão da busca ficou enxuto e NÃO abre mais as composições (antes: cartao-mes-composicao e
// cartao-total-composicao no cartão). Elas são conferidas na PÁGINA do imóvel, pelas mesmas funções; a igualdade de números
// cartão = página continua (aqui e no t1625).
const MES = [
  { id: "ube-001", mes: "Por mês: valor mensal R$ 3.200 + condomínio R$ 480 + contas R$ 280 = R$ 3.960" },
  { id: "ube-002", mes: "Por mês: valor mensal R$ 2.400 + condomínio R$ 350 + contas R$ 200 + limpeza R$ 180 (2 por mês) = R$ 3.130" },
  { id: "ube-003", mes: "Por mês: valor mensal R$ 4.100 · água, luz e gás medidos à parte, fora do total" },
];
for (const m of MES) {
  test(`${m.id}: o cartão da busca não abre a composição; a página mostra a do /mês e a conta da estadia, com os números do cartão`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
    const cartao = page.getByTestId("cartao-imovel").filter({ has: page.locator(`a[href="/imoveis/${m.id}"]`) }).first();
    await expect(cartao.getByTestId("cartao-preco-mes")).toBeVisible({ timeout: 20_000 });
    await expect(cartao.getByTestId("cartao-mes-composicao")).toHaveCount(0);
    await expect(cartao.getByTestId("cartao-total-composicao")).toHaveCount(0);
    const precoMes = sem(await cartao.getByTestId("cartao-preco-mes").innerText());
    const total = sem(await cartao.getByTestId("cartao-total-estadia").innerText());
    expect(total).toMatch(/^R\$ [\d.]+ em \d+ (mês|meses)$/);

    await page.goto(`/imoveis/${m.id}`, { waitUntil: "domcontentloaded" });
    const lateral = page.locator("#cartao-preco");
    await expect(lateral.getByTestId("cartao-lateral-mes-composicao")).toBeVisible({ timeout: 20_000 });
    expect(sem(await lateral.getByTestId("cartao-lateral-mes-composicao").innerText())).toBe(m.mes);
    await expect(lateral.getByTestId("cartao-lateral-estadia")).toContainText(total.split(" em ")[1], { timeout: 20_000 });
    expect(sem(await lateral.getByTestId("cartao-lateral-estadia-conta").innerText())).toMatch(/^\d+ × R\$ [\d.]+ \+ limpeza de preparação R\$ 450 \+ limpeza de saída R\$ 250$/);
    // A igualdade de números cartão = página continua.
    expect(sem(await lateral.getByTestId("cartao-lateral-mes").innerText())).toBe(precoMes);
    expect(sem(await lateral.getByTestId("cartao-lateral-estadia").innerText())).toContain(total);
  });
}
