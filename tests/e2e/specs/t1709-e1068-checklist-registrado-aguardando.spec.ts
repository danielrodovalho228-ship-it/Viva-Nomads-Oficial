import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { hojeBR } from "../../../src/lib/utils";

/*
  T1709 — E1068 @E1068: na lista "Antes da entrada" da estadia, o 1º pagamento e a caução mostram o estado REAL nos
  três momentos. Na prova ao vivo de 20/11 o dono registrou os dois e a lista dele continuou a dizer "Ainda não
  registrado": faltava o estado do meio.
   1. Nada registrado: "Ainda não registrado e confirmado." e "Ainda não registrada.".
   2. O dono registra o 1º pagamento e a caução pela tela. A lista DELE passa a dizer "Registrado por você. Aguardando
      a confirmação do morador." (e "Registrada por você…" na caução); os itens ainda não estão feitos.
   3. A moradora lê "Registrado pelo proprietário. Falta a sua confirmação."; confirma os dois pela tela; a lista dela
      passa a "Registrado e confirmado." e "Recebida pelo proprietário.", feitos.
   4. O dono vê o mesmo estado final.
  Capturas a 390 e a 1280 px da lista do dono no estado do meio. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const INICIO = hojeBR();
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1709.${sufixo}@lab.vivanomads.test`, nome: "Dora Registro Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1709.${sufixo}@lab.vivanomads.test`, nome: "Iris Registro Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

async function naEstadia(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("estadia-checklist")).toBeVisible({ timeout: 30_000 });
  return page;
}

/** O item da lista diz o texto e tem a marca de feito esperada. */
async function item(page: Page, chave: "primeiro_pagamento" | "caucao", texto: string, feito: boolean) {
  const li = page.getByTestId(`checklist-${chave}`);
  await expect(li, `${chave}: ${texto}`).toContainText(texto, { timeout: 30_000 });
  await expect(li).toHaveAttribute("data-feito", feito ? "sim" : "nao");
}

const pagamentos = async (confirmados: boolean) =>
  ((await adm().from("pagamentos_bloco").select("tipo, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!)).data ?? [])
    .filter((p) => p.confirmado_pelo_inquilino === confirmados)
    .map((p) => String(p.tipo))
    .sort();

test.describe("T1709 — E1068: o 1º pagamento e a caução dizem o estado real na estadia @E1068", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio registro ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: INICIO, fim: addDiasISO(INICIO, 59), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eBloco) throw eBloco;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. nada registrado: a lista do dono diz que ainda não foi registrado", async ({ browser }) => {
    const page = await naEstadia(browser, dono.email);
    await item(page, "primeiro_pagamento", "Ainda não registrado e confirmado.", false);
    await item(page, "caucao", "Ainda não registrada.", false);
    await page.context().close();
  });

  test("2. o dono registra o 1º pagamento e a caução: a lista dele passa a dizer \"registrado por você\"", async ({ browser }) => {
    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(() => pagamentos(false), { timeout: 30_000, message: "o 1º pagamento grava, sem confirmação" }).toEqual(["aluguel"]);
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-caucao").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect.poll(() => pagamentos(false), { timeout: 30_000, message: "a caução grava, sem confirmação" }).toEqual(["aluguel", "caucao"]);
    await pd.context().close();

    const page = await naEstadia(browser, dono.email);
    await item(page, "primeiro_pagamento", "Registrado por você. Aguardando a confirmação do morador.", false);
    await item(page, "caucao", "Registrada por você. Aguardando a confirmação do morador.", false);
    const lista = page.getByTestId("estadia-checklist");
    await lista.scrollIntoViewIfNeeded();
    await lista.screenshot({ path: `${SAIDA}/t1709-2-dono-registrado-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await lista.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("checklist-primeiro_pagamento")).toBeVisible();
    await lista.screenshot({ path: `${SAIDA}/t1709-2-dono-registrado-390.png` });
    await page.context().close();
  });

  test("3. a moradora lê que falta a confirmação dela, confirma os dois e a lista fecha", async ({ browser }) => {
    const antes = await naEstadia(browser, inq.email, 390);
    await item(antes, "primeiro_pagamento", "Registrado pelo proprietário. Falta a sua confirmação.", false);
    await item(antes, "caucao", "Registrada pelo proprietário. Falta a sua confirmação.", false);
    await antes.context().close();

    const pi = await entrar(browser, inq.email, senha);
    await pi.setViewportSize({ width: 1280, height: 900 });
    for (const restam of [1, 0]) {
      await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const confirmar = pi.getByTestId("confirmar-pagamentos");
      await expect(confirmar).toBeVisible({ timeout: 30_000 });
      await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
      await expect.poll(async () => (await pagamentos(false)).length, { timeout: 30_000 }).toBe(restam);
    }
    await pi.context().close();

    const depois = await naEstadia(browser, inq.email);
    await item(depois, "primeiro_pagamento", "Registrado e confirmado.", true);
    await item(depois, "caucao", "Recebida pelo proprietário.", true);
    await depois.context().close();
  });

  test("4. o dono vê o mesmo estado final", async ({ browser }) => {
    const page = await naEstadia(browser, dono.email);
    await item(page, "primeiro_pagamento", "Registrado e confirmado.", true);
    await item(page, "caucao", "Recebida pelo proprietário.", true);
    await page.context().close();
  });
});
