import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T722 — E285 (#1628), residuais que a t737 não olha. Pista C, bloco 76 (30/10). Visitante, 1280 e 390:
   1. "Todas": o topo (hero com as 3 fotos carregadas e o título) e a faixa de 3 selos de confiança cabem na largura,
      sem rolagem lateral; com DOIS parceiros publicados de categorias diferentes, TODO cartão da lista "Todas" traz o
      selo "Aprovado pela Viva" (a t737 confere um cartão, numa categoria).
   2. Categoria vazia com cidade: "Quero ser avisado" e "Indique um profissional" aparecem os dois, inteiros e dentro da
      largura, a 1280 lado a lado e a 390 um logo abaixo do outro (o desenho do E285 — a t737 já firma a ordem); nenhum
      dos dois é cortado nem empurra a página para o lado.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = [
  { email: `parc1.t722.${sufixo}@lab.vivanomads.test`, nome: "Lia Lavanderia", role: "owner" as const, categoria: "lavanderia" },
  { email: `parc2.t722.${sufixo}@lab.vivanomads.test`, nome: "Rui Reparos", role: "owner" as const, categoria: "manutencao" },
];
const ids: { contas: string[]; parceiros: string[] } = { contas: [], parceiros: [] };
const slug = (i: number) => `parceiro-t722-${i}-${sufixo}`;

async function visitante(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  return ctx.newPage();
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T722 — E285: Todas com hero, selos e selo em todo cartão; vazio com aviso e indicação inteiros a 390", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    for (const [i, c] of contas.entries()) {
      const id = await criarConta(c, senha);
      ids.contas.push(id);
      const { data, error } = await adm()
        .from("parceiros")
        .insert({ user_id: id, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `${c.nome} ${sufixo}`, slug: slug(i), categorias: [c.categoria], cidades: ["Uberlândia"], descricao_curta: "Atende imóvel mobiliado.", status: "publicado", publicado_em: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      ids.parceiros.push(data.id as string);
    }
  });
  test.afterAll(async () => {
    if (ids.parceiros.length) await adm().from("parceiros").delete().in("id", ids.parceiros);
    await apagarContas(ids.contas);
  });

  for (const largura of [1280, 390] as const) {
    test(`1. ${largura} px: Todas — hero e selos dentro da largura; todo cartão com "Aprovado pela Viva"`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      await p.goto("/parceiros/buscar?cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const topo = p.getByTestId("topo-todas");
      await expect(topo.locator("h1")).toHaveText("Encontre um parceiro", { timeout: 20_000 });
      const fotos = topo.locator("img");
      await expect(fotos).toHaveCount(3);
      for (let i = 0; i < 3; i++) await expect.poll(() => fotos.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      const selos = p.getByTestId("selos-confianca");
      await expect(selos.getByTestId("selo-confianca")).toHaveCount(3);
      const caixa = (await selos.boundingBox())!;
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura + 1);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);

      // Os dois parceiros semeados aparecem em "Todas", e cada cartão da lista tem o selo.
      for (let i = 0; i < contas.length; i++) await expect(p.locator(`[data-testid="cartao-parceiro"][data-slug="${slug(i)}"]`)).toHaveCount(1, { timeout: 20_000 });
      const cartoes = p.getByTestId("cartao-parceiro");
      const n = await cartoes.count();
      expect(n).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < n; i++) await expect(cartoes.nth(i).getByTestId("selo-aprovado"), `cartão ${i + 1} de ${n}`).toHaveText("Aprovado pela Viva");
      await p.screenshot({ path: `${SAIDA}/t722-todas-${largura}.png`, fullPage: largura === 390 });
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`2. ${largura} px: categoria vazia com cidade — aviso e indicação inteiros, dentro da largura`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      await p.goto("/parceiros/buscar?categoria=montagem&cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const vazia = p.getByTestId("busca-parceiros-vazia");
      await expect(vazia).toBeVisible({ timeout: 20_000 });
      const aviso = vazia.getByTestId("aviso-fotografo");
      const indique = vazia.getByTestId("indique-profissional");
      await expect(aviso).toContainText("Quero ser avisado");
      await expect(indique).toContainText("Indique um profissional");
      await expect(indique.getByRole("link", { name: "Abrir a página de parceiros" })).toHaveAttribute("href", "/parceiros?categoria=montagem#quero-ser-parceiro");
      for (const bloco of [aviso, indique]) {
        await bloco.scrollIntoViewIfNeeded();
        await expect(bloco).toBeVisible();
        const b = (await bloco.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(largura + 1);
        // Inteiro: nada do conteúdo vaza da própria caixa.
        expect(await bloco.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      }
      const a = (await aviso.boundingBox())!;
      const i = (await indique.boundingBox())!;
      if (largura === 1280) expect(Math.abs(a.y - i.y), "lado a lado a 1280").toBeLessThanOrEqual(2);
      else expect(i.y, "a 390, a indicação logo abaixo do aviso").toBeGreaterThanOrEqual(a.y + a.height - 1);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await vazia.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t722-vazia-${largura}.png`, fullPage: largura === 390 });
      await p.context().close();
    });
  }
});
