import { test, expect, type Locator } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T819 — contraste em Indicações (02/11, Pista A, WCAG AA 4,5:1): no cartão verde, o código do convite (antes verde
  claro, 3,7:1) e o botão "Copiar" (antes lima com texto verde, 2,8:1) passam de 4,5:1. 390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t819.${sufixo}@lab.vivanomads.test`, nome: "Iva Indica", role: "owner" as const };
const ids: Record<string, string> = {};

async function contraste(l: Locator): Promise<number> {
  return l.evaluate((e) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d")!;
    const rgba = (c: string) => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    let n: Element | null = e;
    let fundo = [255, 255, 255];
    while (n) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] >= 1) { fundo = c.slice(0, 3); break; }
      n = n.parentElement;
    }
    const t = rgba(getComputedStyle(e).color);
    const cor = t.slice(0, 3).map((v, i) => v * t[3] + fundo[i] * (1 - t[3]));
    const lum = (c: number[]) => {
      const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const a = lum(cor), b = lum(fundo);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

test.describe("T819 — Indicações: contraste do código e do Copiar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });
  for (const w of [390, 1280] as const) {
    test(`a ${w} px: código e "Copiar" com contraste ≥ 4,5:1`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/indicacoes", { waitUntil: "domcontentloaded" });
      const codigo = p.getByTestId("indicacao-codigo");
      await expect(codigo).toBeVisible({ timeout: 30_000 });
      expect(await contraste(codigo)).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(p.getByTestId("indicacao-copiar"))).toBeGreaterThanOrEqual(4.5);
      await p.screenshot({ path: `tests/laboratorio/saida/t819-indicacoes-${w}.png` });
      await p.context().close();
    });
  }
});
