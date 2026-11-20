import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1694 — E1031 (19/11; família do E1025). A área do admin ficava 30 s "ocupada" em cada tela: o link "Voltar ao site"
  da casca pré-carregava a página de saída (a inicial, ou a última página pública), e esses pedidos `/?_rsc=…` ficavam
  pendentes cerca de 29 s até o navegador os abortar. A tela abria em menos de 1 s; quem esperava era quem espera a rede
  sossegar (os testes da Central de agentes: o t29 gastava 35 s de um teto de 45, o t291 não cabia).
  O E1025 já tinha tirado o pré-carregamento dos logotipos do painel; este link, que só existe na área do admin, ficou.
  Mede, em /admin/agentes e em /admin, a 390 e a 1280 px:
    1. nenhum pré-carregamento do destino do "Voltar ao site";
    2. a rede sossega em menos de 10 s (antes: 31 s);
    3. o link continua a funcionar: o clique leva ao destino.
*/
const TETO_DO_SOSSEGO_MS = 10_000;

test.describe("T1694 — E1031: a área do admin não pré-carrega a página de saída @E1031", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ timeout: 90_000 });

  for (const largura of [390, 1280] as const) {
    for (const rota of ["/admin/agentes", "/admin"] as const) {
      test(`${largura} px — ${rota}: sem pré-carregar a saída, a rede sossega em menos de 10 s e o link funciona`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const preCarregados: string[] = [];
        page.on("request", (r) => {
          if (r.headers()["next-router-prefetch"]) preCarregados.push(new URL(r.url()).pathname);
        });

        const t0 = Date.now();
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const link = page.getByTestId("admin-voltar-site");
        await expect(link, "a área do admin tem o link de saída").toBeAttached({ timeout: 30_000 });
        expect(new URL(page.url()).pathname, "a conta de admin do laboratório abre a tela pedida").toBe(rota);
        const sossegou = await page.waitForLoadState("networkidle", { timeout: 45_000 }).then(() => true, () => false);
        const levou = Date.now() - t0;

        const destino = new URL((await link.getAttribute("href"))!, baseURL).pathname;
        expect(preCarregados.filter((p) => p === destino), `pré-carregamentos de "${destino}", o destino do "Voltar ao site"`).toEqual([]);
        expect(sossegou, `a rede de ${rota} não sossegou em 45 s`).toBe(true);
        expect(levou, `a rede de ${rota} levou ${levou} ms a sossegar (teto ${TETO_DO_SOSSEGO_MS} ms)`).toBeLessThan(TETO_DO_SOSSEGO_MS);

        // O link segue a funcionar sem o pré-carregamento. A 1280 px ele pode estar fora da vista: o clique é pelo DOM.
        await link.evaluate((a: HTMLAnchorElement) => a.click());
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000, message: "o clique leva ao destino do link" }).toBe(destino);
      });
    }
  }
});
