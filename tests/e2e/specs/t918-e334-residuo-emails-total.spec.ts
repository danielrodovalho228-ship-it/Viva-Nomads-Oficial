import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T918 — E334 resíduo (#1974, Pista B): a caixa "E-mails de teste guardados" (Admin → Dados de teste → aba E-mails) passou
  a mostrar o TOTAL contado no banco ou "—" quando a contagem falha — nunca 0 nem o tamanho da lista mostrada. A falha
  não se provoca no laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR); aqui, o caminho
  NORMAL: com a sessão de admin, a caixa mostra um número (não "—"); se a lista mostra só os mais recentes, o total é
  maior que eles; a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T918 — E334 resíduo (#1974): total de e-mails de teste é a contagem do banco (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const largura of [1280, 390] as const) {
    test(`aba E-mails @${largura}: o total é número e cobre a lista`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/dados-de-teste?aba=emails", { waitUntil: "domcontentloaded" });
      const total = page.getByTestId("emails-teste-total");
      await expect(total).toBeVisible({ timeout: 30_000 });
      const texto = (await total.innerText()).replace(/\s+/g, " ");
      const m = /(\d[\d.]*)/.exec(texto);
      console.log(`t918|${largura}|total|${texto}`);
      expect(texto, "a contagem do banco funcionou: número, não '—'").not.toMatch(/—/);
      expect(m, "um número na caixa").not.toBeNull();
      const n = Number(m![1].replace(/\./g, ""));
      // Se a lista mostra só os mais recentes, a caixa diz quantos e o total é maior que eles (não o tamanho da lista).
      const nota = /A lista mostra os (\d+) mais recentes/.exec((await page.getByTestId("emails-teste").innerText()).replace(/\s+/g, " "));
      console.log(`t918|${largura}|n=${n}|nota=${nota ? nota[1] : "-"}`);
      if (nota) expect(n, "o total é maior que a lista mostrada").toBeGreaterThan(Number(nota[1]));
      else expect(n).toBeGreaterThanOrEqual(0);
      await page.screenshot({ path: `${SAIDA}/t918-emails-${largura}.png` });
      await ctx.close();
    });
  }
});
