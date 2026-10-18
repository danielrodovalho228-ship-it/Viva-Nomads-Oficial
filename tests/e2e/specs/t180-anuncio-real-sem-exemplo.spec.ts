import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import {
  AVISO_EXEMPLO,
  IMOVEIS_COM_AVALIACAO_EXEMPLO,
  PROPRIETARIOS_EXEMPLO,
  SELO_EXEMPLO,
  avaliacoesDoExemplo,
} from "../../../src/config/exemplo-proprietarios";

/*
  T180 — Anúncio REAL sem nada dos dados de exemplo (plano de QA, 17/10), a 390 e 1280 px.
  Um anúncio criado no laboratório (dono novo, sem conversas nem estadias):
  - não mostra selo/aviso de exemplo, nomes, frases ou avaliações dos exemplos (prompt 9);
  - mostra "Novo na Viva" (faixa e "Sobre o proprietário") e "Novo na plataforma" no título;
  - não mostra estrelas de nota (nem no título, nem no proprietário), nem JSON-LD de Review/AggregateRating;
  - a página pública do dono também fica sem exemplo e sem estrelas.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.real180.${sufixo}@lab.vivanomads.test`, nome: "Rita Anunciante Sobrenomereal", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

/** Tudo que só existe nos exemplos: se aparecer num anúncio real, vazou. */
const MARCAS_DE_EXEMPLO = [
  SELO_EXEMPLO,
  AVISO_EXEMPLO,
  "(exemplo)",
  ...PROPRIETARIOS_EXEMPLO.flatMap((p) => [p.nome, p.bio]),
  ...IMOVEIS_COM_AVALIACAO_EXEMPLO.flatMap((id) => avaliacoesDoExemplo(id).map((a) => a.titulo)),
];

test.describe("T180 — anúncio real sem dados de exemplo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Real ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
    // Garante o cenário: nenhuma avaliação real deste imóvel.
    const { count } = await adm().from("avaliacoes").select("id", { count: "exact", head: true }).eq("imovel_id", ids.imovel);
    expect(count ?? 0).toBe(0);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — anúncio real: "Novo na Viva", sem estrelas e sem nada de exemplo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 1 })).toContainText(`Studio Real ${sufixo}`, { timeout: 20_000 });

      // Nada de exemplo.
      await expect(page.getByTestId("selo-exemplo")).toHaveCount(0);
      await expect(page.getByTestId("avaliacoes-exemplo")).toHaveCount(0);
      await expect(page.getByTestId("avaliacao-exemplo")).toHaveCount(0);
      await expect(page.getByTestId("proprietario-exemplo")).toHaveCount(0);
      await expect(page.getByTestId("mensagem-demo")).toHaveCount(0);
      const texto = await main.innerText();
      for (const marca of MARCAS_DE_EXEMPLO) expect(texto, `vazou do exemplo: "${marca}"`).not.toContain(marca);

      // "Novo na Viva" no lugar do tempo de resposta; "Novo na plataforma" no título.
      await expect(page.getByTestId("faixa-resposta")).toHaveText("Novo na Viva");
      await expect(page.getByTestId("sobre-proprietario").getByTestId("proprietario-resposta")).toHaveText("Novo na Viva");
      await expect(main).toContainText("Novo na plataforma");

      // Sem estrelas de nota: nem no título, nem no proprietário; a seção de avaliações fica no estado vazio.
      await expect(page.getByTestId("estrelas-titulo")).toHaveCount(0);
      await expect(page.getByTestId("proprietario-reputacao")).toHaveCount(0);
      await expect(main.locator("svg.fill-champagne")).toHaveCount(0);
      await expect(page.getByTestId("avaliacoes-vazio")).toBeVisible();
      const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(jsonLd.join("\n")).not.toMatch(/"(Review|AggregateRating)"/);

      await page.getByTestId("sobre-proprietario").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t180-anuncio-real-${largura}.png`, fullPage: false });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      // Página pública do dono: também sem exemplo e sem estrelas.
      await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "networkidle" });
      const perfil = page.getByTestId("pagina-proprietario");
      await expect(perfil).toContainText("Novo na Viva", { timeout: 20_000 });
      await expect(perfil.getByTestId("selo-exemplo")).toHaveCount(0);
      await expect(perfil.locator("svg.fill-champagne")).toHaveCount(0);
      const textoPerfil = await perfil.innerText();
      for (const marca of MARCAS_DE_EXEMPLO) expect(textoPerfil, `vazou do exemplo no perfil: "${marca}"`).not.toContain(marca);
      await page.screenshot({ path: `${SAIDA}/t180-perfil-real-${largura}.png`, fullPage: false });
    });
  }
});
