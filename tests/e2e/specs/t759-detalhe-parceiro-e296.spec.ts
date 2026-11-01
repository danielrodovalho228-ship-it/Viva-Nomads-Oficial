import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T759 — bloco parceiro do Muse (31/10): detalhe do parceiro, a 390 e a 1280.
   E296: o nome (h1) inteiro, visível e ABAIXO da capa (não cortado nem coberto); o avatar inteiro, sobre a capa.
   E298: a capa nunca vazia — parceiro sem capa e sem foto mostra a foto da categoria.
   E299: selo "Aprovado pela Viva" e as seções "Sobre" e "Galeria" (com a linha honesta quando vazias).
   E300: avatar sem foto mostra as iniciais certas — nunca o "[" do prefixo "[TESTE QA]".
*/
test.use({ storageState: { cookies: [], origins: [] } });

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: { conta?: string; parceiro?: string } = {};
const slug = `limpeza-t759-${sufixo}`;
const nome = `[TESTE QA] Limpeza T759 ${sufixo}`;

test.describe("T759 — detalhe do parceiro: nome legível, capa, selo, seções e iniciais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta({ email: `limp.t759.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "owner" }, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pagina-parceiro")).toBeVisible({ timeout: 30_000 });

      // E298: capa com a foto da categoria (o parceiro não enviou capa nem foto).
      const capa = page.getByTestId("parceiro-capa");
      await expect(capa).toHaveAttribute("data-origem", "categoria");
      await expect(page.getByTestId("parceiro-banner")).toBeVisible();

      // E296: o nome é o elemento de cima no seu centro (nada o cobre) e começa abaixo da capa.
      const h1 = page.getByTestId("parceiro-nome");
      await expect(h1).toHaveText(nome);
      const medidas = await page.evaluate(() => {
        const h = document.querySelector('[data-testid="parceiro-nome"]')!.getBoundingClientRect();
        const c = document.querySelector('[data-testid="parceiro-capa"]')!.getBoundingClientRect();
        const a = document.querySelector('[data-testid="parceiro-avatar"]')!.getBoundingClientRect();
        const noTopo = (r: DOMRect, el: string) => {
          const t = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
          return !!t && !!document.querySelector(el)?.contains(t);
        };
        return { nomeAbaixoDaCapa: h.top >= c.bottom - 1, nomeVisivel: noTopo(h, '[data-testid="parceiro-nome"]'), avatarInteiro: noTopo(new DOMRect(a.left, a.top + 4, a.width, 8), '[data-testid="parceiro-avatar"]') };
      });
      expect(medidas).toEqual({ nomeAbaixoDaCapa: true, nomeVisivel: true, avatarInteiro: true });

      // E300: iniciais certas.
      await expect(page.getByTestId("parceiro-avatar")).toHaveText("LT");

      // E299: selo e seções.
      await expect(page.getByTestId("selo-aprovado")).toHaveText(/Aprovado pela Viva/);
      await expect(page.getByTestId("parceiro-sobre")).toContainText("ainda não escreveu sobre o trabalho");
      await expect(page.getByTestId("parceiro-galeria-secao")).toContainText("Ainda sem fotos de trabalhos.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `tests/laboratorio/saida/t759-detalhe-parceiro-${largura}.png` });

      // E300 também no cartão da busca.
      await page.goto("/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const cartao = page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`);
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      // O nome público tem "[" (é o nome de teste); o avatar não.
      await expect(cartao.getByTestId("cartao-parceiro-iniciais")).toHaveText("LT");
    });
  }
});
