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
      Dentro do caso 2 (ORDEM-DUET-1049): M7 — o dono regista SÓ a caução primeiro — o 1º pagamento continua "ainda não registrado" e a
      caução mostra o estado do meio. M6: o dono regista o aluguel e o registo é ANULADO (anulado_em + motivo, pelo
      serviço) — a linha volta a "ainda não registrado". O dono regista o aluguel outra vez e segue o caso 2.
   3. A moradora lê "Registrado pelo proprietário. Falta a sua confirmação.", com a ação "Confirmar em Locações" no
      MESMO item (ORDEM-DUET-1048, condição do coordenador), que a leva ao bloco de confirmar; confirma os dois; a lista dela
      passa a "Registrado e confirmado." e "Recebida pelo proprietário.", feitos.
   4. O dono vê o mesmo estado final.
  Capturas a 390 e a 1280 px da lista do dono no estado do meio. Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1095): corre também no portão do #4084, porque o registro do pagamento do bloco
  passou a conferir o teto também no 1º registro (não passa do que o contrato diz que o bloco custa).
  Vizinha do teto da caução (ORDENS-DUET 1098 e 1107): corre também no portão desse avulso, porque o registro da
  caução passou a não passar da soma das cauções dos blocos do contrato.
  Vizinha do E1225 (ORDENS-DUET 1120 e 1127): corre também no portão desse PR, porque a caução passou a ser
  registada por bloco (0367), com uma linha por bloco no cartão da caução.
  Vizinha do E1229 (ORDENS-DUET 1143 e 1160): corre também no portão desse PR, porque a tela do contrato ganhou a
  anulação dos registros e a conferência passou a dizer 'Anulado em {data}: {motivo}'.
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
  ((await adm().from("pagamentos_bloco").select("tipo, confirmado_pelo_inquilino, anulado_em").eq("contrato_id", ids.contrato!)).data ?? [])
    .filter((p) => p.confirmado_pelo_inquilino === confirmados && !p.anulado_em)
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
    // ORDEM-DUET-1049 (M7): a CAUÇÃO primeiro, sozinha — a linha do 1º pagamento não pode contá-la como o aluguel.
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-caucao").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect.poll(() => pagamentos(false), { timeout: 30_000, message: "a caução grava, sem confirmação" }).toEqual(["caucao"]);
    const soCaucao = await naEstadia(browser, dono.email);
    await item(soCaucao, "primeiro_pagamento", "Ainda não registrado e confirmado.", false);
    await item(soCaucao, "caucao", "Registrada por você. Aguardando a confirmação do morador.", false);
    await soCaucao.context().close();

    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(() => pagamentos(false), { timeout: 30_000, message: "o 1º pagamento grava, sem confirmação" }).toEqual(["aluguel", "caucao"]);

    // ORDEM-DUET-1049 (M6): o registo do aluguel é ANULADO (a anulação lógica da casa: anulado_em + motivo, gravada
    // pelo serviço) — a linha volta a "ainda não registrado"; o estado do meio não aparece.
    const { error: eAn } = await adm()
      .from("pagamentos_bloco")
      .update({ anulado_em: new Date().toISOString(), anulado_motivo: "t1709: registo anulado (M6)" })
      .eq("contrato_id", ids.contrato!)
      .eq("tipo", "aluguel")
      .is("anulado_em", null);
    expect(eAn).toBeNull();
    const anulado = await naEstadia(browser, dono.email);
    await item(anulado, "primeiro_pagamento", "Ainda não registrado e confirmado.", false);
    await expect(anulado.getByTestId("checklist-primeiro_pagamento"), "M6: anulado, o estado do meio não aparece").not.toContainText("Registrado por você");
    await anulado.context().close();

    // O dono regista o aluguel outra vez (o registo anulado não conta).
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(() => pagamentos(false), { timeout: 30_000, message: "o 1º pagamento grava de novo, sem confirmação" }).toEqual(["aluguel", "caucao"]);
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
    // ORDEM-DUET-1048 (condição do coordenador): a ação de confirmar está no MESMO bloco do item e leva a Locações,
    // onde a moradora confirma.
    for (const chave of ["primeiro_pagamento", "caucao"] as const) {
      const acao = antes.getByTestId(`checklist-${chave}`).getByTestId(`checklist-${chave}-acao`);
      await expect(acao, `${chave}: a ação de confirmar no mesmo bloco`).toHaveText("Confirmar em Locações");
      await expect(acao).toHaveAttribute("href", "/dashboard/locacoes");
    }
    await antes.getByTestId("checklist-primeiro_pagamento-acao").click();
    await antes.waitForURL((u) => u.pathname === "/dashboard/locacoes", { timeout: 30_000 });
    await expect(antes.getByTestId("confirmar-pagamentos"), "a ligação leva ao bloco de confirmar").toBeVisible({ timeout: 30_000 });
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
