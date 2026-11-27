import { test, expect, type Page } from "@playwright/test";

/*
  T2141 — E994 (guarda de regressão, DUET-2019 item 3) @E994 @ao-vivo-seguro (só lê páginas públicas).
  Regra (E994; correção #3951, src/components/layout/footer.tsx): à largura EXATA de 1280 px, a linha
  "Suporte: suporte@vivanomads.com.br" do rodapé fica numa linha só (xl:whitespace-nowrap).
  O que esta guarda acrescenta ao t2200 (que encolhe a coluna para 250 px em /favoritos):
    1. o layout NATURAL, sem mexer em nada da página, nas páginas públicas que têm o rodapé (com e sem a faixa do
       flutuante): a linha mede uma linha só;
    2. a frase, que já não pode quebrar, não invade a coluna vizinha ("Plataforma"): o fim do texto fica à esquerda
       do início da coluna seguinte, e nada passa da largura da página (sem rolagem para o lado).
  O item segue aberto até à prova visual real do Gerente (regra do E780); esta spec é só a guarda do laboratório.
*/

const PAGINAS = ["/", "/buscar", "/favoritos", "/como-funciona"] as const;
const linhaSuporte = (p: Page) => p.locator("footer p", { hasText: "Suporte:" });

async function medir(p: Page) {
  return linhaSuporte(p).evaluate((el) => {
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    const faixa = document.createRange();
    faixa.selectNodeContents(el);
    const texto = faixa.getBoundingClientRect();
    const coluna = el.parentElement as HTMLElement;
    const vizinha = coluna.nextElementSibling as HTMLElement | null;
    return {
      linhas: Math.round(el.getBoundingClientRect().height / lh),
      fimTexto: texto.right,
      inicioVizinha: vizinha ? vizinha.getBoundingClientRect().left : Number.POSITIVE_INFINITY,
      vizinha: vizinha?.textContent?.trim().slice(0, 20) ?? "",
      rolagemLateral: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

test.describe("T2141 — E994: a 1280 px exatos, a linha 'Suporte' do rodapé fica numa linha e não invade a coluna vizinha @E994 @ao-vivo-seguro", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const caminho of PAGINAS) {
    test(`${caminho} — 1280 px, layout natural: uma linha só, sem invadir a coluna "Plataforma"`, async ({ page }) => {
      await page.goto(caminho, { waitUntil: "networkidle" });
      await linhaSuporte(page).scrollIntoViewIfNeeded();
      await expect(linhaSuporte(page)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(page.viewportSize()?.width, "a largura é a exata de 1280 px").toBe(1280);
      const m = await medir(page);
      expect(m.linhas, "a linha 'Suporte' fica numa linha só").toBe(1);
      expect(m.vizinha, "a coluna vizinha é a 'Plataforma'").toContain("Plataforma");
      expect(m.fimTexto, `o fim da frase (${m.fimTexto.toFixed(1)} px) fica antes do início da coluna vizinha (${m.inicioVizinha.toFixed(1)} px)`).toBeLessThanOrEqual(m.inicioVizinha);
      expect(m.rolagemLateral, "a página não rola para o lado").toBeLessThanOrEqual(0);
    });
  }
});
