import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, entrarNaPagina } from "../fixtures/laboratorio";

/*
  T1618 — E801 (D5, prova de 12/11): em /dashboard/conta/avaliacoes (hoje /dashboard/avaliacoes, E798) a miniatura da
  barra de rolagem flutuava sobre a linha das abas "Recebidas/Feitas". A fileira tinha overflow-x-auto e as abas -mb-px:
  o 1 px que vaza abria a rolagem vertical. Medida na tela: nenhuma barra ocupa espaço na fileira e nada vaza para baixo.
  Também em Favoritos (mesmo padrão de abas). Contas da massa (dono e inquilina), 1280 e 390 px.
*/
const CONTAS = [
  { nome: "DONO17", email: process.env.TESTES_VARREDURA_DONO17_EMAIL, senha: process.env.TESTES_VARREDURA_DONO17_SENHA },
  { nome: "INQUILINA", email: process.env.TESTES_VARREDURA_INQUILINA_EMAIL, senha: process.env.TESTES_VARREDURA_INQUILINA_SENHA },
];
const TELAS = [
  { rota: "/dashboard/avaliacoes?aba=recebidas", fileira: 'nav[aria-label="Avaliações"]', aba: '[data-testid="painel-aba-feitas"]' },
  { rota: "/dashboard/favoritos", fileira: "main div.overflow-x-auto.border-b", aba: null },
];

async function entrar(browser: Browser, email: string, senha: string, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 768 ? 844 : 900 } });
  const page = await ctx.newPage();
  await entrarNaPagina(page, email, senha);
  return page;
}

test.describe("T1618 — E801 abas sem barra de rolagem sobre a linha", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");

  for (const conta of CONTAS) {
    for (const largura of [1280, 390]) {
      test(`${conta.nome} ${largura}px — nenhuma barra de rolagem na fileira de abas`, async ({ browser }) => {
        test.skip(!conta.email || !conta.senha, "conta da massa ausente");
        const page = await entrar(browser, conta.email!, conta.senha!, largura);
        for (const t of TELAS) {
          await page.goto(t.rota, { waitUntil: "domcontentloaded" });
          const fileira = page.locator(t.fileira).first();
          await expect(fileira, `${t.rota}: fileira de abas`).toBeVisible({ timeout: 30_000 });
          const m = await fileira.evaluate((no) => {
            const el = no as HTMLElement;
            const cs = getComputedStyle(el);
            const bordaV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
            const bordaH = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
            return {
              barraHorizontal: el.offsetHeight - el.clientHeight - bordaV,
              barraVertical: el.offsetWidth - el.clientWidth - bordaH,
              vazaParaBaixo: el.scrollHeight - el.clientHeight,
            };
          });
          expect(m.barraVertical, `${t.rota}: barra de rolagem vertical ocupando ${m.barraVertical}px`).toBe(0);
          expect(m.barraHorizontal, `${t.rota}: barra de rolagem horizontal ocupando ${m.barraHorizontal}px`).toBe(0);
          expect(m.vazaParaBaixo, `${t.rota}: conteúdo vaza ${m.vazaParaBaixo}px para baixo (abre rolagem vertical)`).toBeLessThanOrEqual(0);
          if (t.aba) {
            await page.locator(t.aba).first().click();
            await expect(page).toHaveURL(/aba=feitas/);
          }
        }
        await page.context().close();
      });
    }
  }
});
