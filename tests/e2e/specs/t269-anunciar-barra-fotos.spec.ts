import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T269 — Anunciar imóvel (QA do Daniel, 22/10; E107 do Muse): a faixa fixa "Fotos: N de 8" do celular SAIU — ela vazava
 * para os passos 1 e 3–10 e, no Passo 2, repetia o contador da página. A 390 e 1280 px: nenhum dos 10 passos tem a faixa;
 * o Passo 2 tem o contador e o envio dele (uma fonte só). E, no Passo 2, ao focar cada campo e botão, ele fica inteiro
 * acima do que é fixo embaixo (o rodapé do fluxo); no fim da rolagem, o último controle tem respiro acima dele.
 */
import { TITULO_PASSO, type PassoCadastro } from "../fixtures/cadastro";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t269.${sufixo}@lab.vivanomads.test`, nome: "Bia Fotos", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";

type Caixa = { top: number; bottom: number; left: number; right: number };
/** Topo do que é fixo embaixo (barra de fotos e "Fale com a Viva"), por faixa horizontal. */
async function fixosEmbaixo(page: Page): Promise<Caixa[]> {
  return page.evaluate(() =>
    ['[data-testid="assistente-rodape"]', '[data-testid="fale-com-a-viva"]']
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((el): el is HTMLElement => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
  );
}
const cruza = (a: Caixa, b: Caixa) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe("T269 — Anunciar: sem a faixa fixa de fotos; nada embaixo do rodapé (E107)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria conta).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura}px — nenhum controle embaixo da barra, em qualquer ponto e no fim`, async ({ browser }) => {
      test.setTimeout(150_000);
      const page = await entrar(browser, dono.email, senha);
      const altura = largura === 390 ? 844 : 900;
      await page.setViewportSize({ width: largura, height: altura });
      // E107: a faixa "Fotos: N de 8" não existe em nenhum dos 10 passos.
      for (const passo of Object.keys(TITULO_PASSO) as PassoCadastro[]) {
        await page.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO[passo], { timeout: 25_000 });
        await expect(page.getByTestId("barra-fotos"), passo).toHaveCount(0);
        await expect(page.getByText(/Fotos: \d+ de \d+ mínimas/), passo).toHaveCount(0);
        if (passo === "tipo") await page.screenshot({ path: `${SAIDA}/t269-passo1-${largura}.png` });
      }
      // No Passo 2, uma fonte só: o contador e o "+ Adicionar foto" da própria página.
      await page.goto("/dashboard/imoveis/novo?etapa=fotos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("etapa-fotos")).toBeVisible({ timeout: 25_000 });
      await expect(page.getByTestId("fotos-contagem")).toContainText("0 / 8 fotos");
      await expect(page.getByTestId("fotos-adicionar")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t269-passo2-${largura}.png` });

      // Cada controle do formulário, ao receber o foco, fica inteiro acima do que é fixo embaixo.
      const total = await page.locator("main").evaluate((m) => {
        const els = Array.from(m.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, a[href]"))
          .filter((el) => !el.closest('[data-testid="assistente-rodape"]') && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden");
        els.forEach((el, i) => el.setAttribute("data-t269", String(i)));
        return els.length;
      });
      expect(total).toBeGreaterThan(3);
      const cobertos: string[] = [];
      for (let i = 0; i < total; i++) {
        const c = await page.evaluate(async (n) => {
          const el = document.querySelector<HTMLElement>(`[data-t269="${n}"]`)!;
          el.focus({ preventScroll: false });
          if (document.activeElement !== el) el.scrollIntoView({ block: "nearest" });
          // O html tem scroll-smooth: a rolagem até o campo é animada; mede quando ela para.
          for (let y = -1, parado = 0; parado < 3; ) {
            await new Promise((r) => requestAnimationFrame(r));
            parado = scrollY === y ? parado + 1 : 0;
            y = scrollY;
          }
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, nome: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"` };
        }, i);
        if (c.bottom - c.top > altura / 2) continue; // campo maior que meia tela (ex.: mapa) não cabe acima de nada
        const fixos = await fixosEmbaixo(page);
        if (fixos.some((f) => cruza(c, f))) cobertos.push(c.nome);
      }
      expect(cobertos, "controles embaixo do rodapé ou do 'Fale com a Viva' ao receber o foco").toEqual([]);

      // Fim da rolagem: o último controle fica acima dos fixos, com pelo menos 16 px de respiro.
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await page.waitForTimeout(300);
      const ultimo = await page.locator("main").evaluate((m) => {
        const els = Array.from(m.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, a[href]"))
          .filter((el) => !el.closest('[data-testid="assistente-rodape"]') && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden");
        const r = els.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0].getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      const fixos = await fixosEmbaixo(page);
      for (const f of fixos) if (ultimo.left < f.right && f.left < ultimo.right) expect(ultimo.bottom + 16).toBeLessThanOrEqual(f.top);
      expect(fixos.some((f) => cruza(ultimo, f))).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t269-anunciar-fim-${largura}.png` });
      await page.close();
    });
  }
});
