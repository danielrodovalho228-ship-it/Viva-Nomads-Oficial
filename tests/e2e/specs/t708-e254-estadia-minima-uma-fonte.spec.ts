import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho, reais } from "../fixtures/rascunho-cadastro";

/*
  T708 — E254-A (PR #1601), o que a T703 não cobre: o total da estadia mínima é o MESMO número, com a MESMA conta aberta,
  em todo lugar que o mostra — e esse número é o que sai do que o dono informou (não só "os lugares batem entre si").
  Números diferentes da T703 (lá: 3 meses, R$ 3.000 + condomínio, só preparação):
   1. dono informa R$ 2.800 + condomínio R$ 380 + contas fixas R$ 220, mínimo de 120 dias, limpeza de preparação R$ 300
      → Total por mês R$ 3.400 e "Estadia mínima (4 meses)" R$ 13.900 = "4 × R$ 3.400 + limpeza de preparação R$ 300"
      na prévia do Passo 10 (1280 e 390); o "Ver no tamanho real" mostra o mesmo Total por mês e a preparação fora dele;
   2. o mesmo anúncio publicado: cartão de Meus anúncios, cartão de preço da página pública e (390) a barra fixa do
      celular com o mesmo total e a mesma conta; a preparação está em "Fora do total mensal" e não no Total por mês;
   3. anúncio publicado com DOIS pagamentos únicos (preparação R$ 300 + limpeza de saída R$ 250, configurada no editor) e
      mínimo de 150 dias: "5 × R$ 2.500 + limpeza de preparação R$ 300 + limpeza de saída R$ 250" = R$ 13.050 em Meus
      anúncios, no cartão público e na barra do celular; nenhuma das duas limpezas entra no Total por mês;
   4. (fixme — defeito relatado) o "Ver no tamanho real" do Passo 10 ("assim o morador vê") deveria mostrar no cartão o
      mesmo "R$ 13.900 em 4 meses" + a conta da página pública; hoje o PriceCard da prévia é chamado sem `meses` (= 1) e
      a linha não aparece.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t708.${sufixo}@lab.vivanomads.test`, nome: "Otto Uma Fonte", role: "owner" as const };
const ids: { dono?: string; quatro?: string; cinco?: string } = {};
const LARGURAS = [1280, 390] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);

/** O que o dono informa (caso 1/2): o total esperado sai daqui, não de outra tela. */
const QUATRO = { mensal: 2800, condominio: 380, contas: 220, dias: 120, preparacao: 300 };
const MES_QUATRO = QUATRO.mensal + QUATRO.condominio + QUATRO.contas; // 3400
const TOTAL_QUATRO = 4 * MES_QUATRO + QUATRO.preparacao; // 13900
/** Caso 3: publicado, com a limpeza de saída do editor. */
const CINCO = { mensal: 2500, dias: 150, preparacao: 300, saida: 250 };
const TOTAL_CINCO = 5 * CINCO.mensal + CINCO.preparacao + CINCO.saida; // 13050

const R = String.raw`R\$\s?`;
const CONTA_QUATRO = new RegExp(String.raw`^4 × ${R}3\.400(,00)? \+ limpeza de preparação ${R}300(,00)?$`);
const CONTA_CINCO = new RegExp(String.raw`^5 × ${R}2\.500(,00)? \+ limpeza de preparação ${R}300(,00)? \+ limpeza de saída ${R}250(,00)?$`);

async function ajustar(id: string, campos: Record<string, unknown>) {
  const { error } = await adm().from("properties").update(campos).eq("id", id);
  expect(error).toBeNull();
}

/** Soma dos pagamentos únicos discriminados na conta ("+ limpeza de … R$ X"). */
const unicosDaConta = (conta: string) => [...conta.matchAll(/\+ [^R]*(R\$\s?[\d.]+(?:,\d{2})?)/g)].reduce((s, m) => s + reais(m[1]), 0);

async function nova(browser: Parameters<typeof entrar>[0], largura: number): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: largura, height: altura(largura) });
  return p;
}

/** Cartão de Meus anúncios: o total e a conta da linha "Estadia mínima (N meses): R$ X · conta". */
async function linhaMeusAnuncios(p: Page, meses: number) {
  await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
  const cartao = p.getByTestId("preco-contexto").filter({ hasText: `Estadia mínima (${meses} meses)` });
  await expect(cartao).toHaveCount(1, { timeout: 30_000 });
  const texto = await cartao.innerText();
  const linha = texto.slice(texto.indexOf("Estadia mínima")).split("\n")[0].trim();
  const conta = linha.slice(linha.indexOf("·") + 1).trim();
  return { cartao, total: reais(linha), conta };
}

/** Cartão de preço da página pública + (390) barra fixa do celular. */
async function lerPublica(p: Page, meses: number, largura: number) {
  const lateral = p.locator("#cartao-preco");
  await expect(lateral.getByTestId("cartao-lateral-estadia")).toContainText(`em ${meses} meses`, { timeout: 20_000 });
  const total = reais(await lateral.getByTestId("cartao-lateral-estadia").innerText());
  const conta = (await lateral.getByTestId("cartao-lateral-estadia-conta").innerText()).trim();
  const mes = reais(await lateral.getByTestId("total-por-mes").innerText());
  let barra: { total: number; mes: number } | null = null;
  if (largura === 390) {
    const b = p.getByTestId("barra-fixa-imovel");
    await expect(b.getByTestId("barra-total-estadia")).toContainText(`em ${meses} meses`);
    barra = { total: reais(await b.getByTestId("barra-total-estadia").innerText()), mes: reais(await b.getByTestId("barra-preco-mes").innerText()) };
  }
  return { lateral, total, conta, mes, barra };
}

const taxa = (lateral: Locator, chave: string) => lateral.getByTestId("taxas-itemizadas").locator(`li[data-taxa="${chave}"]`);

test.describe("T708 — E254-A: o mesmo total da estadia mínima em todo lugar, com a conta aberta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    // Caso 1/2: o mesmo anúncio no assistente (draft_data) e no banco — gravado antes de qualquer visita à página pública.
    ids.quatro = await prepararRascunho(ids.dono, `Studio quatro meses ${sufixo}`, {
      monthlyPrice: String(QUATRO.mensal), condoFee: String(QUATRO.condominio), minPeriod: String(QUATRO.dias),
      utilitiesMode: "fixed", utilitiesEstimate: QUATRO.contas, prepFee: QUATRO.preparacao,
    });
    await ajustar(ids.quatro, {
      monthly_price: QUATRO.mensal, condo_fee: QUATRO.condominio, min_period_days: QUATRO.dias, utilities_mode: "fixed",
      utilities_estimate: QUATRO.contas, prep_fee: QUATRO.preparacao, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null,
    });
    // Caso 3: publicado, com a limpeza de saída (o editor a configura; não passa pelo assistente).
    ids.cinco = await criarImovelPronto(ids.dono, `Studio cinco meses ${sufixo}`, { ativo: true, preco: CINCO.mensal });
    await ajustar(ids.cinco, {
      monthly_price: CINCO.mensal, condo_fee: 0, utilities_mode: "real", utilities_estimate: 0, min_period_days: CINCO.dias,
      prep_fee: CINCO.preparacao, checkout_cleaning_enabled: true, checkout_cleaning_fee: CINCO.saida, limpeza_estadia: null,
    });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`1. ${largura} px: prévia do Passo 10 — R$ 13.900 = 4 × R$ 3.400 + preparação R$ 300; o tamanho real com o mesmo Total por mês`, async ({ browser }) => {
      const p = await nova(browser, largura);
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.quatro}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
      if (largura === 390) await p.getByTestId("previa-recolhida").click();
      const linha = p.getByTestId("previa-preco-estadia-minima");
      await expect(linha).toContainText("Estadia mínima (4 meses)", { timeout: 30_000 });
      expect(reais(await p.getByTestId("previa-preco-mensal").innerText())).toBe(QUATRO.mensal);
      expect(reais(await p.getByTestId("previa-preco-total-mes").innerText())).toBe(MES_QUATRO);
      expect(reais(await linha.innerText())).toBe(TOTAL_QUATRO);
      const conta = (await p.getByTestId("previa-conta-estadia").innerText()).trim();
      expect(conta).toMatch(CONTA_QUATRO);
      expect(4 * MES_QUATRO + unicosDaConta(conta)).toBe(TOTAL_QUATRO);
      await p.getByTestId("previa-precos").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-previa-${largura}.png` });

      // "Ver no tamanho real": o cartão de preço da página com o mesmo Total por mês; a preparação fora dele.
      await p.locator('[data-testid="previa-tamanho-real-abrir"]:visible').first().click();
      const cartao = p.getByTestId("previa-tamanho-real").getByTestId("previa-real-cartao");
      await expect(cartao.getByTestId("total-por-mes")).toBeVisible({ timeout: 15_000 });
      expect(reais(await cartao.getByTestId("total-por-mes").innerText())).toBe(MES_QUATRO);
      expect(reais(await taxa(cartao, "preparacao").innerText())).toBe(QUATRO.preparacao);
      await cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-tamanho-real-${largura}.png` });
      await p.context().close();
    });
  }

  test("2. publicado: Meus anúncios, cartão público e barra do celular com R$ 13.900 e a mesma conta", async ({ browser }) => {
    await ajustar(ids.quatro!, { status: "active" });
    for (const largura of LARGURAS) {
      const p = await nova(browser, largura);
      const meus = await linhaMeusAnuncios(p, 4);
      expect(meus.total).toBe(TOTAL_QUATRO);
      expect(meus.conta).toMatch(CONTA_QUATRO);
      await meus.cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-meus-anuncios-${largura}.png` });

      await p.goto(`/imoveis/${ids.quatro}`, { waitUntil: "domcontentloaded" });
      const pub = await lerPublica(p, 4, largura);
      expect(pub.total).toBe(TOTAL_QUATRO);
      expect(pub.conta).toBe(meus.conta);
      // A preparação fica fora do Total por mês, na lista "Fora do total mensal", com o valor que está na conta.
      expect(pub.mes).toBe(MES_QUATRO);
      expect(reais(await taxa(pub.lateral, "preparacao").innerText())).toBe(QUATRO.preparacao);
      expect(4 * pub.mes + unicosDaConta(pub.conta)).toBe(pub.total);
      if (pub.barra) expect(pub.barra).toEqual({ total: TOTAL_QUATRO, mes: MES_QUATRO });
      await pub.lateral.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-publica-${largura}.png` });
      await p.context().close();
    }
  });

  test("3. dois pagamentos únicos (preparação + limpeza de saída), mínimo de 5 meses: R$ 13.050 nos três lugares", async ({ browser }) => {
    for (const largura of LARGURAS) {
      const p = await nova(browser, largura);
      const meus = await linhaMeusAnuncios(p, 5);
      expect(meus.total).toBe(TOTAL_CINCO);
      expect(meus.conta).toMatch(CONTA_CINCO);
      await meus.cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-meus-anuncios-saida-${largura}.png` });

      await p.goto(`/imoveis/${ids.cinco}`, { waitUntil: "domcontentloaded" });
      const pub = await lerPublica(p, 5, largura);
      expect(pub.total).toBe(TOTAL_CINCO);
      expect(pub.conta).toBe(meus.conta);
      // Nenhuma das duas limpezas no Total por mês; as duas em "Fora do total mensal", com os valores da conta.
      expect(pub.mes).toBe(CINCO.mensal);
      expect(reais(await taxa(pub.lateral, "preparacao").innerText())).toBe(CINCO.preparacao);
      expect(reais(await taxa(pub.lateral, "saida").innerText())).toBe(CINCO.saida);
      expect(5 * pub.mes + unicosDaConta(pub.conta)).toBe(pub.total);
      if (pub.barra) expect(pub.barra).toEqual({ total: TOTAL_CINCO, mes: CINCO.mensal });
      await pub.lateral.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t708-publica-saida-${largura}.png` });
      await p.context().close();
    }
  });

  // Defeito relatado: previa-tamanho-real.tsx chama <PriceCard> sem `meses`, então o cartão "como o morador vê" não
  // tem a linha "R$ X em N meses" nem a conta que a página pública (property-detail, meses = mesesDoCartao) mostra.
  test.fixme("4. tamanho real do Passo 10: o cartão mostra o mesmo 'R$ 13.900 em 4 meses' e a conta da página pública", async ({ browser }) => {
    const id = await prepararRascunho(ids.dono!, `Studio tamanho real ${sufixo}`, {
      monthlyPrice: String(QUATRO.mensal), condoFee: String(QUATRO.condominio), minPeriod: String(QUATRO.dias),
      utilitiesMode: "fixed", utilitiesEstimate: QUATRO.contas, prepFee: QUATRO.preparacao,
    });
    for (const largura of LARGURAS) {
      const p = await nova(browser, largura);
      await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
      await p.locator('[data-testid="previa-tamanho-real-abrir"]:visible').first().click();
      const cartao = p.getByTestId("previa-tamanho-real").getByTestId("previa-real-cartao");
      await expect(cartao.getByTestId("cartao-lateral-estadia")).toContainText("em 4 meses", { timeout: 15_000 });
      expect(reais(await cartao.getByTestId("cartao-lateral-estadia").innerText())).toBe(TOTAL_QUATRO);
      expect((await cartao.getByTestId("cartao-lateral-estadia-conta").innerText()).trim()).toMatch(CONTA_QUATRO);
      await p.context().close();
    }
  });
});
