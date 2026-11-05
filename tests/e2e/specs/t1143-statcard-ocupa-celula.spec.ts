import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1143 — Matriz, passada 10 (#2579, 05/11): o StatCard passa a ocupar a célula da grade (h-full), e os indicadores que
 * dividem uma linha ficam com a mesma altura. A t869 (Pista A) cobre /dashboard/carteira; o componente é comum, então aqui
 * vão as outras grades de StatCard do painel do proprietário: Indicações (4 cartões) e Solicitações (4 cartões).
 * 390 e 1280, conta nova de proprietário:
 *   1. cada página mostra pelo menos 4 cartões;
 *   2. em cada linha, a diferença entre o mais alto e o mais baixo é de no máximo 1 px;
 *   3. nenhum cartão passa da sua célula (o h-full não estica além da grade) e não há estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1143.${sufixo}@lab.vivanomads.test`, nome: "Dora Indicadores", role: "owner" as const };
const ids: Record<string, string> = {};
const ROTAS = ["/dashboard/indicacoes", "/dashboard/solicitacoes"] as const;

test.describe("T1143 — StatCard ocupa a célula: indicadores da mesma linha com a mesma altura fora da carteira", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: Indicações e Solicitações com cartões uniformes por linha`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        for (const rota of ROTAS) {
          await p.goto(rota, { waitUntil: "domcontentloaded" });
          await expect(p.getByTestId("stat-valor").first(), rota).toBeVisible({ timeout: 20_000 });
          const caixas = await p.getByTestId("stat-valor").evaluateAll((es) =>
            es.map((e) => {
              const card = e.parentElement as HTMLElement;
              const c = card.getBoundingClientRect();
              const celula = (card.parentElement as HTMLElement).getBoundingClientRect();
              return { top: Math.round(c.top), h: Math.round(c.height), passa: Math.round(c.bottom - celula.bottom) };
            }),
          );
          expect(caixas.length, rota).toBeGreaterThanOrEqual(4);
          const linhas = new Map<number, number[]>();
          for (const c of caixas) linhas.set(c.top, [...(linhas.get(c.top) ?? []), c.h]);
          for (const [top, alturas] of linhas) {
            expect(Math.max(...alturas) - Math.min(...alturas), `${rota}, linha em ${top}px: ${alturas}`).toBeLessThanOrEqual(1);
          }
          for (const c of caixas) expect(c.passa, `${rota}: cartão passa da célula`).toBeLessThanOrEqual(1);
          expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), rota).toBeLessThanOrEqual(1);
        }
      } finally {
        await ctx.close();
      }
    });
  }
});
