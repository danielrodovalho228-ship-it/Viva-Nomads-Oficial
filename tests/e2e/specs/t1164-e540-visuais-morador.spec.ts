import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1164 — E540 (#2637, 05/11): (a) na busca de parceiros, "1 parceiro em Uberlândia" é UMA frase (um nó de texto só —
 * em nós separados, quem lê nó a nó colava as palavras); (b) Conta › Pagamentos do morador mostra a foto PRÓPRIA de
 * pagamentos (/images/unicas/cf-pagamentos.webp), não o placeholder de imóvel. O E540 entrou só com teste de unidade;
 * aqui é a tela, 390 e 1280:
 *   1. /parceiros/buscar com cidade: a contagem é um nó de texto único "N parceiro(s) em <cidade>";
 *   2. Conta › Pagamentos (moradora): o cartão conta-pag-morador usa cf-pagamentos, a foto CARREGA (naturalWidth > 0) e
 *      nenhum placeholder-imovel-sala aparece;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Parceirópolis ${sufixo}`;
const morador = { email: `inq.t1164.${sufixo}@lab.vivanomads.test`, nome: "Rosa Pagamentos", role: "tenant" as const };
const parceira = { email: `par.t1164.${sufixo}@lab.vivanomads.test`, nome: "Nina Parceira", role: "owner" as const };
const ids: { morador?: string; parceira?: string; parceiro?: string } = {};

test.describe("T1164 — E540: frase única na busca de parceiros e a foto própria de pagamentos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.parceira = await criarConta(parceira, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.parceira, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `[TESTE QA] Nina Limpeza T1164 ${sufixo}`, slug: `nina-t1164-${sufixo}`, categorias: ["limpeza"], cidades: [CIDADE], descricao_curta: "Parceira de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    ids.parceiro = data!.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.morador, ids.parceira]);
  });

  for (const w of [390, 1280] as const) {
    test(`a contagem da busca é uma frase só; a foto de pagamentos carrega (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const pub = await ctx.newPage();
        await pub.goto(`/parceiros/buscar?cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
        const resultado = pub.getByTestId("busca-parceiros-resultado");
        await expect(resultado).toHaveAttribute("data-total", /^[1-9]\d*$/, { timeout: 30_000 });
        const frase = await resultado.evaluate((el, cidade) => {
          const alvo = new RegExp(`^\\d+ parceiros? em ${cidade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) if (alvo.test((n.textContent ?? "").trim())) return (n.textContent ?? "").trim();
          return null;
        }, CIDADE);
        expect(frase, "um nó de texto com a frase inteira").toBe(`1 parceiro em ${CIDADE}`);
        expect(await pub.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await pub.close();

        const p = await entrarNaPagina(await ctx.newPage(), morador.email, senha);
        await p.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
        const cartao = p.getByTestId("conta-pag-morador");
        await expect(cartao).toBeVisible({ timeout: 30_000 });
        const img = cartao.getByTestId("cartao-foto").locator("img").first();
        await expect(img).toHaveAttribute("src", /cf-pagamentos/);
        await expect.poll(() => img.evaluate((e: HTMLImageElement) => (e.complete ? e.naturalWidth : 0)), { timeout: 15_000, message: "a foto de pagamentos carregou" }).toBeGreaterThan(0);
        expect(await p.locator('img[src*="placeholder-imovel-sala"]').count()).toBe(0);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
