import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T707 — E262 (PR #1599), o que a T702 não cobre, nas duas larguras (1280 e 390):
   (a) galeria aberta, NAVEGANDO: na abertura fria, ir para a foto seguinte ("Próxima foto") também nunca deixa o painel
       em branco — por baixo, a mesma versão da miniatura daquela foto (mesmo srcset/sizes do quadro do mosaico ou do
       carrossel); por cima, a grande com prioridade alta. No computador, o "+N mais" abre na 1ª foto oculta com a mesma
       camada por baixo;
   (b) a abertura fria DENTRO da prévia do Passo 10 ("Ver no tamanho real"): a galeria da prévia é a da página pública
       e abre com a imagem da miniatura na hora (a T702 só olha a página pública);
   (c) ida e volta com os NÚMEROS do dono: o que o dono informa no assistente (internet 450 Mbps, 2 vagas, nenhuma
       comodidade principal) aparece com os mesmos números nos destaques da prévia e, depois de publicado, nos da
       página pública (a T702 só compara as duas listas, com 1 vaga e as comodidades).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t707.${sufixo}@lab.vivanomads.test`, nome: "Gaia Previa", role: "owner" as const };
const ids: { dono?: string; publico?: string; previa: Record<number, string>; numeros: Record<number, string> } = { previa: {}, numeros: {} };
const LARGURAS = [1280, 390] as const;
const SIZES_MINIATURA = "(max-width: 768px) 100vw, 50vw";
const altura = (l: number) => (l === 390 ? 844 : 900);

/** O quadro N visível da galeria (o carrossel no celular, o mosaico no computador) dentro de `raiz`. */
const quadro = (raiz: Locator | Page, n: number) => raiz.getByTestId(`galeria-tile-${n}`).locator("visible=true").first();

async function carregada(img: Locator, timeout: number) {
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout }).toBe(true);
}

/** O painel aberto: a camada de baixo (miniatura) e a de cima (grande). */
function painel(p: Page) {
  const foto = p.getByTestId("galeria-lightbox").getByTestId("galeria-lightbox-foto");
  return { foto, baixo: foto.locator("img").nth(0), cima: foto.locator("img").nth(1) };
}

/** As fotos do rascunho com o endereço real do Storage local (o next/image da prévia carrega a imagem). */
async function fotosReaisNoRascunho(id: string) {
  const { data, error } = await adm().from("properties").select("draft_data").eq("id", id).single();
  if (error) throw error;
  const d = data!.draft_data as { photos: { path: string }[] } & Record<string, unknown>;
  const photos = d.photos.map((f) => ({ ...f, url: adm().storage.from("property-photos").getPublicUrl(f.path).data.publicUrl }));
  const { error: e2 } = await adm().from("properties").update({ draft_data: { ...d, photos } }).eq("id", id);
  if (e2) throw e2;
}

async function abrirRevisao(p: Page, id: string) {
  await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
}

const textosDestaques = (raiz: Locator) => raiz.getByTestId("destaques-imovel").locator("li").allInnerTexts();

test.describe("T707 — E262: galeria navegando e na prévia, destaques com os números do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    // (a) anúncio publicado com as 8 fotos reais (gravado antes de qualquer visita: a página pública guarda cache).
    ids.publico = await criarImovelPronto(ids.dono, `Studio galeria navega ${sufixo}`, { ativo: true });
    await fotosReais(ids.publico, ids.dono);
    for (const l of LARGURAS) {
      // (b) rascunho com 8 fotos reais no draft_data (o que a prévia lê).
      ids.previa[l] = await prepararRascunho(ids.dono, `Studio previa galeria ${l} ${sufixo}`);
      await fotosReaisNoRascunho(ids.previa[l]);
      // (c) o mesmo anúncio dos dois lados: no assistente (draft_data) e no banco (o que a página pública lê).
      ids.numeros[l] = await prepararRascunho(ids.dono, `Studio numeros ${l} ${sufixo}`, { internetMbps: "450", parkingSpots: "2", amenityKeys: {} }, 1);
      await adm().from("property_amenities").delete().eq("property_id", ids.numeros[l]);
      const { error } = await adm().from("properties").update({ internet_mbps: 450, parking_spots: 2, ready_to_live_badge: false, tag_home_office: false }).eq("id", ids.numeros[l]);
      expect(error).toBeNull();
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`(a) ${largura} px: abertura fria e "Próxima foto" — a foto 2 tem por baixo a mesma versão da miniatura dela`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: altura(largura) } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.publico}`, { waitUntil: "domcontentloaded" });
      const tile0 = quadro(p, 0);
      await carregada(tile0.locator("img").first(), 20_000);
      const imgTile1 = quadro(p, 1).locator("img").first();
      const [srcsetTile1, sizesTile1] = [await imgTile1.getAttribute("srcset"), await imgTile1.getAttribute("sizes")];
      expect(sizesTile1).toBe(SIZES_MINIATURA);
      await tile0.click();
      const lb = p.getByTestId("galeria-lightbox");
      await expect(lb.getByTestId("galeria-contador")).toHaveText("1 / 8");
      await lb.getByRole("button", { name: "Próxima foto" }).click();
      await expect(lb.getByTestId("galeria-contador")).toHaveText("2 / 8");
      const { foto, baixo, cima } = painel(p);
      await expect(foto).toBeVisible();
      // Por baixo: a MESMA versão do quadro 2 (mesmo srcset e sizes = mesma URL escolhida pelo navegador).
      await expect(baixo).toHaveAttribute("sizes", SIZES_MINIATURA);
      expect(await baixo.getAttribute("srcset")).toBe(srcsetTile1);
      if (largura === 1280) {
        // No mosaico o quadro 2 tem prioridade (já baixado): por baixo pinta na hora, com a mesma URL.
        await carregada(imgTile1, 20_000);
        const srcTile1 = await imgTile1.evaluate((i: HTMLImageElement) => i.currentSrc);
        await expect.poll(() => baixo.evaluate((i: HTMLImageElement) => i.currentSrc), { timeout: 5_000 }).toBe(srcTile1);
        await carregada(baixo, 1_500);
      }
      // Por cima: a grande da foto 2, pedida já e com prioridade alta.
      await expect(cima).toHaveAttribute("alt", /— foto 2$/);
      await expect(cima).toHaveAttribute("fetchpriority", "high");
      await expect(cima).not.toHaveAttribute("loading", "lazy");
      await p.screenshot({ path: `${SAIDA}/t707-galeria-proxima-${largura}.png` });

      if (largura === 1280) {
        // "+N mais": abre na 1ª foto oculta do mosaico, com a mesma camada da miniatura por baixo.
        await lb.getByRole("button", { name: "Fechar" }).click();
        await expect(lb).toHaveCount(0);
        await p.getByTestId("galeria-mais").click();
        await expect(lb.getByTestId("galeria-contador")).toHaveText("6 / 8");
        await expect(painel(p).baixo).toHaveAttribute("sizes", SIZES_MINIATURA);
        await expect(painel(p).cima).toHaveAttribute("alt", /— foto 6$/);
        await expect(painel(p).cima).toHaveAttribute("fetchpriority", "high");
      }
      await ctx.close();
    });
  }

  for (const largura of LARGURAS) {
    test(`(b) ${largura} px: "Ver no tamanho real" do Passo 10 — a galeria da prévia abre fria com a imagem da miniatura`, async ({ browser }) => {
      // entrar() abre um contexto novo: cache vazio.
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: altura(largura) });
      await abrirRevisao(p, ids.previa[largura]);
      await p.locator('[data-testid="previa-tamanho-real-abrir"]:visible').first().click();
      const previa = p.getByTestId("previa-tamanho-real");
      await expect(previa).toBeVisible();
      const tile0 = quadro(previa, 0);
      const imgTile0 = tile0.locator("img").first();
      await carregada(imgTile0, 20_000);
      const srcTile = await imgTile0.evaluate((i: HTMLImageElement) => i.currentSrc);
      await tile0.click();
      const { foto, baixo, cima } = painel(p);
      await expect(foto).toBeVisible();
      await expect.poll(() => baixo.evaluate((i: HTMLImageElement) => i.currentSrc), { timeout: 5_000 }).toBe(srcTile);
      await carregada(baixo, 1_500);
      await expect(cima).toHaveAttribute("fetchpriority", "high");
      await expect(cima).not.toHaveAttribute("loading", "lazy");
      await p.screenshot({ path: `${SAIDA}/t707-previa-galeria-fria-${largura}.png` });
      await p.context().close();
    });
  }

  for (const largura of LARGURAS) {
    test(`(c) ${largura} px: internet 450 Mbps e 2 vagas — os mesmos números nos destaques da prévia e da página pública`, async ({ browser }) => {
      const id = ids.numeros[largura];
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: altura(largura) });
      await abrirRevisao(p, id);
      await p.locator('[data-testid="previa-tamanho-real-abrir"]:visible').first().click();
      const previa = p.getByTestId("previa-tamanho-real");
      const dest = previa.getByTestId("destaques-imovel");
      await expect(dest).toBeVisible({ timeout: 15_000 });
      // Sem comodidade principal marcada: só o que o dono informou, com os números dele, nesta ordem.
      await expect(dest.locator("li")).toHaveCount(2);
      await expect(dest.locator("li").nth(0)).toContainText("Internet");
      await expect(dest.locator("li").nth(0)).toContainText("450 Mbps informados");
      await expect(dest.locator("li").nth(0)).not.toContainText("fibra");
      await expect(dest.locator("li").nth(1)).toContainText("2 vagas de garagem");
      const naPrevia = await textosDestaques(previa);
      await dest.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t707-previa-numeros-${largura}.png` });
      await p.getByTestId("previa-tamanho-real-fechar").click();

      // Publicado (o mesmo anúncio; 1ª visita a este id): a página pública com os mesmos números, na mesma ordem.
      const { error } = await adm().from("properties").update({ status: "active" }).eq("id", id);
      expect(error).toBeNull();
      await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const main = p.locator("main");
      await expect(main.getByTestId("destaques-imovel")).toBeVisible({ timeout: 20_000 });
      expect(await textosDestaques(main)).toEqual(naPrevia);
      await main.getByTestId("destaques-imovel").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t707-publica-numeros-${largura}.png` });
      await p.context().close();
    });
  }
});
