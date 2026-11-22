import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { TEXTO_DOCUMENTO_NA_MENSAGEM, TEXTO_PRAZOS_DA_VIVA, TEXTO_PRE_ACEITE } from "../../../src/lib/ajuda/regras-publicas";

/*
  T1664 — Lote da Ajuda (Família 6) @E956 @E957 @E958: as três superfícies públicas declaram as regras.
    • Ajuda: Morador e Segurança trazem a recusa de CPF/RG no artigo do contato protegido (E957); Morador, Contratos e
      Segurança trazem os prazos da Viva (E958, metade E948).
    • /como-funciona e a home: o bloco "regras-publicas" com as mesmas frases.
    • E956: o pré-aceite aparece só com NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA=on no build (o caso desligado: não aparece).
  Público (visitante), 390 e 1280 px.
*/
const SAIDA = "tests/e2e/.artifacts/t1664";
const PRE_ACEITE_LIGADO = process.env.NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA === "on";

test.describe("T1664 — Ajuda, /como-funciona e home declaram pré-aceite, CPF/RG recusado e prazos @E956 @E957 @E958", () => {
  test.beforeAll(() => mkdirSync(SAIDA, { recursive: true }));

  for (const largura of [390, 1280]) {
    test(`${largura}px — temas da Ajuda`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const tema of ["morador", "contratos", "seguranca"]) {
        await page.goto(`/ajuda/${tema}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("ajuda-perguntas")).toBeVisible();
        const abrir = async (id: string, texto: string) => {
          const item = page.locator(`#pergunta-${id}`);
          await item.getByRole("button").click();
          await expect(item).toContainText(texto);
        };
        await abrir("prazos-da-viva", TEXTO_PRAZOS_DA_VIVA);
        if (tema !== "contratos") await abrir("contato", TEXTO_DOCUMENTO_NA_MENSAGEM);
        if (PRE_ACEITE_LIGADO && tema !== "seguranca") await abrir("pre-aceite", TEXTO_PRE_ACEITE);
        else await expect(page.locator("#pergunta-pre-aceite")).toHaveCount(0);
        await page.screenshot({ path: `${SAIDA}/preview-ajuda-${tema}-${largura}.png`, fullPage: true });
      }
    });

    test(`${largura}px — /como-funciona e a home`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const rota of ["/como-funciona", "/"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const bloco = page.getByTestId("regras-publicas");
        await bloco.scrollIntoViewIfNeeded();
        await expect(bloco.getByTestId("regra-documento-na-mensagem")).toContainText(TEXTO_DOCUMENTO_NA_MENSAGEM);
        await expect(bloco.getByTestId("regra-prazos-da-viva")).toContainText(TEXTO_PRAZOS_DA_VIVA);
        await expect(bloco.getByTestId("regra-pre-aceite")).toHaveCount(PRE_ACEITE_LIGADO ? 1 : 0);
        if (PRE_ACEITE_LIGADO) await expect(bloco.getByTestId("regra-pre-aceite")).toContainText(TEXTO_PRE_ACEITE);
        await bloco.screenshot({ path: `${SAIDA}/preview-regras-${rota === "/" ? "home" : "como-funciona"}-${largura}.png` });
      }
    });
  }
});
