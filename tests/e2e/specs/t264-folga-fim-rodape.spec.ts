import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/*
  T264 — pacote D-V (QA do Muse em produção, 22/10, depois do #998): no fim da rolagem, nada fixo embaixo cobre o fim da
  página. Na página do imóvel a barra de preço (celular) e o "Fale com a Viva" cobriam as duas últimas linhas do rodapé
  ("© … Estadias de 30 a 180 dias" e "A plataforma conecta proprietários e inquilinos — não é parte do contrato"),
  sem respiro que as liberasse. Régua vigente: conteúdo que a rolagem não revela por completo = defeito.
  Confere a 390 e 1280 px: no fim da página, cada linha do rodapé (texto e links) fica inteira acima do topo de todo
  elemento fixo/sticky visível que encosta no fim da tela (abas, barra de preço, "Comparar", "Fale com a Viva").
*/
const LARGURAS = [
  { largura: 390, altura: 844 },
  { largura: 1280, altura: 900 },
] as const;
const ROTAS = [
  { rota: "/imoveis/ube-001", nome: "página do imóvel" },
  { rota: "/", nome: "início" },
  { rota: "/buscar", nome: "busca" },
  { rota: "/cidades/uberlandia", nome: "cidade" },
];

async function rolarAteOFim(page: Page) {
  let alt = -1;
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h === alt) break;
    alt = h;
  }
}

/** Linhas do rodapé cobertas por algo fixo no fim da tela: devolve "linha ⟂ fixo". */
async function rodapeCoberto(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rodape = document.querySelector("footer.vn-rodape");
    if (!rodape) return ["sem o rodapé do site"];
    const fixoOuSticky = (el: Element) => {
      const p = getComputedStyle(el).position;
      return p === "fixed" || p === "sticky";
    };
    // Os fixos de baixo: visíveis, encostando na metade de baixo da tela, fora do rodapé.
    const fixos = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
      if (!fixoOuSticky(el) || rodape.contains(el)) return false;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top > innerHeight / 2 && r.top < innerHeight;
    });
    const linhas = Array.from(rodape.querySelectorAll<HTMLElement>("p, a, h2, li"))
      .filter((el) => el.getBoundingClientRect().height > 0 && (el.textContent ?? "").trim());
    const out: string[] = [];
    for (const l of linhas) {
      const a = l.getBoundingClientRect();
      for (const f of fixos) {
        const b = f.getBoundingClientRect();
        const cruza = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (cruza) out.push(`"${(l.textContent ?? "").trim().slice(0, 50)}" ⟂ ${f.dataset.testid || f.tagName.toLowerCase()}`);
      }
    }
    return [...new Set(out)];
  });
}

for (const { largura, altura } of LARGURAS) {
  test.describe(`T264 — fim da página sem nada fixo por cima (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: altura }, storageState: { cookies: [], origins: [] } });
    for (const { rota, nome } of ROTAS) {
      test(`${nome}: as últimas linhas do rodapé ficam acima dos fixos`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "networkidle" });
        const ultima = page.locator("footer.vn-rodape p").last();
        await expect(ultima).toContainText("não é parte do contrato");
        // Blocos que carregam depois mudam a altura e o botão compacto cresce: mede de novo até a página assentar.
        await expect
          .poll(
            async () => {
              await rolarAteOFim(page);
              return rodapeCoberto(page);
            },
            { timeout: 15_000 },
          )
          .toEqual([]);
        await expect(ultima).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: `tests/laboratorio/saida/t264-${nome.replace(/\W+/g, "-")}-${largura}.png` });
      });
    }
    test("página do imóvel: o 'Fale com a Viva' fica acima da barra de preço (celular) e fora do rodapé no fim", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut).toBeVisible();
      if (largura < 1024) {
        const barra = page.getByTestId("barra-fixa-imovel");
        await expect(barra).toBeVisible();
        const [f, b] = [(await flut.boundingBox())!, (await barra.boundingBox())!];
        expect(f.y + f.height).toBeLessThanOrEqual(b.y);
        // A altura medida da barra chegou ao CSS.
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--altura-barra-fixa"))).toMatch(/^\d+px$/);
      }
      await rolarAteOFim(page);
      const f = (await flut.boundingBox())!;
      const copy = (await page.locator("footer.vn-rodape p").last().boundingBox())!;
      expect(copy.y + copy.height, "a última linha do rodapé termina acima do botão").toBeLessThanOrEqual(f.y);
    });
  });
}
