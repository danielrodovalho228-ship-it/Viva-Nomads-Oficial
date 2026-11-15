import { expect, type Page } from "@playwright/test";
import { COOKIE_TELA } from "../../../src/lib/conta/redirecionar-no-servidor";

/*
  E744, passo 4 (15/11/2026) — o cookie da largura da tela (`vn-tela`) e as sessões gravadas da suíte.

  Desde o E798 (12/11) o servidor (proxy) manda /dashboard/conta para o Perfil quando esse cookie diz "larga". A sessão que a
  preparação da suíte grava (tests/e2e/global-setup.ts) é feita a 1280 px e leva `vn-tela=larga`. Um teste que roda a 390 px
  com essa sessão e abre /dashboard/conta antes de a casca do painel regravar o cookie cai no Perfil, onde o menu da Conta
  não existe (t14 no projeto app-mobile e t568, vermelhos desde 13/11).

  Um celular de verdade nunca tem "larga" nesse cookie. O teste espera o que a casca faz na primeira tela do painel a 390 px
  (gravar "estreita") antes de abrir a Conta — a mesma espera do t1611. Nenhuma asserção muda.
*/
export async function esperarTelaEstreita(page: Page): Promise<void> {
  await expect
    .poll(async () => (await page.context().cookies()).find((c) => c.name === COOKIE_TELA)?.value, {
      message: "a casca do painel grava a tela estreita (cookie da largura) a 390 px",
      timeout: 20_000,
    })
    .toBe("estreita");
}
