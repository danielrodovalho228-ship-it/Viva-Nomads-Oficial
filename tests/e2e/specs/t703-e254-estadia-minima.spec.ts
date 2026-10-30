import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T703 — E254-A (decisão do coordenador, 30/10): o total da estadia mínima tem UMA fonte e a conta aberta. Prévia do
  Passo 10, cartão de Meus anúncios e página pública mostram o MESMO total e a MESMA conta
  ("3 × R$ X + limpeza de preparação R$ 450"); a limpeza entra no total do período, discriminada, nunca no "Total por
  mês". A limpeza do teste é a de preparação (R$ 450, a do assistente); a de saída segue a mesma regra (teste unitário).
   1. mínimo de 3 meses + limpeza R$ 450 → os três lugares iguais (1280 e 390);
   2. mínimo de 1 mês → o cartão de Meus anúncios não mostra a linha da estadia;
   3. sem limpeza → a conta não menciona limpeza.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t703.${sufixo}@lab.vivanomads.test`, nome: "Tina Total", role: "owner" as const };
const ids: { dono?: string; tres?: string; um?: string; semLimpeza?: string } = {};
const LARGURAS = [1280, 390] as const;

async function ajustar(id: string, campos: Record<string, unknown>) {
  const { error } = await adm().from("properties").update(campos).eq("id", id);
  expect(error).toBeNull();
}

/** "R$ 10.800,00" ou "R$ 10.800" → 10800 */
const reais = (t: string) => Number((t.match(/R\$\s?([\d.]+(?:,\d{2})?)/)?.[1] ?? "").replace(/\./g, "").replace(",", "."));

/** O mesmo anúncio no rascunho (draft_data, que o assistente lê) e no banco (que o cartão e a página leem). */
const PRECO = { mensal: 3000, condominio: 450, limpeza: 450 };
async function rascunhoComPreco(donoId: string, titulo: string, minDias: number, limpeza: number): Promise<string> {
  const id = await prepararRascunho(donoId, titulo, {
    monthlyPrice: String(PRECO.mensal), condoFee: String(PRECO.condominio), minPeriod: String(minDias), prepFee: limpeza,
    utilitiesMode: "real", utilitiesEstimate: 0,
  });
  await ajustar(id, {
    monthly_price: PRECO.mensal, condo_fee: PRECO.condominio, min_period_days: minDias, prep_fee: limpeza,
    utilities_mode: "real", utilities_estimate: 0, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0,
  });
  return id;
}

async function lerPrevia(p: Page) {
  const linha = p.getByTestId("previa-preco-estadia-minima");
  await expect(linha).toContainText("Estadia mínima (3 meses)", { timeout: 30_000 });
  return { total: reais(await linha.innerText()), conta: (await p.getByTestId("previa-conta-estadia").innerText()).trim() };
}

test.describe("T703 — E254-A: total da estadia mínima, uma fonte e a conta aberta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.tres = await rascunhoComPreco(ids.dono, `Studio três meses ${sufixo}`, 90, PRECO.limpeza);
    ids.um = await criarImovelPronto(ids.dono, `Studio um mês ${sufixo}`, { ativo: true });
    await ajustar(ids.um, { min_period_days: 30, checkout_cleaning_enabled: true, checkout_cleaning_fee: 450 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  test("1. mínimo de 3 meses + limpeza R$ 450: prévia, Meus anúncios e página pública com o mesmo total e a mesma conta", async ({ browser }) => {
    // Prévia do Passo 10 (rascunho).
    let ref: { total: number; conta: string } | null = null;
    for (const largura of LARGURAS) {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.tres}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
      if (largura === 390) await p.getByTestId("previa-recolhida").click();
      const previa = await lerPrevia(p);
      expect(previa.conta).toMatch(/^3 × R\$\s?[\d.]+(,\d{2})? \+ limpeza de preparação R\$\s?450(,00)?$/);
      // A limpeza nunca entra no Total por mês: total do período = 3 × total do mês + os únicos da conta.
      const mes = reais(await p.getByTestId("previa-preco-total-mes").innerText());
      const unicos = [...previa.conta.matchAll(/\+ [^R]*R\$\s?([\d.]+(?:,\d{2})?)/g)].reduce((s, m) => s + reais(`R$ ${m[1]}`), 0);
      expect(previa.total).toBeCloseTo(3 * mes + unicos, 2);
      if (ref) expect(previa).toEqual(ref);
      ref = previa;
      await p.getByTestId("previa-precos").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t703-previa-${largura}.png` });
      await p.context().close();
    }

    // Publicado: Meus anúncios e a página pública.
    await ajustar(ids.tres!, { status: "active" });
    for (const largura of LARGURAS) {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("preco-contexto").filter({ hasText: /Estadia mínima \(3 meses\)/ });
      await expect(cartao).toHaveCount(1, { timeout: 30_000 });
      await expect(cartao).toContainText(`Estadia mínima (3 meses):`);
      const linhaCartao = await cartao.innerText();
      expect(reais(linhaCartao.slice(linhaCartao.indexOf("Estadia mínima")))).toBe(ref!.total);
      expect(linhaCartao).toContain(ref!.conta);
      await cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t703-meus-anuncios-${largura}.png` });

      await p.goto(`/imoveis/${ids.tres}`, { waitUntil: "domcontentloaded" });
      const lateral = p.locator("#cartao-preco");
      await expect(lateral.getByTestId("cartao-lateral-estadia")).toContainText("em 3 meses", { timeout: 20_000 });
      expect(reais(await lateral.getByTestId("cartao-lateral-estadia").innerText())).toBe(ref!.total);
      await expect(lateral.getByTestId("cartao-lateral-estadia-conta")).toHaveText(ref!.conta);
      if (largura === 390) expect(reais(await p.getByTestId("barra-total-estadia").innerText())).toBe(ref!.total);
      await lateral.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t703-publica-${largura}.png` });
      await p.context().close();
    }
  });

  test("2. mínimo de 1 mês: o cartão de Meus anúncios não mostra a linha da estadia", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("preco-contexto").filter({ hasText: /Estadia mínima \(3 meses\)/ })).toHaveCount(1, { timeout: 30_000 });
    await expect(p.getByText(/Estadia mínima \(1 mês\)/)).toHaveCount(0);
    await p.context().close();
  });

  test("3. sem limpeza: a conta não menciona limpeza", async ({ browser }) => {
    ids.semLimpeza = await rascunhoComPreco(ids.dono!, `Studio sem limpeza ${sufixo}`, 90, 0);
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.semLimpeza}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
    const previa = await lerPrevia(p);
    expect(previa.conta).toMatch(/^3 × R\$/);
    expect(previa.conta).not.toMatch(/limpeza/i);
    await p.context().close();
  });
});
