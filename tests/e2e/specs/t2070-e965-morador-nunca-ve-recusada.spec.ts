import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2070 — E965 (Pista 3; autorizado pelo Gerente na ronda 03:20Z) @E965 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave de serviço).
  Regra decidida (ORDEM-DUET-070, D4/A4): o morador NUNCA vê "recusada" — nem no estado da proposta, nem na caixa da
  recusa, nem na lista nem nos filtros dos seus orçamentos. Vale quando ele próprio recusa e quando o proprietário
  recusa. O proprietário segue a ver o estado e o motivo (o t193 cobre esse lado; a asserção dele sobre o morador muda
  no PR da correção, com o julgamento do Gerente registado). Correção do Code 2 (Família 6).
  Asserção: no texto visível das telas do morador, nada casa /recusad/i ("Recusar", o verbo do botão, não conta).
  Cenários a 390 e 1280 px: (A) o morador recusa pela tela; (B) o proprietário recusa pela tela a contraproposta do morador.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: (string | undefined)[] = [];
const RECUSADA = /recusad/i;

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

interface Cenario { dono: { id: string; email: string }; inq: { id: string; email: string }; imovel: string; lead: string }

async function cenario(nome: string): Promise<Cenario> {
  const tag = `${nome}.${randomBytes(3).toString("hex")}.${sufixo}`;
  const dono = { email: `dono.t2070.${tag}@lab.vivanomads.test`, id: "" };
  const inq = { email: `inq.t2070.${tag}@lab.vivanomads.test`, id: "" };
  dono.id = await criarConta({ email: dono.email, nome: `Dalva ${nome} Sobrenome`, role: "owner" }, senha);
  inq.id = await criarConta({ email: inq.email, nome: `Iara ${nome} Sobrenome`, role: "tenant" }, senha);
  ids.push(dono.id, inq.id);
  const imovel = await criarImovelPronto(dono.id, `Studio recusa ${nome}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(dono.id, inq.id, imovel);
  return { dono, inq, imovel, lead };
}

/** Proposta aberta direto no banco (o que se testa é a recusa e o que o morador vê depois). Com `contraproposta`, a
 *  versão 2 é do morador e a vez de responder (e de recusar) passa ao proprietário. */
async function propostaNoBanco(c: Cenario, contraproposta = false): Promise<string> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data: p, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: c.lead, property_id: c.imovel, owner_id: c.dono.id, tenant_id: c.inq.id, status: contraproposta ? "contraproposta" : "enviada", versao_atual: contraproposta ? 2 : 1, validade_dias: 7, valida_ate: emDias(7) + "T23:00:00Z" })
    .select("id")
    .single();
  if (error) throw error;
  await adm().from("proposta_versoes").insert({
    proposta_id: p.id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: emDias(10), total_mensal: 3200, total_contrato: 12_800,
  });
  if (contraproposta)
    await adm().from("proposta_versoes").insert({
      proposta_id: p.id, versao: 2, autor: "tenant", valor_base: 3200, valor_mensal: 3000, meses: 4, data_entrada: emDias(10), total_mensal: 3000, total_contrato: 12_000,
    });
  return p.id as string;
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  return page;
}

async function recusarPelaTela(page: Page, id: string) {
  await page.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("proposta-recusar").click();
  await page.getByTestId("form-recusa").getByText("Datas", { exact: true }).click();
  await page.getByTestId("confirmar-recusa").click();
  await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", id).single()).data?.status, { timeout: 20_000 }).toBe("recusada");
}

/** O morador olha o detalhe e a lista: nada visível diz "recusada". */
async function moradorNaoVeRecusada(page: Page, id: string) {
  await page.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("proposta-status")).toBeVisible({ timeout: 20_000 });
  const detalhe = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(detalhe.match(RECUSADA)?.[0] ?? null, `detalhe da proposta: "${detalhe.match(/.{0,40}recusad.{0,40}/i)?.[0]}"`).toBeNull();
  await page.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  const lista = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  expect(lista.match(RECUSADA)?.[0] ?? null, `lista de orçamentos: "${lista.match(/.{0,40}recusad.{0,40}/i)?.[0]}"`).toBeNull();
}

test.describe("T2070 — E965: o morador nunca vê recusada @E965", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — A: o próprio morador recusa; depois, nem o detalhe nem a lista dizem recusada`, async ({ browser }) => {
      const c = await cenario(`MoradorRecusa${largura}`);
      const id = await propostaNoBanco(c);
      const inq = await abrir(browser, c.inq.email, largura);
      await recusarPelaTela(inq, id);
      await moradorNaoVeRecusada(inq, id);
      await inq.context().close();
    });

    test(`${largura} px — B: o proprietário recusa; o morador não vê recusada no detalhe nem na lista`, async ({ browser }) => {
      const c = await cenario(`DonoRecusa${largura}`);
      const id = await propostaNoBanco(c, true);
      const dono = await abrir(browser, c.dono.email, largura);
      await recusarPelaTela(dono, id);
      // O lado do proprietário segue informado (regra do t193): o estado e o motivo.
      await expect(dono.getByTestId("proposta-recusa")).toContainText("Motivo: Datas");
      await dono.context().close();
      const inq = await abrir(browser, c.inq.email, largura);
      await moradorNaoVeRecusada(inq, id);
      await inq.context().close();
    });
  }
});
