import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T711 — E276 (pedido do Daniel, 30/10), na HOME DO MORADOR, a 1280 e 390: a seção "Serviços" deixa de ser seis
  botões só de texto. Cada serviço (Fotografia, Mudança, Limpeza, Lavanderia, Montagem de móveis, Manutenção) é um
  cartão com a foto da categoria — carregada de verdade (complete + naturalWidth), todas do MESMO tamanho e
  proporção 16:10 — com o nome e uma frase curta; grade par (2 colunas no celular, 3 no computador). O destino de cada cartão é o mesmo
  de antes: /parceiros/buscar?categoria=<x>&cidade=<cidade do perfil>. Embaixo, a faixa "Como funciona" em 3 passos.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t711.${sufixo}@lab.vivanomads.test`, nome: "Sara Serviços", role: "tenant" as const };
const ids: { morador?: string } = {};
const CIDADE = "Uberlândia";
const SERVICOS = [
  ["fotografia", "Fotografia"],
  ["mudanca", "Mudança"],
  ["limpeza", "Limpeza"],
  ["lavanderia", "Lavanderia"],
  ["montagem", "Montagem de móveis"],
  ["manutencao", "Manutenção"],
] as const;

test.describe("T711 — E276: serviços do painel do morador com foto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    const { error } = await adm().from("profiles").update({ cidade: CIDADE }).eq("id", ids.morador);
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: 6 cartões com foto carregada, mesmo tamanho, grade par, destinos iguais`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("painel-servicos-parceiros");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      await painel.scrollIntoViewIfNeeded();

      const caixas: { w: number; h: number; x: number; y: number }[] = [];
      for (const [valor, rotulo] of SERVICOS) {
        const cartao = painel.getByTestId(`servicos-${valor}`);
        await expect(cartao).toContainText(rotulo);
        // O destino não mudou.
        const href = await cartao.getAttribute("href");
        const u = new URL(href!, "http://x");
        expect(u.pathname).toBe("/parceiros/buscar");
        expect(u.searchParams.get("categoria")).toBe(valor);
        expect(u.searchParams.get("cidade")).toBe(CIDADE);
        // Foto carregada de verdade.
        const img = cartao.locator("img");
        await expect(img).toHaveCount(1);
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 15_000, message: `foto de ${rotulo}` }).toBe(true);
        expect(await img.getAttribute("alt")).toBeTruthy();
        const b = (await cartao.getByTestId("servicos-foto").boundingBox())!;
        caixas.push({ w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) });
      }
      // Mesmo tamanho e proporção 16:10 em todos.
      expect(new Set(caixas.map((c) => `${c.w}x${c.h}`)).size, JSON.stringify(caixas)).toBe(1);
      expect(Math.abs(caixas[0].w / caixas[0].h - 16 / 10)).toBeLessThan(0.03);
      // Nome + frase curta em cada cartão; faixa "Como funciona" com 3 passos.
      await expect(painel.getByTestId("servicos-frase")).toHaveCount(6);
      await expect(painel.getByTestId("servicos-como-funciona").getByTestId("servicos-passo")).toHaveCount(3);
      // Grade par: 2 colunas no celular, 3 no computador.
      expect(new Set(caixas.map((c) => c.x)).size).toBe(largura === 390 ? 2 : 3);
      // Fotos distintas entre si.
      const srcs = await painel.locator("img").evaluateAll((is) => is.map((i) => (i as HTMLImageElement).currentSrc));
      expect(new Set(srcs).size).toBe(6);

      await painel.screenshot({ path: `${SAIDA}/t711-servicos-${largura}.png` });
      // O clique leva à busca de parceiros da categoria.
      await painel.getByTestId("servicos-limpeza").click();
      await expect(p).toHaveURL(/\/parceiros\/buscar\?categoria=limpeza&cidade=Uberl/, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
