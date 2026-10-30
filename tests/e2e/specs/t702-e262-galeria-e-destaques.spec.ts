import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T702 — E262 (reprova do E259 no QA, 30/10), nas duas larguras (1280 e 390):
   (a) galeria na abertura FRIA (contexto novo, sem cache): ao abrir a foto, o painel já tem a imagem — a mesma versão
       da miniatura (mesma URL, já baixada) por baixo, e a grande pedida com prioridade alta por cima; nunca em branco;
   (b) like-for-like: o MESMO anúncio, completo no assistente, mostra na prévia do Passo 10 ("Ver no tamanho real") os
       mesmos "Destaques do imóvel" que a página pública mostra depois de publicado.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t702.${sufixo}@lab.vivanomads.test`, nome: "Gal Destaque", role: "owner" as const };
const ids: { dono?: string; galeria?: string; destaques: Record<number, string> } = { destaques: {} };
const LARGURAS = [1280, 390] as const;

/** Comodidades principais marcadas (as que viram destaque) e 1 vaga — como o assistente grava. */
async function marcarPrincipais(id: string) {
  const { error } = await adm()
    .from("property_amenities")
    .insert([
      { property_id: id, category: "trabalho", label: "Home office / escritório dedicado", sort_order: 0 },
      { property_id: id, category: "trabalho", label: "Internet fibra de alta velocidade", sort_order: 1 },
      { property_id: id, category: "conforto", label: "Ar-condicionado", sort_order: 2 },
    ]);
  expect(error).toBeNull();
  const { error: eVaga } = await adm().from("properties").update({ parking_spots: 1 }).eq("id", id);
  expect(eVaga).toBeNull();
}

const textos = (p: Page, raiz: string) => p.locator(`${raiz} [data-testid="destaques-imovel"] li`).allInnerTexts();

test.describe("T702 — E262: galeria na abertura fria e destaques da prévia × página pública", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.galeria = await criarImovelPronto(ids.dono, `Studio galeria ${sufixo}`, { ativo: true });
    await fotosReais(ids.galeria, ids.dono);
    for (const l of LARGURAS) {
      // O mesmo anúncio dos dois lados: no assistente (draft_data, o que a prévia lê) e no banco (o que a página lê).
      ids.destaques[l] = await prepararRascunho(ids.dono, `Studio destaques ${l} ${sufixo}`, {
        amenityKeys: { home_office: true, internet_fibra: true, ar_condicionado: true },
        parkingSpots: "1",
        internetMbps: "300",
      });
      await marcarPrincipais(ids.destaques[l]);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`(a) ${largura} px: abertura fria — a foto aberta já tem imagem (a da miniatura) por baixo da grande`, async ({ browser }) => {
      // Contexto novo = cache vazio.
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.galeria}`, { waitUntil: "domcontentloaded" });
      const tile = p.getByTestId("galeria-tile-0").locator("visible=true").first();
      const imgTile = tile.locator("img").first();
      await expect.poll(() => imgTile.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      const srcTile = await imgTile.evaluate((i: HTMLImageElement) => i.currentSrc);
      await tile.click();
      const painel = p.getByTestId("galeria-lightbox").getByTestId("galeria-lightbox-foto");
      await expect(painel).toBeVisible();
      const [baixo, cima] = [painel.locator("img").nth(0), painel.locator("img").nth(1)];
      // Por baixo: a mesma URL da miniatura (já baixada) — pinta sem esperar rede.
      await expect.poll(() => baixo.evaluate((i: HTMLImageElement) => i.currentSrc), { timeout: 5_000 }).toBe(srcTile);
      await expect.poll(() => baixo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 1_500 }).toBe(true);
      // Por cima: a grande, pedida já e com prioridade alta.
      await expect(cima).toHaveAttribute("fetchpriority", "high");
      await expect(cima).not.toHaveAttribute("loading", "lazy");
      await p.screenshot({ path: `${SAIDA}/t702-galeria-fria-${largura}.png` });
      await ctx.close();
    });
  }

  for (const largura of LARGURAS) {
    test(`(b) ${largura} px: a prévia do Passo 10 lista os mesmos destaques da página pública`, async ({ browser }) => {
      const id = ids.destaques[largura];
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
      await p.locator('[data-testid="previa-tamanho-real-abrir"]:visible').first().click();
      const previa = p.getByTestId("previa-tamanho-real");
      await expect(previa.getByTestId("destaques-imovel")).toBeVisible({ timeout: 15_000 });
      const naPrevia = await textos(p, '[data-testid="previa-tamanho-real"]');
      expect(naPrevia.length, "a prévia mostra destaques").toBeGreaterThanOrEqual(2);
      await previa.getByTestId("destaques-imovel").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t702-previa-destaques-${largura}.png` });
      await p.getByTestId("previa-tamanho-real-fechar").click();

      // Publicado (o mesmo anúncio): a página pública mostra os mesmos destaques, na mesma ordem.
      const { error } = await adm().from("properties").update({ status: "active" }).eq("id", id);
      expect(error).toBeNull();
      await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("destaques-imovel")).toBeVisible({ timeout: 20_000 });
      expect(await textos(p, "main")).toEqual(naPrevia);
      await p.getByTestId("destaques-imovel").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t702-publica-destaques-${largura}.png` });
      await p.context().close();
    });
  }
});
