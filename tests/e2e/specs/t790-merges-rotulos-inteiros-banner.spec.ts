import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { abrirComoConta, temContaVarredura } from "../fixtures/varredura";

/*
  T790 — merges de 31/10 (noite), Pista C, bloco 111. Pelas telas de verdade, a 390 e a 1280 px:
   A. #1732 — Conta (celular): a descrição de cada item vai em até 2 linhas, sem corte numa linha só;
   B. #1734 — cartões de número (StatCard): o rótulo vai em até 2 linhas, sem corte numa linha só (Início do morador);
   C. #1733 — Seja parceiro (/parceiros, visitante): grade de 2 colunas nas categorias; com número ímpar, a última
      ocupa a linha inteira (nenhuma fica sozinha numa coluna);
   D. #1736 — /seguranca abre com o banner das institucionais (BannerTopo), com o título de sempre.
  Fora daqui: #1738 (só documento), #1740 e #1741 (migrações de massa de QA, com teste de unidade próprio).
*/
const LARGURAS = [1280, 390] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);

async function visitante(browser: Browser, largura: number, caminho: string): Promise<Page> {
  const p = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: altura(largura) } })).newPage();
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}

/** Até 2 linhas (line-clamp 2), sem `nowrap` (o corte antigo com reticências numa linha só). */
async function ateDuasLinhas(p: Page, testid: string, rotulo: string) {
  const els = p.getByTestId(testid);
  await expect(els.first(), `${rotulo}: aparece`).toBeVisible({ timeout: 30_000 });
  const caixas = await els.evaluateAll((xs) =>
    xs
      .filter((e) => (e as HTMLElement).offsetParent)
      .map((e) => {
        const s = getComputedStyle(e);
        const linha = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.25;
        return { t: (e.textContent ?? "").trim(), clamp: s.webkitLineClamp || s.getPropertyValue("-webkit-line-clamp"), nowrap: s.whiteSpace === "nowrap", linhas: Math.round(e.getBoundingClientRect().height / linha) };
      }),
  );
  expect(caixas.length, `${rotulo}: há itens`).toBeGreaterThan(0);
  for (const c of caixas) {
    expect(c.clamp, `${rotulo} "${c.t}": line-clamp 2`).toBe("2");
    expect(c.nowrap, `${rotulo} "${c.t}": não corta numa linha só`).toBe(false);
    expect(c.linhas, `${rotulo} "${c.t}": até 2 linhas`).toBeLessThanOrEqual(2);
  }
}

test.describe("T790 — merges de 31/10 (noite): descrições e rótulos inteiros, grade par do Seja parceiro, banner da /seguranca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  for (const largura of LARGURAS) {
    test(`A. ${largura} px: Conta — a descrição de cada item vai em até 2 linhas (#1732)`, async ({ browser }) => {
      const p = await (await browser.newContext({ storageState: authFile("inquilino"), viewport: { width: largura, height: altura(largura) } })).newPage();
      await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("conta-menu")).toBeVisible({ timeout: 30_000 });
      await ateDuasLinhas(p, "conta-item-descricao", "Conta");
      await p.context().close();
    });

    test(`B. ${largura} px: cartões de número — o rótulo vai em até 2 linhas (#1734)`, async ({ browser }) => {
      test.skip(!temContaVarredura("INQUILINA"), "sem a conta INQUILINA na massa da varredura");
      const { page: p } = await abrirComoConta(browser, "INQUILINA", largura === 390 ? "390" : "1280");
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await ateDuasLinhas(p, "stat-rotulo", "StatCard");
      await p.context().close();
    });

    test(`C. ${largura} px: Seja parceiro — categorias em grade par, a ímpar ocupa a linha (#1733)`, async ({ browser }) => {
      const p = await visitante(browser, largura, "/parceiros");
      const grade = p.getByTestId("sp-categorias").first();
      await grade.scrollIntoViewIfNeeded({ timeout: 30_000 });
      const r = await grade.evaluate((g) => {
        const cols = getComputedStyle(g).gridTemplateColumns.split(" ").length;
        const itens = Array.from(g.children).map((c) => c.getBoundingClientRect());
        const largura = g.getBoundingClientRect().width;
        const ultimo = itens[itens.length - 1];
        return { cols, n: itens.length, ultimoLargo: Math.round(ultimo.width), largura: Math.round(largura) };
      });
      expect(r.cols, "2 colunas").toBe(2);
      if (r.n % 2 === 1) expect(r.ultimoLargo, `a última categoria ocupa a linha inteira (${JSON.stringify(r)})`).toBeGreaterThanOrEqual(r.largura - 2);
      else expect(r.ultimoLargo, `com número par, a última fica numa coluna (${JSON.stringify(r)})`).toBeLessThan(r.largura / 2 + 2);
      await p.context().close();
    });

    test(`D. ${largura} px: /seguranca abre com o banner das institucionais (#1736)`, async ({ browser }) => {
      const p = await visitante(browser, largura, "/seguranca");
      const banner = p.getByTestId("banner-topo").first();
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await expect(banner.getByRole("heading", { level: 1 })).toHaveText("Morar com segurança na Viva Nomads");
      const topo = await banner.boundingBox();
      expect(Math.round(topo!.width), "o banner ocupa a largura da tela").toBeGreaterThanOrEqual(largura - 20);
      await p.context().close();
    });
  }
});
