import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, temContaVarredura, type ChaveConta } from "../fixtures/varredura";

/*
  T923 — #2005 (Pista A, varredura 01/11): <Link><Button> (um <button> dentro de um <a>: HTML inválido, dois alvos de
  foco no Tab, o leitor de tela anuncia os dois) virou ButtonLink nas telas de contratos, locações, pedidos do morador e
  pedidos da cidade. Na tela de verdade, com as contas da massa da varredura (que têm contrato e locação), a 390 e a
  1280 px: nenhum <button> dentro de <a> (nem <a> dentro de <button>) na página, e os links com cara de botão existem.
*/
const SAIDA = "tests/laboratorio/saida";
const TELAS: { conta: ChaveConta; rota: string; nome: string }[] = [
  { conta: "DONO17", rota: "/dashboard/contratos", nome: "Contratos (proprietário)" },
  { conta: "DONO17", rota: "/dashboard/pedidos-cidade", nome: "Pedidos da cidade (proprietário)" },
  { conta: "INQUILINA", rota: "/dashboard/locacoes", nome: "Locações (morador)" },
  { conta: "INQUILINA", rota: "/dashboard/pedidos", nome: "Pedidos (morador)" },
];

test.describe("T923 — #2005: nenhum botão dentro de link (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas da massa da varredura).");

  for (const t of TELAS) {
    for (const tam of TAMANHOS) {
      test(`${t.nome} @${tam.nome}: sem <a><button>`, async ({ browser }) => {
        test.skip(!temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
        const { context, page } = await abrirComoConta(browser, t.conta, tam.nome);
        const r = await page.goto(t.rota, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const aninhados = await page.locator("a button, a [role=button], button a").evaluateAll((els) =>
          els.map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? "").trim().slice(0, 40)}" em ${e.closest("a,button")?.parentElement?.closest("a,button")?.tagName.toLowerCase() ?? e.closest("a")?.tagName.toLowerCase()}`),
        );
        console.log(`t923|${t.nome}|${tam.nome}|aninhados=${aninhados.length}|${aninhados.join(" ; ")}`);
        expect(aninhados, "nenhum botão dentro de link").toEqual([]);
        await page.screenshot({ path: `${SAIDA}/t923-${t.rota.split("/").pop()}-${tam.width}.png` });
        await context.close();
      });
    }
  }
});
