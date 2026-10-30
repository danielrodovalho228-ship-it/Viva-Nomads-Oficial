import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T713 — E277 (mockup aprovado em 30/10), busca de parceiros, a 1280 e 390, como visitante:
   1. com categoria e parceiro: o topo é a FOTO da categoria (banner, título "Encontre um parceiro: limpeza"); a faixa
      das categorias com foto (6, todas carregadas, mesmo tamanho; a atual marcada); o cartão do parceiro com foto no
      topo (16:10, carregada). Filtros iguais. Tocar noutra categoria da faixa mantém cidade e UF;
   2. sem parceiro: o estado vazio é um cartão com a foto da categoria (carregada), o texto de sempre, o aviso
      ("Quero ser avisado") e o "Indique um profissional", com os mesmos destinos.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const parceiro = { email: `parc.t713.${sufixo}@lab.vivanomads.test`, nome: "Lena Limpeza", role: "owner" as const };
const slug = `lena-limpeza-t713-${sufixo}`;
const ids: { conta?: string; parceiro?: string } = {};
const COM = "/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG";
const VAZIA = "/parceiros/buscar?categoria=montagem&cidade=Uberl%C3%A2ndia&uf=MG";

const carregada = (img: Locator) => expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
async function visitante(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  return ctx.newPage();
}

test.describe("T713 — E277: busca de parceiros com fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(parceiro, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Lena Limpeza ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Faxina de imóvel mobiliado, antes da entrada e na saída.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta]);
  });

  for (const largura of [1280, 390] as const) {
    test(`(1) ${largura} px: topo com a foto da categoria, faixa de categorias com foto e cartão com foto`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      await p.goto(COM, { waitUntil: "domcontentloaded" });
      const banner = p.getByTestId("banner-topo");
      await expect(banner.locator("h1")).toHaveText("Encontre um parceiro: limpeza");
      await carregada(banner.locator("img").first());
      await expect(p.getByTestId("busca-parceiros-filtros")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t713-topo-${largura}.png` });

      const faixa = p.getByTestId("faixa-categorias");
      const cartoes = faixa.locator("li a");
      await expect(cartoes).toHaveCount(6);
      const tamanhos = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const img = cartoes.nth(i).locator("img");
        await img.scrollIntoViewIfNeeded();
        await carregada(img);
        const b = (await img.boundingBox())!;
        tamanhos.add(`${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      expect(tamanhos.size, [...tamanhos].join(" ")).toBe(1);
      await expect(faixa.getByTestId("faixa-categoria-limpeza")).toHaveAttribute("aria-current", "page");

      const cartao = p.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`);
      await cartao.scrollIntoViewIfNeeded();
      const capa = cartao.getByTestId("cartao-parceiro-capa");
      await carregada(capa.locator("img").first());
      const c = (await capa.boundingBox())!;
      expect(Math.abs(c.width / c.height - 1.6)).toBeLessThan(0.03);
      await faixa.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t713-resultado-${largura}.png` });

      // Outra categoria pela faixa: mantém cidade e UF.
      await faixa.getByTestId("faixa-categoria-mudanca").click();
      await expect(p).toHaveURL(/categoria=mudanca/);
      const u = new URL(p.url());
      expect(u.searchParams.get("cidade")).toBe("Uberlândia");
      expect(u.searchParams.get("uf")).toBe("MG");
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`(2) ${largura} px: estado vazio com foto, aviso e "Indique um profissional"`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      await p.goto(VAZIA, { waitUntil: "domcontentloaded" });
      const vazia = p.getByTestId("busca-parceiros-vazia");
      await expect(vazia).toBeVisible({ timeout: 20_000 });
      await expect(vazia.getByTestId("busca-parceiros-vazia-texto")).toHaveText("Ainda não temos parceiro de montagem de móveis em Uberlândia.");
      await carregada(vazia.getByTestId("busca-parceiros-vazia-foto").locator("img"));
      // "Quero ser avisado" (visitante: entrar e voltar) e "Indique um profissional", com os destinos de sempre.
      await expect(vazia.getByTestId("aviso-fotografo")).toBeVisible();
      await expect(vazia.getByTestId("aviso-fotografo-entrar")).toHaveAttribute("href", /\/auth/);
      await expect(vazia.getByTestId("indique-profissional").getByRole("link")).toHaveAttribute("href", "/parceiros?categoria=montagem#quero-ser-parceiro");
      await vazia.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t713-vazia-${largura}.png` });
      await p.context().close();
    });
  }
});
