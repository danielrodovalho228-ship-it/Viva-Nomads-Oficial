import { test, expect } from "@playwright/test";
import { SAMPLE_PROPERTIES } from "../../../src/lib/properties";
import { composicaoDoMes } from "../../../src/lib/cartao-estadia";
import { estadiaDoImovel } from "../../../src/lib/precos";

/*
  T1625 — E899 (Daniel, 13/11), T5: cartão = página. O cartão enxuto mostra só "R$ X/mês" e "R$ Y em N meses · aviso"; a composição
  saiu dele e fica na página do imóvel. Lei do E777: os dois números do cartão são os MESMOS da página, e a página mostra, perto
  do preço, as duas composições pelas funções que o cartão usava: composicaoDoMes(p) e a conta de estadiaDoImovel(p, N).
  Na busca, para o ube-001 (contas fixas) e para o ube-003 (contas medidas). Visitante; 390 e 1280 px.
*/
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const CASOS = [
  { id: "ube-001", aviso: "tudo incluído", proibido: "água, luz e gás à parte" },
  { id: "ube-003", aviso: "água, luz e gás à parte", proibido: "tudo incluído" },
];

test.describe("T1625 — E899: cartão = página", { tag: ["@E899", "@ao-vivo-seguro"] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of [390, 1280] as const) {
    for (const caso of CASOS) {
      test(`${caso.id} a ${largura} px: os dois números do cartão são os da página, que mostra as duas composições`, async ({ page }) => {
        test.setTimeout(120_000);
        const p = SAMPLE_PROPERTIES.find((i) => i.id === caso.id)!;
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
        const cartao = page.getByTestId("cartao-imovel").filter({ has: page.locator(`a[href="/imoveis/${caso.id}"]`) }).first();
        await expect(cartao.getByTestId("cartao-preco-mes")).toBeVisible({ timeout: 40_000 });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

        // O cartão: preço do mês, total da estadia e o aviso curto (nunca o do outro regime).
        const precoMes = sem(await cartao.getByTestId("cartao-preco-mes").innerText());
        const total = sem(await cartao.getByTestId("cartao-total-estadia").innerText());
        const aviso = sem(await cartao.getByTestId("cartao-aviso").innerText());
        expect(precoMes).toMatch(/^R\$ [\d.]+$/);
        expect(total).toMatch(/^R\$ [\d.]+ em \d+ (mês|meses)$/);
        expect(aviso).toBe(caso.aviso);
        expect(sem(await cartao.innerText())).not.toContain(caso.proibido);
        const meses = Number(/ em (\d+) /.exec(total)![1]);

        // Abre o anúncio pelo próprio cartão (ele inteiro é um link).
        await cartao.getByTestId("cartao-titulo").click();
        await page.waitForURL(new RegExp(`/imoveis/${caso.id}(\\?|$)`), { timeout: 30_000 });
        const lateral = page.locator("#cartao-preco");
        await expect(lateral.getByTestId("cartao-lateral-mes")).toBeVisible({ timeout: 40_000 });

        // Os MESMOS números.
        expect(sem(await lateral.getByTestId("cartao-lateral-mes").innerText()), "preço do mês: cartão = página").toBe(precoMes);
        await expect(lateral.getByTestId("cartao-lateral-estadia")).toContainText(total.split(" em ")[1], { timeout: 20_000 });
        expect(sem(await lateral.getByTestId("cartao-lateral-estadia").innerText()), "total da estadia: cartão = página").toContain(total);

        // As duas composições, com os textos das funções que o cartão usava.
        expect(sem(await lateral.getByTestId("cartao-lateral-mes-composicao").innerText()), "composição do mês").toBe(sem(composicaoDoMes(p)));
        expect(sem(await lateral.getByTestId("cartao-lateral-estadia-conta").innerText()), "conta da estadia").toContain(sem(estadiaDoImovel(p, meses)!.conta));
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
});
