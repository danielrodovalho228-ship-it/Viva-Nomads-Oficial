import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T737 — E285 (conferência do Muse contra a folha aprovada, Tela 2, 30/10), busca de parceiros como visitante, a 1280 e
  390:
   1. "Todas" também abre com foto (mosaico de três categorias, fotos carregadas) e com a faixa de selos de confiança;
   2. o cartão do parceiro traz o selo "Aprovado pela Viva";
   3. o estado vazio traz "Quero ser avisado" AO LADO de "Indique um profissional" — com cidade (o aviso de sempre, mesmo
      "Entrar" para visitante) e sem cidade (pede a cidade no formulário acima).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `parc.t737.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "owner" as const };
const slug = `lia-limpeza-t737-${sufixo}`;
const ids: { conta?: string; parceiro?: string } = {};

const carregada = (img: Locator) => expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
async function visitante(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  return ctx.newPage();
}

test.describe("T737 — E285: busca de parceiros — Todas com foto e selos; vazio com aviso ao lado do Indique", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Lia Limpeza ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Faxina de imóvel mobiliado.", status: "publicado", publicado_em: new Date().toISOString() })
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
    test(`(1)(2) ${largura} px: Todas com foto no topo e selos; cartão com "Aprovado pela Viva"`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      await p.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      const topo = p.getByTestId("topo-todas");
      await expect(topo.locator("h1")).toHaveText("Encontre um parceiro");
      const fotos = topo.locator("img");
      await expect(fotos).toHaveCount(3);
      for (let i = 0; i < 3; i++) await carregada(fotos.nth(i));
      await expect(p.getByTestId("selos-confianca").getByTestId("selo-confianca")).toHaveCount(3);
      await p.screenshot({ path: `${SAIDA}/t737-todas-${largura}.png` });

      await p.goto("/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const cartao = p.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`);
      await cartao.scrollIntoViewIfNeeded();
      await expect(cartao.getByTestId("selo-aprovado")).toHaveText("Aprovado pela Viva");
      await p.screenshot({ path: `${SAIDA}/t737-cartao-${largura}.png` });
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`(3) ${largura} px: vazio com "Quero ser avisado" ao lado de "Indique um profissional"`, async ({ browser }) => {
      const p = await visitante(browser, largura);
      // Com cidade: o aviso de sempre (visitante: entrar e voltar).
      await p.goto("/parceiros/buscar?categoria=montagem&cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const vazia = p.getByTestId("busca-parceiros-vazia");
      await expect(vazia).toBeVisible({ timeout: 20_000 });
      const aviso = vazia.getByTestId("aviso-fotografo");
      const indique = vazia.getByTestId("indique-profissional");
      await expect(aviso).toContainText("Quero ser avisado");
      await expect(aviso.getByTestId("aviso-fotografo-entrar")).toHaveAttribute("href", /\/auth/);
      await expect(indique).toContainText("Indique um profissional");
      const a = (await aviso.boundingBox())!;
      const b = (await indique.boundingBox())!;
      if (largura === 1280) expect(Math.abs(a.y - b.y), "lado a lado").toBeLessThanOrEqual(2);
      else expect(b.y, "no celular, um embaixo do outro").toBeGreaterThan(a.y);
      await vazia.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t737-vazia-${largura}.png` });

      // Sem cidade: o aviso continua, pedindo a cidade no formulário.
      await p.goto("/parceiros/buscar?categoria=montagem", { waitUntil: "domcontentloaded" });
      const semCidade = p.getByTestId("busca-parceiros-vazia").getByTestId("aviso-fotografo");
      await expect(semCidade).toContainText("Quero ser avisado");
      await expect(semCidade.getByTestId("aviso-informar-cidade")).toHaveAttribute("href", "#bp-cidade");
      await expect(p.getByTestId("busca-parceiros-vazia").getByTestId("indique-profissional")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t737-vazia-sem-cidade-${largura}.png` });
      await p.context().close();
    });
  }
});
