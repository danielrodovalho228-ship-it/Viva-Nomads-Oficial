import { test, expect } from "@playwright/test";
import { escadaTaxasTexto } from "../../../src/lib/cobranca/regra";
import { DOSSIE_EM_PDF } from "../../../src/lib/caucao/prazos";
import { TEXTO_VALIDADE_CODIGO } from "../../../src/lib/seguranca/codigo-acesso";

/*
  T1668 — Lote 2 da Ajuda (Família 6) @E939 @E940 @E942: os três artigos na página do tema, como o visitante lê.
  E939 a escada da taxa (Morador); E940 o destino do dano (Contratos); E942 a validade do código (Segurança). 390 e 1280.
*/
const SAIDA = "tests/e2e/.artifacts/t1668";
const CASOS = [
  { tema: "morador", id: "inquilino-paga", texto: escadaTaxasTexto() },
  { tema: "contratos", id: "manutencao", texto: `a Viva não decide: entrega ${DOSSIE_EM_PDF}` },
  { tema: "seguranca", id: "email-confirmacao", texto: `O código vale ${TEXTO_VALIDADE_CODIGO} e só funciona uma vez.` },
];

test.describe("T1668 — Ajuda lote 2: escada da taxa, destino do dano e validade do código @E939 @E940 @E942", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of [390, 1280]) {
    test(`${largura}px — os três artigos dizem a regra`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const c of CASOS) {
        await page.goto(`/ajuda/${c.tema}`, { waitUntil: "domcontentloaded" });
        const item = page.locator(`#pergunta-${c.id}`);
        await item.getByRole("button").click();
        await expect(item).toContainText(c.texto);
        await item.screenshot({ path: `${SAIDA}/preview-${c.id}-${largura}.png` });
      }
    });
  }
});
