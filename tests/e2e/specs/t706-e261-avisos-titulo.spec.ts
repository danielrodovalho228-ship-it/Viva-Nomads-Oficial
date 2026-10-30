import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T706 — E261 (#1597), o que a t701 não grava nem lê de volta. Pista C, 30/10. Nas duas larguras (1280 e 390).
   1. Os avisos acompanham os quartos GRAVADOS: num studio de 1 quarto no Centro, "Casa com 3 quartos no Tibery…" dá os
      três avisos (bairro, tipo, quartos); "Salvar seção" grava o título. Na seção "Detalhes & preço", Quartos = 3 tira
      o aviso dos quartos na hora (os outros dois ficam) e o salvar grava bedrooms = 3. O editor reaberto lê título e
      quartos do banco: os mesmos dois avisos, sem o dos quartos. O anúncio público mostra o título novo e "3 quartos".
   2. O tipo gravado no banco como "Chácara" (com caixa e acento, anúncio antigo): "Sítio com piscina…" não avisa nada;
      "Casa de campo…" avisa "o tipo do anúncio é chácara/sítio" e grava mesmo assim (status segue ativo); reaberto, o
      aviso volta a partir do que está no banco.
   3. Um bloco só (Passo 7 e editor): o mesmo título no Passo 7 do assistante, num rascunho de studio de 1 quarto no
      Centro, mostra exatamente os mesmos avisos do editor, e o título digitado vai para o rascunho do banco.
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [1280, 390] as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t706.${sufixo}@lab.vivanomads.test`, nome: "Tito Titulo", role: "owner" as const };
const ids: { dono?: string; studio: Record<number, string>; chacara: Record<number, string>; rascunho: Record<number, string> } = { studio: {}, chacara: {}, rascunho: {} };
const tituloCasa = (w: number) => `Casa com 3 quartos no Tibery ${w} ${sufixo}`;

const AVISO_BAIRRO = "O título cita Tibery, mas o bairro cadastrado é Centro. Confira se está certo (você pode manter).";
const AVISO_TIPO = "O título diz casa, mas o tipo do anúncio é studio/kitnet. Confira se está certo (você pode manter).";
const AVISO_QUARTOS = "O título diz 3 quartos, mas o anúncio tem 1 quarto. Confira se está certo (você pode manter).";
const AVISO_CHACARA = "O título diz casa, mas o tipo do anúncio é chácara/sítio. Confira se está certo (você pode manter).";

/** Os avisos à vista, um por linha, na ordem da tela. */
const avisosDe = (bloco: Locator) => bloco.locator("p").allInnerTexts();

async function abrirEditor(browser: import("@playwright/test").Browser, id: string, w: number): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
  return p;
}

/** Abre (se fechada) a seção do editor pelo título do botão e devolve a seção. */
async function abrirSecao(p: Page, nome: RegExp): Promise<Locator> {
  const botao = p.getByRole("button", { name: nome });
  const secao = p.locator("section").filter({ has: botao });
  await expect(botao).toBeVisible({ timeout: 30_000 });
  if ((await secao.getAttribute("data-aberta")) !== "true") await botao.click();
  await expect(secao).toHaveAttribute("data-aberta", "true");
  return secao;
}

const lerImovel = async (id: string) =>
  (await adm().from("properties").select("title, bedrooms, status").eq("id", id).single()).data as { title: string; bedrooms: number; status: string } | null;

test.describe("T706 — E261: avisos do título no editor, gravados e lidos de volta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of LARGURAS) {
      // Studio de 1 quarto no Centro (criarImovelPronto grava o bairro em `address`).
      ids.studio[w] = await criarImovelPronto(ids.dono, `Studio mobiliado ${w} ${sufixo}`, { ativo: true });
      // Anúncio antigo com o tipo gravado com caixa e acento.
      ids.chacara[w] = await criarImovelPronto(ids.dono, `Sítio com piscina ${w} ${sufixo}`, { ativo: true });
      const { error } = await adm().from("properties").update({ property_type: "Chácara" }).eq("id", ids.chacara[w]);
      if (error) throw error;
      ids.rascunho[w] = await prepararRascunho(ids.dono, `Studio mobiliado rascunho ${w} ${sufixo}`, {
        description: "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.",
        bedrooms: "1",
        bathrooms: "1",
        areaM2: "40",
        neighborhood: "Centro",
        street: "Rua Santos Dumont",
        numero: "100",
      });
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of LARGURAS) {
    test(`1. ${w} px — os avisos seguem os quartos gravados; título e quartos voltam do banco e chegam ao anúncio`, async ({ browser }) => {
      const id = ids.studio[w];
      let p = await abrirEditor(browser, id, w);
      let secao = await abrirSecao(p, /Título & descrição/);
      const campo = () => secao.getByPlaceholder(/Studio mobiliado com home office/);
      await expect(campo()).toHaveValue(`Studio mobiliado ${w} ${sufixo}`, { timeout: 20_000 });
      await campo().fill(tituloCasa(w));
      let avisos = secao.getByTestId("aviso-titulo-consistencia");
      await expect.poll(() => avisosDe(avisos), { timeout: 10_000 }).toEqual([AVISO_BAIRRO, AVISO_TIPO, AVISO_QUARTOS]);
      await expect(avisos.getByTestId("aviso-titulo-bairro")).toHaveText(AVISO_BAIRRO);
      await secao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await lerImovel(id))?.title, { timeout: 20_000 }).toBe(tituloCasa(w));

      // Quartos = 3 em "Detalhes & preço": o aviso dos quartos sai na hora (o título não mudou).
      const detalhes = await abrirSecao(p, /Detalhes & preço/);
      await detalhes.getByLabel("Quartos", { exact: true }).fill("3");
      await expect.poll(() => avisosDe(avisos), { timeout: 10_000 }).toEqual([AVISO_BAIRRO, AVISO_TIPO]);
      await detalhes.getByRole("button", { name: "Salvar seção" }).click();
      await expect(detalhes.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => lerImovel(id), { timeout: 20_000 }).toEqual({ title: tituloCasa(w), bedrooms: 3, status: "active" });
      await p.context().close();

      // Reaberto: título e quartos lidos do banco → os dois avisos, sem o dos quartos.
      p = await abrirEditor(browser, id, w);
      secao = await abrirSecao(p, /Título & descrição/);
      await expect(campo()).toHaveValue(tituloCasa(w), { timeout: 20_000 });
      avisos = secao.getByTestId("aviso-titulo-consistencia");
      await expect.poll(() => avisosDe(avisos), { timeout: 10_000 }).toEqual([AVISO_BAIRRO, AVISO_TIPO]);
      await avisos.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${SAIDA}/t706-1-editor-reaberto-${w}.png` });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.context().close();

      // O anúncio público (primeira visita, depois das gravações) lê o título e os quartos novos.
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const pub = await ctx.newPage();
      await pub.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(pub.getByRole("heading", { level: 1, name: tituloCasa(w) })).toBeVisible({ timeout: 30_000 });
      await expect(pub.getByTestId("imovel-sintese")).toContainText("3 quartos");
      await pub.screenshot({ path: `${SAIDA}/t706-1-anuncio-${w}.png` });
      await ctx.close();
    });
  }

  for (const w of LARGURAS) {
    test(`2. ${w} px — tipo "Chácara" gravado no banco: sem aviso falso; o aviso real grava e volta ao reabrir`, async ({ browser }) => {
      const id = ids.chacara[w];
      let p = await abrirEditor(browser, id, w);
      let secao = await abrirSecao(p, /Título & descrição/);
      const campo = () => secao.getByPlaceholder(/Studio mobiliado com home office/);
      await expect(campo()).toHaveValue(`Sítio com piscina ${w} ${sufixo}`, { timeout: 20_000 });
      await expect(secao.getByTestId("aviso-titulo-consistencia"), "sítio num anúncio de chácara: nada a conferir").toHaveCount(0);
      const novo = `Casa de campo com piscina ${w} ${sufixo}`;
      await campo().fill(novo);
      await expect(secao.getByTestId("aviso-titulo-consistencia")).toHaveText(AVISO_CHACARA);
      await secao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await adm().from("properties").select("title, status, property_type").eq("id", id).single()).data, { timeout: 20_000 }).toEqual({
        title: novo,
        status: "active",
        property_type: "Chácara",
      });
      await p.context().close();

      p = await abrirEditor(browser, id, w);
      secao = await abrirSecao(p, /Título & descrição/);
      await expect(campo()).toHaveValue(novo, { timeout: 20_000 });
      const avisos = secao.getByTestId("aviso-titulo-consistencia");
      await expect(avisos).toHaveText(AVISO_CHACARA);
      await avisos.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${SAIDA}/t706-2-chacara-${w}.png` });
      await p.context().close();
    });
  }

  for (const w of LARGURAS) {
    test(`3. ${w} px — o Passo 7 mostra os mesmos avisos do editor e o título vai para o rascunho`, async ({ browser }) => {
      const id = ids.rascunho[w];
      const p = await abrirPasso(browser, { email: dono.email, senha }, id, "descricao", w);
      const campo = p.getByTestId("cadastro-titulo");
      await expect(campo).toHaveValue(`Studio mobiliado rascunho ${w} ${sufixo}`, { timeout: 20_000 });
      await expect(p.getByTestId("aviso-titulo-consistencia"), "título coerente (tipo 'Studio' do rascunho): nada a conferir").toHaveCount(0);
      const novo = `Casa com 3 quartos no Tibery rascunho ${w} ${sufixo}`;
      await campo.fill(novo);
      const avisos = p.getByTestId("aviso-titulo-consistencia");
      await expect.poll(() => avisosDe(avisos), { timeout: 10_000 }).toEqual([AVISO_BAIRRO, AVISO_TIPO, AVISO_QUARTOS]);
      await expect(avisos.getByTestId("aviso-titulo-bairro")).toHaveText(AVISO_BAIRRO);
      await avisos.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${SAIDA}/t706-3-passo7-${w}.png` });
      // Aviso nunca trava: o rascunho grava o título novo.
      await expect
        .poll(async () => ((await adm().from("properties").select("draft_data").eq("id", id).single()).data?.draft_data as { title?: string } | null)?.title, { timeout: 30_000 })
        .toBe(novo);
      await p.context().close();
    });
  }
});
