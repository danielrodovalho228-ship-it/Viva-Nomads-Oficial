import { test, expect, type Page } from "@playwright/test";

/*
  T845 — SPECS PERMANENTES DOS MERGES #1811 E #1813 (Pista C, 01/11). Os dois trouxeram só teste de fonte; aqui a prova
  na tela, a 390 e 1280 px, como visitante (sem conta: roda em qualquer ambiente com o anúncio de exemplo ube-001).
   A) #1811 (varredura 01/11): a faixa do imóvel diz "Proprietário:", nunca "Anfitrião:"; no anúncio de EXEMPLO,
      depois do "Pedir visita" (que não envia nada), o botão continua "Visita por vídeo", não "Visita por vídeo pedida".
   B) #1813 (conformidade parceiro-cadastro): em "Quero ser parceiro", as 6 categorias com foto são cartões com a foto
      carregada, em grade par (2 colunas no celular, 3 no computador); "Outro serviço" (sem foto) fica numa linha inteira
      embaixo; Pessoa física / Empresa marcados no verde da marca (a borda é a cor do texto forest, não o azul antigo).
*/
const SAIDA = "tests/laboratorio/saida";
const AZUL_500 = "rgb(59, 130, 246)";
const LARGURAS = [390, 1280] as const;

async function abrirExemplo(page: Page): Promise<boolean> {
  const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
  return !!r && r.status() !== 404;
}

for (const largura of LARGURAS) {
  test.describe(`T845 — "Proprietário:" e cadastro de parceiro com fotos (#1811, #1813) @${largura}`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test(`A. faixa diz "Proprietário:" e o exemplo não diz "pedida" (${largura} px)`, async ({ page }) => {
      test.setTimeout(90_000);
      test.skip(!(await abrirExemplo(page)), "Sem o anúncio de exemplo ube-001 neste ambiente.");
      const nome = page.getByTestId("faixa-nome").first();
      await expect(nome).toBeVisible({ timeout: 20_000 });
      await expect(nome.locator("xpath=..")).toContainText(/^\s*Proprietário:/);
      await expect(page.getByText("Anfitrião:", { exact: false })).toHaveCount(0);

      const abrir = page.getByTestId("visita-video-abrir").first();
      await abrir.scrollIntoViewIfNeeded();
      await expect(async () => {
        await abrir.click({ timeout: 3_000 });
        await expect(page.getByTestId("visita-video-passo")).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      const folha = page.getByTestId("visita-video-passo");
      await folha.getByTestId("visita-video-horario-0").fill("2030-01-01T10:00");
      await folha.getByTestId("visita-video-enviar").click();
      await expect(folha.getByTestId("visita-video-enviar")).toHaveCount(0, { timeout: 30_000 });
      await folha.getByRole("button", { name: "Fechar", exact: true }).first().click();
      await expect(folha).toBeHidden({ timeout: 10_000 });
      await expect(abrir).toContainText("Visita por vídeo");
      await expect(abrir).not.toContainText("pedida");
    });

    test(`B. categorias em cartões com foto, grade par, e seleção no verde (${largura} px)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
      const grade = page.getByTestId("sp-categorias");
      await grade.scrollIntoViewIfNeeded();
      const cartoes = grade.locator('[data-testid^="sp-cat-cartao-"]');
      await expect(cartoes).toHaveCount(6, { timeout: 20_000 });

      // Cada cartão tem a foto carregada de verdade (não só a tag).
      for (let i = 0; i < 6; i++) {
        const img = cartoes.nth(i).locator("img");
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      }
      // Grade par: 2 colunas no celular, 3 no computador (6 cartões, sem sobra numa linha).
      const xs = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(new Set(xs).size, `colunas da grade @${largura}`).toBe(largura === 390 ? 2 : 3);

      // "Outro serviço" sem foto, numa linha inteira embaixo da grade.
      const outro = page.getByTestId("sp-cat-outro");
      await expect(outro).toHaveCount(1);
      await expect(grade.getByTestId("sp-cat-outro")).toHaveCount(0);
      const linha = outro.locator("xpath=ancestor::label[1]");
      await expect(linha.locator("img")).toHaveCount(0);
      const [g, l] = await Promise.all([grade.boundingBox(), linha.boundingBox()]);
      expect(g && l, "caixas da grade e da linha").toBeTruthy();
      expect(Math.abs(l!.width - g!.width), "a linha do 'Outro serviço' ocupa a largura da grade").toBeLessThanOrEqual(2);
      expect(l!.y, "'Outro serviço' fica embaixo da grade").toBeGreaterThanOrEqual(g!.y + g!.height - 1);

      // Pessoa física marcada: borda na cor do texto (forest), nunca o azul antigo.
      const pf = page.locator("label", { hasText: "Pessoa física (CPF)" });
      await pf.click();
      const cores = await pf.evaluate((el) => {
        const s = getComputedStyle(el);
        return { borda: s.borderTopColor, texto: s.color };
      });
      expect(cores.borda).not.toBe(AZUL_500);
      expect(cores.borda).toBe(cores.texto);
      await page.screenshot({ path: `${SAIDA}/t845-parceiro-categorias-${largura}.png`, fullPage: false });
    });
  });
}
