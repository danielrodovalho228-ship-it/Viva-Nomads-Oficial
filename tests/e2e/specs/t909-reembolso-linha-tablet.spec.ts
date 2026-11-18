import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T909 — Varredura (passada 15, 768 px): no Reembolso da caução, a linha "Motivo · Valor · Evidência · Adicionar" tinha 4
  colunas já a 640 px — no tablet os campos se sobrepunham e o "Adicionar" saía da tela (rolagem lateral de 101 px). Agora
  1 coluna no celular e 2 a partir do tablet: nenhuma rolagem lateral, nenhum campo sobre outro, nada fora da linha.
  390, 768 e 1280.
  E744 (tabela da Fable #3832): a linha de desconto só existe no fluxo de demonstração (`ReembolsoPreview`); na sessão
  real de morador ela não aparece. A medida passa ao modo demonstração (admin com ?demo=1), que só existe com
  NEXT_PUBLIC_MODO_DEMO_PAINEL=1 (como o t4): sem a flag o teste é PULADO — e pulado não conta como verde. A regra da
  linha segue travada também no teste estático `linha-desconto-768.test.ts`. A asserção de layout fica igual.
*/
const DEMO_LIGADO_NO_AMBIENTE = process.env.NEXT_PUBLIC_MODO_DEMO_PAINEL === "1";

test.describe("T909 — Reembolso: a linha de desconto cabe no celular, no tablet e no computador", () => {
  test.skip(!DEMO_LIGADO_NO_AMBIENTE, "Modo demonstração desligado neste ambiente (NEXT_PUBLIC_MODO_DEMO_PAINEL)");
  test.use({ storageState: authFile("admin") });

  for (const w of [390, 768, 1280] as const) {
    test(`a ${w} px`, async ({ page: p }) => {
      await p.setViewportSize({ width: w, height: 1024 });
      await p.goto("/dashboard/reembolsos?demo=1", { waitUntil: "domcontentloaded" });
      const linha = p.getByTestId("reembolso-linha-desconto");
      await expect(linha).toBeVisible({ timeout: 30_000 });
      const r = await linha.evaluate((el) => {
        const k = [...el.children].map((c) => c.getBoundingClientRect());
        let sobre = 0;
        for (let i = 0; i < k.length; i++)
          for (let j = i + 1; j < k.length; j++)
            if (!(k[i].right <= k[j].left || k[i].left >= k[j].right || k[i].bottom <= k[j].top || k[i].top >= k[j].bottom)) sobre++;
        const pr = el.getBoundingClientRect();
        return { lateral: document.documentElement.scrollWidth - innerWidth, sobre, fora: k.filter((c) => c.right > pr.right + 1).length };
      });
      expect({ sobre: r.sobre, fora: r.fora }, JSON.stringify(r)).toEqual({ sobre: 0, fora: 0 });
      expect(r.lateral, "rolagem lateral").toBeLessThanOrEqual(1);
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t909-reembolso-${w}.png` });
    });
  }
});
