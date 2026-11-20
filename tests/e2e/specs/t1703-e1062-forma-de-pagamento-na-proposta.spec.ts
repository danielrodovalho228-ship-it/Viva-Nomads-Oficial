import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1703 — E1062 @E1062 (a regra é a do E647): a forma de pagamento aparece na proposta, para os dois lados, ANTES do
  Aceitar. Na prova ao vivo de 20/11 a moradora aceitou a proposta sem ver se pagava por bloco ou por mês.
  A chave é de build (NEXT_PUBLIC_FORMA_PAGAMENTO_DONO_ATIVA): este spec só corre no laboratório construído com ela
  ligada (job @chave-build); com a chave desligada, pula de propósito.
   1. O dono abre o anúncio, marca "Bloco completo ou mensal" para estadias de 30 a 90 dias e salva; a página pública do
      imóvel passa a mostrar a linha "Forma de pagamento".
   2. O dono envia a proposta de 60 dias: a versão gravada nasce com a forma recomendada (bloco).
   3. A moradora abre a proposta: vê "Forma de pagamento: Bloco completo" antes do Aceitar; pede a outra forma numa
      contraproposta (Mensal), que o anúncio oferece.
   4. O dono vê "Forma de pagamento: Mensal" antes de responder e propõe de volta o Bloco completo.
   5. A moradora vê a forma FINAL (Bloco completo) antes do Aceitar e aceita; as 3 versões ficam gravadas com a forma de
      cada uma (bloco, mensal, bloco).
  Capturas a 390 e a 1280 px do bloco da forma, como a moradora o vê. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1703.${sufixo}@lab.vivanomads.test`, nome: "Dora Forma Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1703.${sufixo}@lab.vivanomads.test`, nome: "Iris Forma Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string } = {};
const SAIDA = "tests/laboratorio/saida";

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = emDias(30);
const SAIDA_DATA = emDias(90); // 60 dias

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function naProposta(browser: Browser, email: string) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, `/dashboard/propostas/${ids.proposta}`);
  return page;
}

const formas = async () =>
  ((await adm().from("proposta_versoes").select("versao, forma_pagamento").eq("proposta_id", ids.proposta!).order("versao")).data ?? []).map((v) => v.forma_pagamento);

test.describe("T1703 — E1062: a forma de pagamento na proposta, antes do Aceitar @E1062 @chave-build", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(process.env.NEXT_PUBLIC_FORMA_PAGAMENTO_DONO_ATIVA !== "on", "Só no job do laboratório com as chaves de build ligadas.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio forma ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm()
      .from("properties")
      // O anúncio aceita negociar: sem isso a moradora só pode aceitar ou recusar, e não haveria contraproposta.
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [] }, condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: ENTRADA, fim_desejado: SAIDA_DATA })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("propostas").delete().eq("lead_id", ids.lead);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. o dono marca \"Bloco completo ou mensal\" no anúncio e a página pública mostra a forma", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/imoveis/${ids.imovel}/editar`);
    const secao = page.getByTestId("secao-detalhes-anuncio");
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button").first().click();
    const campo = page.getByTestId("forma-pagamento");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("forma-pagamento-ate_90-ambos").click();
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect
      .poll(async () => ((await adm().from("properties").select("detalhes_anuncio").eq("id", ids.imovel!).single()).data?.detalhes_anuncio as { pagamento?: { ate_90?: string } } | null)?.pagamento?.ate_90, { timeout: 20_000 })
      .toBe("ambos");
    await abrir(page, `/imoveis/${ids.imovel}`);
    await expect(page.locator("main")).toContainText("Forma de pagamento", { timeout: 20_000 });
    await page.context().close();
  });

  test("2. o dono envia a proposta de 60 dias: nasce com a forma recomendada (bloco)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/orcamentos/nova?interessado=${ids.lead}`);
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("proposta-dias")).toContainText("60 dias");
    await page.getByTestId("proposta-validade").selectOption("7");
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.proposta = page.url().split("/").pop()!;
    await expect.poll(formas, { timeout: 20_000 }).toEqual(["bloco"]);
    await page.context().close();
  });

  test("3. a moradora vê \"Bloco completo\" antes do Aceitar e pede o Mensal numa contraproposta", async ({ browser }) => {
    const pi = await naProposta(browser, inq.email);
    const forma = pi.getByTestId("proposta-forma-final");
    await expect(pi.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
    await expect(forma).toContainText("Forma de pagamento: Bloco completo");
    await expect(forma).toContainText("numa parcela só, direto ao proprietário");
    // A forma vem ANTES do botão de aceitar, na ordem da página.
    expect(await forma.evaluate((el, alvo) => !!(el.compareDocumentPosition(document.querySelector(alvo)!) & Node.DOCUMENT_POSITION_FOLLOWING), '[data-testid="proposta-aceitar"]')).toBe(true);
    await forma.scrollIntoViewIfNeeded();
    await forma.screenshot({ path: `${SAIDA}/t1703-3-moradora-forma-1280.png` });
    await pi.setViewportSize({ width: 390, height: 844 });
    await forma.scrollIntoViewIfNeeded();
    await expect(forma).toBeVisible();
    await forma.screenshot({ path: `${SAIDA}/t1703-3-moradora-forma-390.png` });
    await pi.setViewportSize({ width: 1280, height: 900 });
    await pi.getByTestId("proposta-contrapropor").click();
    await pi.getByTestId("contra-forma").getByText("Mensal", { exact: true }).click();
    await pi.getByTestId("enviar-contraproposta").click();
    await expect.poll(formas, { timeout: 20_000 }).toEqual(["bloco", "mensal"]);
    await pi.context().close();
  });

  test("4. o dono vê \"Mensal\" antes de responder e propõe de volta o Bloco completo", async ({ browser }) => {
    const pd = await naProposta(browser, dono.email);
    await expect(pd.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
    await expect(pd.getByTestId("proposta-forma-final")).toContainText("Forma de pagamento: Mensal");
    await pd.getByTestId("proposta-contrapropor").click();
    await pd.getByTestId("contra-forma").getByText("Bloco completo", { exact: true }).click();
    await pd.getByTestId("enviar-contraproposta").click();
    await expect.poll(formas, { timeout: 20_000 }).toEqual(["bloco", "mensal", "bloco"]);
    await pd.context().close();
  });

  test("5. a moradora vê a forma FINAL antes do Aceitar e aceita; as 3 versões guardam a forma de cada uma", async ({ browser }) => {
    const pi = await naProposta(browser, inq.email);
    await expect(pi.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
    await expect(pi.getByTestId("proposta-forma-final")).toContainText("Forma de pagamento: Bloco completo");
    await pi.getByTestId("proposta-aceitar").click();
    await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", ids.proposta!).single()).data?.status, { timeout: 20_000 }).toBe("aceita");
    expect(await formas()).toEqual(["bloco", "mensal", "bloco"]);
    // Depois do aceite a forma continua à vista.
    await abrir(pi, `/dashboard/propostas/${ids.proposta}`);
    await expect(pi.getByTestId("proposta-forma-final")).toContainText("Forma de pagamento: Bloco completo");
    await pi.context().close();
  });
});
