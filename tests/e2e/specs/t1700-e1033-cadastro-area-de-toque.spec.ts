import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T1700 — E1033, passo 3, família "cadastro do anúncio": os 5 usos soltos têm a área de toque REAL de 44 × 44 px (helper
  do passo 1), em tela de toque (390 px) e com rato (1280 px): "−" e "+" de TODOS os contadores (Detalhes), "Ver
  fotógrafos na cidade do imóvel" (Fotos), "Adicionar faixa de desconto" (Preço) e "Faltam N itens…" (Revisão).
  Antes: a classe antiga só dava a área em tela de toque; com rato nenhum dos cinco a tinha.
  O miolo do contador (o número, vizinho encostado do "−" e do "+") também é medido: a área de um não tira a do outro.
  A t817 continua a cobrir o toque a 390 e 768 px (o primeiro elemento de cada tipo); esta mede todos, nos dois perfis.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1700.${sufixo}@lab.vivanomads.test`, nome: "Rita Rato", role: "owner" as const };
const ids: Record<string, string> = {};

/** etapa, seletor, rótulo, quantos no mínimo têm de existir (nada de pular em silêncio). */
const ALVOS: [PassoCadastro, string, string, number][] = [
  ["detalhes", '[data-testid="contador"] button', "− e + dos contadores", 4],
  ["detalhes", '[data-testid="contador-miolo"]', "o número dos contadores", 2],
  ["fotos", '[data-testid="porta-fotografo-link"]', "Ver fotógrafos na cidade do imóvel", 1],
  ["preco", '[data-testid="adicionar-faixa"]', "Adicionar faixa de desconto", 1],
  ["revisao", '[data-testid="publicar-motivo"]', "Faltam N itens antes de publicar", 1],
];

test.describe("T1700 — cadastro: área de toque 44×44 com qualquer apontador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    const toque = largura === 390;
    test(`${largura} px, ${toque ? "toque" : "rato"}: os 5 usos soltos do cadastro`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      for (const [etapa, sel, rotulo, minimo] of ALVOS) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, etapa, 30_000);
        const todos = p.locator(sel);
        await expect(todos.first(), `${etapa}: ${rotulo} não apareceu`).toBeVisible({ timeout: 20_000 });
        const n = await todos.count();
        expect(n, `${etapa}: ${rotulo}`).toBeGreaterThanOrEqual(minimo);
        for (let i = 0; i < n; i++) {
          const el = todos.nth(i);
          const nome = (await el.getAttribute("aria-label")) ?? (await el.textContent())?.trim().slice(0, 40) ?? `${i}`;
          expect((await areaDeToque(el)).faltam, `${etapa}: ${rotulo} — "${nome}" (${toque ? "toque" : "rato"})`).toEqual([]);
        }
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${etapa}: sem rolagem lateral`).toBeLessThanOrEqual(1);
      }
      await ctx.close();
    });
  }
});
