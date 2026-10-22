import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T269 — Anunciar imóvel (QA do Daniel, 22/10): a barra fixa "Fotos: 0 de 8 mínimas" do celular não fica sobre o
 * formulário. A 390 px: a barra encosta no fim da tela; ao focar cada campo e botão do passo, ele fica inteiro acima da
 * barra e do "Fale com a Viva"; no fim da rolagem, o último controle tem respiro acima dos dois. A 1280 px não há
 * barra e o fim da página fica livre do "Fale com a Viva".
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t269.${sufixo}@lab.vivanomads.test`, nome: "Bia Fotos", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";

type Caixa = { top: number; bottom: number; left: number; right: number };
/** Topo do que é fixo embaixo (barra de fotos e "Fale com a Viva"), por faixa horizontal. */
async function fixosEmbaixo(page: Page): Promise<Caixa[]> {
  return page.evaluate(() =>
    ['[data-testid="barra-fotos"]', '[data-testid="fale-com-a-viva"]']
      .map((s) => document.querySelector<HTMLElement>(s))
      .filter((el): el is HTMLElement => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
  );
}
const cruza = (a: Caixa, b: Caixa) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe("T269 — Anunciar: a barra de fotos não cobre o formulário", () => {
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
      await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });

      const barra = page.getByTestId("barra-fotos");
      if (largura === 390) {
        await expect(barra).toBeVisible();
        await expect(page.getByTestId("barra-fotos-contador")).toContainText("Fotos:");
        await expect.poll(async () => Math.round((await barra.boundingBox())!.y + (await barra.boundingBox())!.height)).toBe(altura);
      } else {
        await expect(barra).toBeHidden();
      }

      // Cada controle do formulário, ao receber o foco, fica inteiro acima do que é fixo embaixo.
      const total = await page.locator("main").evaluate((m) => {
        const els = Array.from(m.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, a[href]"))
          .filter((el) => !el.closest('[data-testid="barra-fotos"]') && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden");
        els.forEach((el, i) => el.setAttribute("data-t269", String(i)));
        return els.length;
      });
      expect(total).toBeGreaterThan(3);
      const cobertos: string[] = [];
      for (let i = 0; i < total; i++) {
        const c = await page.evaluate((n) => {
          const el = document.querySelector<HTMLElement>(`[data-t269="${n}"]`)!;
          el.focus({ preventScroll: false });
          if (document.activeElement !== el) el.scrollIntoView({ block: "nearest" });
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, nome: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"` };
        }, i);
        if (c.bottom - c.top > altura / 2) continue; // campo maior que meia tela (ex.: mapa) não cabe acima de nada
        const fixos = await fixosEmbaixo(page);
        if (fixos.some((f) => cruza(c, f))) cobertos.push(c.nome);
      }
      expect(cobertos, "controles embaixo da barra ou do 'Fale com a Viva' ao receber o foco").toEqual([]);

      // Fim da rolagem: o último controle fica acima dos fixos, com pelo menos 16 px de respiro.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      const ultimo = await page.locator("main").evaluate((m) => {
        const els = Array.from(m.querySelectorAll<HTMLElement>("button, input:not([type=hidden]), select, textarea, a[href]"))
          .filter((el) => !el.closest('[data-testid="barra-fotos"]') && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden");
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
