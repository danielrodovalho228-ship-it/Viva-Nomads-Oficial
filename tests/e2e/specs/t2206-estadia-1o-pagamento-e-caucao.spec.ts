import { test, expect, type Browser, type Page } from "@playwright/test";
import { ROTULO_ETAPA } from "../../../src/lib/contrato-etapas";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2206 — Estadia e saída, 1.ª perna: os pagamentos antes da entrada (ORDEM-DUET-312). Só no laboratório.
  Sobre um contrato assinado pelas duas partes, com caução no 1.º bloco:
    1. antes: o dono vê "Aguardando 1º pagamento" em Contratos, o morador em Minhas estadias; na página da estadia, os
       itens "1º pagamento" e "Caução" de "Antes da entrada" estão por fazer, nas duas visões;
    2. o dono regista pela tela o recebimento do 1.º pagamento e da caução;
    3. registado e ainda não confirmado: os dois itens continuam por fazer (a regra: só conta confirmado pelo morador);
    4. o morador confirma os dois pagamentos;
    5. depois: o contrato sai de "Aguardando 1º pagamento" para "Em vigência" nos dois lados, e na página da estadia os
       dois itens ficam feitos ("Registrado e confirmado." / "Recebida pelo proprietário."), para o dono e para o morador.
    6. E1044 (ORDEM-DUET-333): noutro contrato, o dono regista três pagamentos FORA da ordem das datas (bloco 1 há 3 dias,
       bloco 2 ontem, a caução há 2 dias); a lista "Pagamentos para confirmar" do morador vem por data; o morador confirma o
       mais antigo (o UPDATE mexe na ordem do armazenamento) e os dois que restam continuam por data.
  Os achados desta perna (onde o morador confirma; o texto do item da caução enquanto espera a confirmação) estão no PR,
  para decisão do Gerente; o spec não inventa comportamento: prende só o que o código já decide.
  Vizinha do E1072 (#4084, ORDEM-DUET-1095): corre também no portão do #4084, porque o registro do pagamento do bloco
  passou a conferir o teto também no 1º registro (não passa do que o contrato diz que o bloco custa).
  Vizinha do teto da caução (ORDENS-DUET 1098 e 1107): corre também no portão desse avulso, porque o registro da
  caução passou a não passar da soma das cauções dos blocos do contrato.
  Vizinha do E1225 (ORDENS-DUET 1120 e 1127): corre também no portão desse PR, porque a caução passou a ser
  registada por bloco (0367), com uma linha por bloco no cartão da caução.
  Vizinha do E1229 (ORDENS-DUET 1143 e 1160): corre também no portão desse PR, porque a tela do contrato ganhou a
  anulação dos registros e a conferência passou a dizer 'Anulado em {data}: {motivo}'.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2206.${sufixo}@lab.vivanomads.test`, nome: "Dalva Pagamentos", role: "owner" as const };
const morador = { email: `mor.t2206.${sufixo}@lab.vivanomads.test`, nome: "Moema Pagamentos", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};
const TITULO = `Studio dos pagamentos ${sufixo}`;
/** Datas em Brasília: a entrada daqui a 8 dias, como no t256 (antes da entrada, fora do D-7). */
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

/** Os dois itens de "Antes da entrada" na página da estadia, na visão de quem está logado. */
async function itensDaEstadia(page: Page) {
  await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("estadia-checklist")).toBeVisible({ timeout: 30_000 });
  const item = (chave: string) => page.getByTestId(`checklist-${chave}`);
  return { pagamento: item("primeiro_pagamento"), caucao: item("caucao") };
}

async function pagamentos(tipo: "aluguel" | "caucao") {
  const { data } = await adm().from("pagamentos_bloco").select("id, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!).eq("tipo", tipo);
  return data ?? [];
}

test.describe("T2206 — Estadia: o 1º pagamento e a caução antes da entrada, pela tela, nos dois lados @estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    // Simulação declarada: o contrato nasce assinado pelas duas partes (a assinatura tem prova própria, t2157 etapa 8).
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(67), meses: 2, valor: 6000, caucao: 1500, status: "ativo" });
    if (e1) throw e1;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!, ids.morador!].filter(Boolean));
  });

  test("1. antes: 'Aguardando 1º pagamento' nos dois lados e os dois itens por fazer na página da estadia", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato assinado pelas duas partes gravado pelo laboratório" });
    const pd = await abrir(browser, dono.email);
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("contrato-etapa").first(), "o dono: assinado, falta o 1º pagamento").toHaveAttribute("data-chave", "aguardando_pagamento", { timeout: 20_000 });
    const d = await itensDaEstadia(pd);
    await expect(d.pagamento, "dono: 1º pagamento por fazer").toHaveAttribute("data-feito", "nao");
    await expect(d.caucao, "dono: caução por fazer").toHaveAttribute("data-feito", "nao");
    await pd.context().close();

    const pm = await abrir(browser, morador.email);
    await pm.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(pm.getByTestId("locacao-etapa").first(), "o morador: aguardando o 1º pagamento").toHaveText(ROTULO_ETAPA.aguardando_pagamento, { timeout: 20_000 });
    const m = await itensDaEstadia(pm);
    await expect(m.pagamento, "morador: 1º pagamento por fazer").toHaveAttribute("data-feito", "nao");
    await expect(m.caucao, "morador: caução por fazer").toHaveAttribute("data-feito", "nao");
    await pm.context().close();
  });

  test("2–3. o dono regista o 1º pagamento e a caução; registado sem confirmação, os itens continuam por fazer", async ({ browser }) => {
    const pd = await abrir(browser, dono.email);
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await pagamentos("aluguel")).length, { timeout: 20_000, message: "o 1º pagamento grava" }).toBe(1);

    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("registrar-caucao").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await pagamentos("caucao")).length, { timeout: 20_000, message: "a caução grava" }).toBe(1);

    // Registado e ainda não confirmado pelo morador: nada conta ainda (o código decide assim; o texto fica no relatório).
    const d = await itensDaEstadia(pd);
    await expect(d.pagamento, "dono: o 1º pagamento só conta confirmado").toHaveAttribute("data-feito", "nao");
    await expect(d.caucao, "dono: a caução só conta confirmada").toHaveAttribute("data-feito", "nao");
    test.info().annotations.push(
      { type: "achado", description: `item "1º pagamento" registado e por confirmar: "${(await d.pagamento.innerText()).replace(/\s+/g, " ")}"` },
      { type: "achado", description: `item "Caução" registada e por confirmar: "${(await d.caucao.innerText()).replace(/\s+/g, " ")}"` },
    );
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("contrato-etapa").first(), "o dono: continua a faltar o 1º pagamento confirmado").toHaveAttribute("data-chave", "aguardando_pagamento", { timeout: 20_000 });
    await pd.context().close();
  });

  test("4–5. o morador confirma os dois; o contrato fica em vigência e os itens feitos, nos dois lados (390 e 1280)", async ({ browser }) => {
    const pm = await abrir(browser, morador.email);
    await pm.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = pm.getByTestId("confirmar-pagamentos");
    await expect(confirmar, "o morador vê os pagamentos a confirmar").toBeVisible({ timeout: 20_000 });
    await expect(confirmar.getByRole("button", { name: /Confirmar/ }), "os dois: 1º pagamento e caução").toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
      await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(1 - i, { timeout: 20_000 });
    }
    await expect.poll(async () => (await pagamentos("aluguel")).every((p) => p.confirmado_pelo_inquilino), { timeout: 20_000 }).toBe(true);
    await expect.poll(async () => (await pagamentos("caucao")).every((p) => p.confirmado_pelo_inquilino), { timeout: 20_000 }).toBe(true);

    await pm.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(pm.getByTestId("locacao-etapa").first(), "o morador: em vigência").toHaveText(ROTULO_ETAPA.em_vigencia, { timeout: 20_000 });
    await pm.context().close();

    for (const largura of [390, 1280] as const) {
      for (const quem of [morador, dono]) {
        const p = await abrir(browser, quem.email, largura);
        const it = await itensDaEstadia(p);
        await expect(it.pagamento, `${quem.nome} ${largura}: 1º pagamento feito`).toHaveAttribute("data-feito", "sim");
        await expect(it.pagamento).toContainText("Registrado e confirmado.");
        await expect(it.caucao, `${quem.nome} ${largura}: caução feita`).toHaveAttribute("data-feito", "sim");
        await expect(it.caucao).toContainText("Recebida pelo proprietário.");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
        await p.context().close();
      }
    }
    const pd = await abrir(browser, dono.email);
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("contrato-etapa").first(), "o dono: em vigência").toHaveAttribute("data-chave", "em_vigencia", { timeout: 20_000 });
    await pd.context().close();
  });

  test("6. E1044: a lista do morador vem por data, antes e depois de confirmar o mais antigo", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "o 2.º contrato (assinado pelas duas partes) é gravado pelo laboratório; os pagamentos são registados pela tela" });
    const titulo2 = `Studio da ordem ${sufixo}`;
    const imovel2 = await criarImovelPronto(ids.dono!, titulo2, { ativo: true, preco: 3000 });
    const lead2 = await criarLead(ids.dono!, ids.morador!, imovel2, true);
    const agora = new Date().toISOString();
    const { data: c2, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: lead2, property_id: imovel2, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 120, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 1200,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    const contrato2 = c2!.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert([
      { contrato_id: contrato2, numero_bloco: 1, inicio: dia(130), fim: dia(189), meses: 2, valor: 6000, caucao: 1500, status: "ativo" },
      { contrato_id: contrato2, numero_bloco: 2, inicio: dia(190), fim: dia(249), meses: 2, valor: 6000, caucao: 0, status: "pendente_aceite" },
    ]);
    if (eb) throw eb;

    // O dono regista pela tela, nesta ordem: bloco 1 (há 3 dias), bloco 2 (ontem), caução (há 2 dias).
    const br = (iso: string) => iso.split("-").reverse().join("/");
    const pd = await abrir(browser, dono.email);
    const painel = () => pd.locator("div").filter({ hasText: titulo2 }).filter({ has: pd.getByTestId("contrato-taxa") }).last();
    async function registrar(botao: "registrar-recebimento" | "registrar-caucao", iso: string, gravados: number) {
      await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await painel().getByTestId(botao).first().click();
      const data = pd.locator("label", { hasText: /^Data/ }).locator("input:not([type=hidden])").first();
      await data.fill((await data.getAttribute("type")) === "date" ? iso : br(iso));
      await data.press("Tab");
      await pd.getByTestId("confirmar-recebimento").click();
      await expect.poll(async () => (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", contrato2)).data?.length ?? 0, { timeout: 20_000 }).toBe(gravados);
    }
    await registrar("registrar-recebimento", dia(-3), 1);
    await registrar("registrar-recebimento", dia(-1), 2);
    await registrar("registrar-caucao", dia(-2), 3);
    const { data: gravados } = await adm().from("pagamentos_bloco").select("data_pagamento").eq("contrato_id", contrato2).order("created_at");
    expect(gravados!.map((g) => String(g.data_pagamento).slice(0, 10)), "registados fora da ordem das datas").toEqual([dia(-3), dia(-1), dia(-2)]);
    await pd.context().close();

    // O morador: "Pagamentos para confirmar" por data, antes e depois de confirmar o mais antigo.
    const pm = await abrir(browser, morador.email);
    const datasDaLista = async () => {
      const lista = pm.getByTestId("confirmar-pagamentos").locator("li");
      return (await lista.allInnerTexts()).map((t) => t.match(/pago em (\d{2}\/\d{2}\/\d{4})/)?.[1] ?? "?");
    };
    await pm.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(pm.getByTestId("confirmar-pagamentos").locator("li")).toHaveCount(3, { timeout: 20_000 });
    expect(await datasDaLista(), "E1044: os três por data").toEqual([br(dia(-3)), br(dia(-2)), br(dia(-1))]);
    await pm.getByTestId("confirmar-pagamentos").getByRole("button", { name: /Confirmar/ }).first().click();
    await expect(pm.getByTestId("confirmar-pagamentos").locator("li")).toHaveCount(2, { timeout: 20_000 });
    await expect
      .poll(async () => (await adm().from("pagamentos_bloco").select("confirmado_pelo_inquilino, data_pagamento").eq("contrato_id", contrato2).eq("confirmado_pelo_inquilino", true)).data?.map((g) => String(g.data_pagamento).slice(0, 10)), { timeout: 20_000 })
      .toEqual([dia(-3)]);
    await pm.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(pm.getByTestId("confirmar-pagamentos").locator("li")).toHaveCount(2, { timeout: 20_000 });
    expect(await datasDaLista(), "E1044: depois de confirmar o mais antigo, os dois que restam continuam por data").toEqual([br(dia(-2)), br(dia(-1))]);
    await pm.context().close();
  });
});
