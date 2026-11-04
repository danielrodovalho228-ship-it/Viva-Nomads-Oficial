import { test, expect, type Page } from "@playwright/test";
import {
  CUSTO_FIXO_FAIXA,
  CUSTO_FORNECEDORES,
  FORA_DO_FIXO,
  ROTULO_HIPOTESE_IDENTIDADE,
  VERIFICACAO,
} from "../../../src/config/premissas-financeiras";

/*
  T1106 — E559 (#2483, 04/11): premissas financeiras do modelo de custos v2 nas telas dos sócios /roi e /simulacao,
  a 390 e 1280 px, com o código dos sócios (como a t200). O merge entrou com testes de unidade que leem o código-fonte;
  aqui é a tela renderizada:
   1. o aviso do topo (aviso-premissas) diz "Identidade (Certta): R$ N por verificação é hipótese — preço a cotar" e o
      "pró-labore é referência" — não mais "Identidade e antifraude da CAF ainda precisam de orçamento formal";
   2. o quadro "Custos fixos (por mês)" traz as linhas novas "Só fornecedores" (o total sem o pró-labore) e
      "Fora do fixo" (WhatsApp a cotar), além da faixa "≈ R$ 7,3 mil/mês com pró-labore de referência";
   3. nenhum resto do custo antigo: sem "R$ 989", sem pró-labore de R$ 5.000 e sem chamar a hipótese de "preço da Certta";
   4. sem rolagem lateral.
  Os números (≈ R$ 1.303 de fornecedores, R$ 7,3 mil de fixo) ficam com o projecao.test.ts e o textos-socios.test.ts.
*/
const limpo = (t: string) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const brl = (n: number) => limpo(n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`), { timeout: 30_000 });
}

test.describe("T1106 — E559: premissas do modelo de custos v2 em /roi e /simulacao", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const rota of ["/simulacao", "/roi"] as const) {
    for (const largura of [390, 1280] as const) {
      test(`${rota} ${largura}px — aviso da Certta como hipótese, "Só fornecedores" e "Fora do fixo", sem o custo antigo`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: largura, height: 900 });
        await entrarComoSocio(page, rota);

        // 1. O aviso do topo.
        const aviso = page.getByTestId("aviso-premissas");
        await expect(aviso).toBeVisible({ timeout: 30_000 });
        const textoAviso = limpo(await aviso.innerText());
        expect(textoAviso).toContain(`Identidade (Certta): ${brl(VERIFICACAO.custoCaf)} por verificação é ${ROTULO_HIPOTESE_IDENTIDADE}`);
        expect(textoAviso).toContain("o pró-labore é referência para projeção, não decisão");
        expect(textoAviso).not.toContain("CAF ainda precisam de orçamento formal");

        // 2. O quadro de custos fixos com as linhas novas.
        const quadro = page.getByRole("heading", { name: "Custos fixos (por mês)", exact: true }).locator("xpath=..");
        await expect(quadro).toBeVisible();
        const textoQuadro = limpo(await quadro.innerText());
        expect(textoQuadro).toContain("Total usado na conta");
        expect(textoQuadro).toMatch(new RegExp(`Só fornecedores\\s*${brl(CUSTO_FORNECEDORES).replace(/[.$]/g, "\\$&")}`));
        expect(textoQuadro).toContain(CUSTO_FIXO_FAIXA.texto);
        expect(textoQuadro).toMatch(/Fora do fixo/);
        for (const item of FORA_DO_FIXO) expect(textoQuadro).toContain(item);

        // 3. Nada do custo antigo na tela.
        const corpo = limpo(await page.locator("body").innerText());
        expect(corpo).not.toMatch(/R\$ ?989\b/);
        expect(corpo).not.toMatch(/pró-labore[^.]{0,40}R\$ ?5\.000|R\$ ?5\.000[^.]{0,40}pró-labore/i);
        expect(corpo).not.toMatch(/preço (da|de) Certta/i);

        // 4. Sem rolagem lateral.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
});
