// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, devices, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";
import { diasLivres, marcarPeriodo } from "../fixtures/calendario-dono";

/*
  T531 — E136 (#1379), guarda permanente da Pista C: a t424 olha o Passo 9 logo depois de digitar a data. Aqui, com o
  navegador em INGLÊS (en-US), a tela inteira depois de escolher as datas E de bloquear um período (a linha do
  bloqueio também mostra datas), e de novo na Revisão (Passo 10): nenhum mês em inglês ("Oct 25", "Nov", "October"…).
  1280 px (mouse) e 390 px num iPhone (toque, o seletor nativo).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t531.${sufixo}@lab.vivanomads.test`, nome: "Olga Outubro", role: "owner" as const };
const ids: { dono?: string; r1280?: string; r390?: string } = {};
const MES_EM_INGLES = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b/;

async function preencherData(page: Page, testid: string, iso: string) {
  const campo = page.getByTestId(testid);
  await campo.fill((await campo.getAttribute("type")) === "date" ? iso : isoParaBR(iso));
}

test.describe("T531 — E136: datas em pt-BR no Passo 9 e na Revisão, navegador em inglês", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.r1280 = await prepararRascunho(ids.dono, `Studio t531 a ${sufixo}`, { minPeriod: "30" });
    ids.r390 = await prepararRascunho(ids.dono, `Studio t531 b ${sufixo}`, { minPeriod: "30" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: Passo 9 com bloqueio e Revisão sem mês em inglês`, async ({ browser }) => {
      const { defaultBrowserType: _t, ...iphone } = devices["iPhone 13"];
      void _t;
      const ctx = w === 390 ? { ...iphone, locale: "en-US" } : { locale: "en-US" };
      const id = w === 390 ? ids.r390! : ids.r1280!;
      const page = await abrirPasso(browser, { email: dono.email, senha }, id, "disponibilidade", w, ctx);
      const de = emDiasBR(3);
      const ate = emDiasBR(60);
      await preencherData(page, "disponivel-de", de);
      await preencherData(page, "disponivel-ate", ate);
      const etapa = page.getByTestId("etapa-disponibilidade");
      // No computador a data fica no VALOR do campo de texto (dd/mm/aaaa); no toque, no texto ao lado do seletor nativo.
      if ((await page.getByTestId("disponivel-de").getAttribute("type")) === "date") {
        await expect(page.getByTestId("disponivel-de-texto")).toHaveText(isoParaBR(de), { timeout: 15_000 });
      } else {
        await expect(page.getByTestId("disponivel-de")).toHaveValue(isoParaBR(de), { timeout: 15_000 });
      }

      // Um bloqueio: a linha dele também tem datas.
      const livres = await diasLivres(etapa);
      const [ini, fim] = livres.filter((d) => d > de).slice(4, 6);
      const bloquear = await marcarPeriodo(etapa, ini, fim);
      await bloquear.click();
      await expect(etapa.locator(`[data-testid="bloqueio-item"][data-inicio="${ini}"]`).first()).toBeVisible({ timeout: 20_000 });

      const textoPasso = await etapa.innerText();
      expect(textoPasso.match(MES_EM_INGLES)?.[0] ?? null, "mês em inglês no Passo 9").toBeNull();
      await page.screenshot({ path: `tests/laboratorio/saida/t531-passo9-${w}.png` });

      // Revisão: o resumo da disponibilidade.
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "revisao", 30_000);
      const textoRevisao = await page.locator("main").innerText();
      expect(textoRevisao.match(MES_EM_INGLES)?.[0] ?? null, "mês em inglês na Revisão").toBeNull();
      await page.screenshot({ path: `tests/laboratorio/saida/t531-revisao-${w}.png` });
      await page.context().close();
    });
  }
});
