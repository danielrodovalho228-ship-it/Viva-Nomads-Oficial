import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TAXA_PARCERIA_TEXTO } from "../../../src/lib/atendimento/parceiros-texto";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T44 — PARCEIROS (laboratório, ordem 225d0648; refeito no Prompt 31a).
 *  1. /parceiros: "Seja parceiro" pede conta com e-mail confirmado (o formulário de interesse saiu).
 *  2. Prompt 14: 6 cartões com foto, grade 3 + 3 no computador.
 *  3. Busca de fotógrafos por cidade: só parceiros PUBLICADOS, só da cidade buscada (Uberlândia ≠ Belém).
 *  4. O visitante não lê a tabela parceiros (documento, recebimento, telefone): só a view pública.
 *  5. Taxa de serviço de 10% para todas as categorias nos textos oficiais.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = {
  udi: { email: `udi.parc.${sufixo}@lab.vivanomads.test`, nome: `Foto Udi ${sufixo}`, role: "tenant" as const },
  belem: { email: `belem.parc.${sufixo}@lab.vivanomads.test`, nome: `Foto Belem ${sufixo}`, role: "tenant" as const },
  rasc: { email: `rasc.parc.${sufixo}@lab.vivanomads.test`, nome: `Foto Rascunho ${sufixo}`, role: "tenant" as const },
};
const ids: Record<string, string> = {};

async function novoParceiro(chave: keyof typeof contas, cidades: string[], status: "publicado" | "rascunho"): Promise<void> {
  const c = contas[chave];
  const uid = await criarConta(c, senha);
  ids[chave] = uid;
  const { error } = await adm()
    .from("parceiros")
    .insert({ user_id: uid, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: c.nome, slug: `t44-${chave}-${sufixo}`, categorias: ["fotografia"], cidades, status, publicado_em: status === "publicado" ? new Date().toISOString() : null, telefone: "34999991234" });
  if (error) throw error;
}

test.describe("T44 — Parceiros", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    await novoParceiro("udi", ["Uberlândia"], "publicado");
    await novoParceiro("belem", ["Belém"], "publicado");
    await novoParceiro("rasc", ["Uberlândia"], "rascunho");
  });

  test.afterAll(async () => {
    await adm().from("parceiros").delete().in("user_id", Object.values(ids));
    await apagarContas(Object.values(ids));
  });

  test("/parceiros: 'Seja parceiro' pede conta com e-mail confirmado", async ({ page }) => {
    await page.goto("/parceiros?categoria=mudanca#quero-ser-parceiro", { waitUntil: "networkidle" });
    await expect(page.getByTestId("seja-parceiro-precisa-conta")).toBeVisible();
    await expect(page.getByTestId("sp-cat-mudanca")).toBeChecked(); // categoria vinda do cartão
    await page.getByTestId("seja-parceiro-enviar").click();
    await page.waitForURL(/\/auth\?cadastro=1/, { timeout: 15_000 });
  });

  for (const largura of [390, 1280]) {
    test(`prompt 14: 6 cartões com foto carregada, grade ${largura === 1280 ? "3 + 3" : "em 1 coluna"} e sem rolagem lateral (${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/parceiros", { waitUntil: "networkidle" });
      const lista = page.getByTestId("parceiros-tipos");
      const cartoes = lista.locator(":scope > li");
      await expect(cartoes).toHaveCount(6);
      await expect(page.getByTestId("parceiros-foto-pendente")).toHaveCount(0);
      await lista.scrollIntoViewIfNeeded();
      for (let i = 0; i < 6; i++) {
        const img = cartoes.nth(i).locator("img").first();
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      const tops = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      const linhas = new Set(tops).size;
      expect(linhas).toBe(largura === 1280 ? 2 : 6);
      await expect(page.getByTestId("parceiros-numeros").locator(":scope > div")).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await lista.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t44-parceiros-cartoes-${largura}.png`, fullPage: false });
    });
  }

  test("busca por cidade: só publicados da cidade buscada", async ({ page }) => {
    await page.goto("/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "networkidle" });
    await expect(page.getByText(contas.udi.nome)).toBeVisible();
    await expect(page.getByText(contas.belem.nome)).toHaveCount(0);
    await expect(page.getByText(contas.rasc.nome)).toHaveCount(0); // rascunho não aparece

    await page.goto("/parceiros/fotografos?cidade=Bel%C3%A9m&uf=PA", { waitUntil: "networkidle" });
    await expect(page.getByText(contas.belem.nome)).toBeVisible();
    await expect(page.getByText(contas.udi.nome)).toHaveCount(0);
  });

  test("visitante: a tabela parceiros é fechada; a view pública não tem documento nem telefone", async () => {
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const tabela = await anon.from("parceiros").select("documento, telefone");
    expect(tabela.data ?? []).toHaveLength(0);
    const vitrine = await anon.from("parceiros_publicos").select("*").like("nome_publico", `%${sufixo}`);
    expect((vitrine.data ?? []).map((f) => f.nome_publico).sort()).toEqual([contas.belem.nome, contas.udi.nome].sort());
    for (const linha of vitrine.data ?? []) {
      for (const k of ["documento", "telefone", "cep_base", "dados_recebimento", "user_id"]) expect(Object.keys(linha)).not.toContain(k);
    }
  });

  test("taxa de serviço nos textos oficiais: 10% para todas as categorias, sem a taxa fixa por faixa de fotos", () => {
    expect(TAXA_PARCERIA_TEXTO).toMatch(/Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias\./);
    expect(TAXA_PARCERIA_TEXTO).toMatch(/90% direto ao parceiro e 10% à Viva/);
    expect(TAXA_PARCERIA_TEXTO).toMatch(/A Viva não guarda o dinheiro/);
    expect(TAXA_PARCERIA_TEXTO).not.toMatch(/R\$ ?(40|60|80)(?![\d.,])/);
  });
});
