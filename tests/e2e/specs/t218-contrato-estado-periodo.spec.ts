import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T218 — Complemento do coordenador (19/10, depois do reteste do #864). Laboratório, contas de teste, 390 e 1280 px.
   1. Estado do contrato com UMA fonte: para cada estado (aguardando assinatura · falta você · falta a outra parte ·
      aguardando 1º pagamento · em vigência · concluído · cancelado), o selo do detalhe = o da lista, dos dois lados,
      = o da carteira.
   2. Nenhum período sobreposto no mesmo imóvel (0174): o banco recusa (23P01); o sequencial (entrada no dia seguinte
      ao fim) passa; cancelado e concluído não bloqueiam; "Gerar contrato" com data dentro de outro contrato mostra
      "Este imóvel já tem contrato de … a …"; com a data seguinte, gera; o calendário do anúncio bloqueia o período; a
      carteira mostra um contrato por imóvel e "Próximo morador a partir de …".
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t218.${sufixo}@lab.vivanomads.test`, nome: "Olga Período Sobrenome", role: "owner" as const };
const inq = { email: `inq.t218.${sufixo}@lab.vivanomads.test`, nome: "Iris Período Sobrenome", role: "tenant" as const };
const inq2 = { email: `inq2.t218.${sufixo}@lab.vivanomads.test`, nome: "Raul Período Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};
const t = "2026-10-01T12:00:00Z";

const dia = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");

interface Estado {
  nome: string;
  status: string;
  assinadoDono: boolean;
  assinadoInq: boolean;
  pago: boolean;
  seloDono: string;
  seloInq: string;
  /** A carteira só mostra o selo de contrato ativo; concluído e cancelado deixam o imóvel vago. */
  naCarteira: boolean;
}
const ESTADOS: Estado[] = [
  { nome: "aguardando", status: "ativo", assinadoDono: false, assinadoInq: false, pago: false, seloDono: "Aguardando assinatura · falta você e o inquilino", seloInq: "Aguardando assinatura · falta você e o proprietário", naCarteira: true },
  { nome: "falta-voce", status: "ativo", assinadoDono: false, assinadoInq: true, pago: false, seloDono: "Aguardando assinatura · falta você", seloInq: "Aguardando assinatura · falta o proprietário", naCarteira: true },
  { nome: "falta-outra", status: "ativo", assinadoDono: true, assinadoInq: false, pago: false, seloDono: "Aguardando assinatura · falta o inquilino", seloInq: "Aguardando assinatura · falta você", naCarteira: true },
  { nome: "pagamento", status: "ativo", assinadoDono: true, assinadoInq: true, pago: false, seloDono: "Aguardando 1º pagamento", seloInq: "Aguardando 1º pagamento", naCarteira: true },
  { nome: "vigencia", status: "ativo", assinadoDono: true, assinadoInq: true, pago: true, seloDono: "Em vigência", seloInq: "Em vigência", naCarteira: true },
  { nome: "concluido", status: "concluido", assinadoDono: true, assinadoInq: true, pago: true, seloDono: "Concluído", seloInq: "Concluído", naCarteira: false },
  { nome: "cancelado", status: "cancelado", assinadoDono: false, assinadoInq: false, pago: false, seloDono: "Cancelado", seloInq: "Cancelado", naCarteira: false },
];

/** Contrato + 1 bloco direto no banco (o mesmo formato do registrarContrato). Devolve o id ou o erro do banco. */
async function contrato(o: { imovel: string; tenant: string; lead?: string; inicio: string; fim: string; status?: string; assinadoDono?: boolean; assinadoInq?: boolean; pago?: boolean }) {
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({
      lead_id: o.lead ?? null,
      property_id: o.imovel,
      tenant_id: o.tenant,
      owner_plan: "essential",
      faixa: "media_estadia",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      garantia: "caucao",
      status: "ativo",
      assinado_proprietario_em: o.assinadoDono ? t : null,
      assinado_inquilino_em: o.assinadoInq ? t : null,
    })
    .select("id")
    .single();
  if (error) return { id: null as string | null, error };
  const { data: b, error: eB } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: c!.id, numero_bloco: 1, inicio: o.inicio, fim: o.fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" })
    .select("id")
    .single();
  if (eB) {
    await adm().from("contratos").delete().eq("id", c!.id);
    return { id: null, error: eB };
  }
  if (o.pago) {
    await adm().from("pagamentos_bloco").insert({ bloco_id: b!.id, contrato_id: c!.id, tipo: "aluguel", valor: 6400, data_pagamento: o.inicio, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: t });
  }
  if (o.status && o.status !== "ativo") await adm().from("contratos").update({ status: o.status }).eq("id", c!.id);
  return { id: c!.id as string, error: null };
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}
async function ir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Fechamento pela tela com a data de entrada escolhida, até clicar em "Gerar contrato". */
async function ateGerar(d: Page, entrada: string) {
  await ir(d, `/dashboard/fechamento?c=${ids.lead2}`);
  await d.getByTestId("inicio-estadia").fill(entrada);
  await d.getByRole("button", { name: /verificar identidade/i }).click();
  const continuar = d.getByRole("button", { name: /continuar/i });
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await d.getByRole("radio").and(d.locator(":not([disabled])")).first().click();
  await d.getByTestId("ciente-protecao").check({ timeout: 15_000 });
  await continuar.click();
  await expect(d.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
  await continuar.click();
  await d.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
  await continuar.click();
  await d.getByTestId("fechamento-gerar-contrato").click();
}

test.describe("T218 — estado do contrato com uma fonte e nenhum período sobreposto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.inq2 = await criarConta(inq2, senha, true);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq, ids.inq2]);
    // Um imóvel por estado (assim os 7 convivem sem cruzar datas) e um imóvel para a regra das datas.
    for (const e of ESTADOS) {
      ids[`im-${e.nome}`] = await criarImovelPronto(ids.dono, `Estado ${e.nome} ${sufixo}`, { ativo: true, preco: 3200 });
      const r = await contrato({ imovel: ids[`im-${e.nome}`], tenant: ids.inq, inicio: dia(3), fim: dia(62), status: e.status, assinadoDono: e.assinadoDono, assinadoInq: e.assinadoInq, pago: e.pago });
      if (r.error) throw r.error;
      ids[`ct-${e.nome}`] = r.id!;
    }
    ids.periodo = await criarImovelPronto(ids.dono, `Studio Período ${sufixo}`, { ativo: true, preco: 3200 });
  });

  test.afterAll(async () => {
    const imoveis = Object.entries(ids).filter(([k]) => k.startsWith("im-") || k === "periodo").map(([, v]) => v);
    const { data: cts } = await adm().from("contratos").select("id, lead_id").in("property_id", imoveis);
    const cids = ((cts ?? []) as { id: string }[]).map((c) => c.id);
    if (cids.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await adm().from("cobrancas_fechamento").delete().in("lead_id", [ids.lead2].filter(Boolean));
    await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inq, ids.inq2, ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`1. ${largura} — o selo do detalhe = lista do dono = lista do inquilino = carteira, nos 7 estados`, async ({ browser }) => {
      const d = await abrir(browser, dono.email, largura);
      await ir(d, "/dashboard/contratos");
      for (const e of ESTADOS) {
        const cartao = d.locator(`[data-testid="contrato-cartao"][data-contrato="${ids[`ct-${e.nome}`]}"]`);
        await expect(cartao.getByTestId("contrato-etapa"), e.nome).toHaveText(e.seloDono, { timeout: 20_000 });
      }
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t218-lista-dono-${largura}.png`, fullPage: true });
      for (const e of ESTADOS) {
        await ir(d, `/dashboard/contratos/${ids[`ct-${e.nome}`]}`);
        await expect(d.getByTestId("contrato-selo"), e.nome).toHaveText(e.seloDono, { timeout: 20_000 });
      }
      await ir(d, "/dashboard/carteira");
      for (const e of ESTADOS) {
        const linha = d.locator(`[data-testid="carteira-linha"][data-imovel="${ids[`im-${e.nome}`]}"]`);
        if (e.naCarteira) await expect(linha.getByTestId("carteira-selo"), e.nome).toHaveText(e.seloDono);
        else {
          await expect(linha).toHaveAttribute("data-situacao", "vago");
          await expect(linha.getByTestId("carteira-selo")).toHaveCount(0);
        }
      }
      // Situação da carteira pela mesma fonte: em vigência ocupa; os que ainda faltam algo ficam reservados.
      await expect(d.locator(`[data-testid="carteira-linha"][data-imovel="${ids["im-vigencia"]}"]`)).toHaveAttribute("data-situacao", "ocupado");
      await expect(d.locator(`[data-testid="carteira-linha"][data-imovel="${ids["im-pagamento"]}"]`)).toHaveAttribute("data-situacao", "reservado");
      await d.screenshot({ path: `${SAIDA}/t218-carteira-${largura}.png`, fullPage: true });
      await d.context().close();

      const i = await abrir(browser, inq.email, largura);
      await ir(i, "/dashboard/contratos");
      for (const e of ESTADOS) {
        const cartao = i.locator(`[data-testid="contrato-inquilino"][data-contrato="${ids[`ct-${e.nome}`]}"]`);
        await expect(cartao.getByTestId("contrato-inquilino-estado"), e.nome).toHaveText(e.seloInq, { timeout: 20_000 });
      }
      await semRolagemLateral(i);
      await i.screenshot({ path: `${SAIDA}/t218-lista-inquilino-${largura}.png`, fullPage: true });
      await ir(i, "/dashboard/locacoes");
      // Locações mostra as assinadas pelas duas partes (e as encerradas), com o mesmo selo.
      for (const e of ESTADOS.filter((x) => x.status !== "ativo" || (x.assinadoDono && x.assinadoInq))) {
        const cartao = i.locator(`[data-testid="locacao-cartao"][data-contrato="${ids[`ct-${e.nome}`]}"]`);
        await expect(cartao.getByTestId("locacao-etapa"), e.nome).toHaveText(e.seloInq, { timeout: 20_000 });
      }
      for (const e of ESTADOS) {
        await ir(i, `/dashboard/locacoes/${ids[`ct-${e.nome}`]}`);
        await expect(i.getByTestId("contrato-selo"), e.nome).toHaveText(e.seloInq, { timeout: 20_000 });
      }
      await i.screenshot({ path: `${SAIDA}/t218-detalhe-inquilino-${largura}.png`, fullPage: true });
      await i.context().close();
    });
  }

  test("2a. banco — sobreposto recusado (23P01); sequencial aceito; cancelado e concluído não bloqueiam", async () => {
    const a = await contrato({ imovel: ids.periodo, tenant: ids.inq, inicio: dia(5), fim: dia(64), assinadoDono: true, assinadoInq: true, pago: true });
    expect(a.error).toBeNull();
    ids.ctA = a.id!;
    const { data: lido } = await adm().from("contratos").select("periodo").eq("id", ids.ctA).single();
    expect(String(lido!.periodo)).toBe(`[${dia(5)},${dia(65)})`);

    // Sobreposto (começa no último dia de A): o banco recusa.
    const sob = await contrato({ imovel: ids.periodo, tenant: ids.inq2, inicio: dia(64), fim: dia(123) });
    expect(sob.error?.code).toBe("23P01");
    // Sequencial (entrada no dia seguinte ao fim de A): aceito.
    const seq = await contrato({ imovel: ids.periodo, tenant: ids.inq2, inicio: dia(65), fim: dia(124) });
    expect(seq.error).toBeNull();
    // Cancelado não bloqueia: o sequencial é cancelado e outro contrato ocupa as mesmas datas.
    await adm().from("contratos").update({ status: "cancelado" }).eq("id", seq.id!);
    const noLugar = await contrato({ imovel: ids.periodo, tenant: ids.inq2, inicio: dia(70), fim: dia(129) });
    expect(noLugar.error).toBeNull();
    // Concluído também não: concluído esse, reativar o cancelado volta a ser recusado só se cruzar um ativo.
    await adm().from("contratos").update({ status: "concluido" }).eq("id", noLugar.id!);
    const { error: reativa } = await adm().from("contratos").update({ status: "ativo" }).eq("id", seq.id!);
    expect(reativa).toBeNull();
    const { error: reativa2 } = await adm().from("contratos").update({ status: "ativo" }).eq("id", noLugar.id!);
    expect(reativa2?.code).toBe("23P01");
    // Limpa os de apoio: fica só A no imóvel.
    for (const id of [seq.id!, noLugar.id!]) {
      await adm().from("contrato_blocos").delete().eq("contrato_id", id);
      await adm().from("contratos").delete().eq("id", id);
    }
  });

  test("2b. 1280 — 'Gerar contrato' dentro de outro contrato: a mensagem com as datas; no dia seguinte ao fim, gera; carteira mostra o próximo", async ({ browser }) => {
    ids.lead2 = await criarLead(ids.dono, ids.inq2, ids.periodo, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.lead2);
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      await adm().from("documentos_inquilino").insert({ lead_id: ids.lead2, tenant_id: ids.inq2, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
    }
    const d = await abrir(browser, dono.email, 1280);
    await ateGerar(d, dia(30));
    await expect(d.getByTestId("erro-contrato")).toHaveText(`Este imóvel já tem contrato de ${br(dia(5))} a ${br(dia(64))}. Escolha outra data de entrada.`, { timeout: 30_000 });
    await d.screenshot({ path: `${SAIDA}/t218-gerar-recusado-1280.png`, fullPage: true });
    expect((await adm().from("contratos").select("id").eq("lead_id", ids.lead2)).data ?? []).toHaveLength(0);

    // De novo, com a entrada no dia seguinte ao fim de A: gera.
    await ateGerar(d, dia(65));
    await expect(d.getByTestId("fechamento-estado-contrato")).toBeVisible({ timeout: 30_000 });
    const { data: novo } = await adm().from("contratos").select("id, periodo").eq("lead_id", ids.lead2).single();
    ids.ctB = novo!.id as string;
    expect(String(novo!.periodo).startsWith(`[${dia(65)},`)).toBe(true);

    await ir(d, "/dashboard/carteira");
    const linha = d.locator(`[data-testid="carteira-linha"][data-imovel="${ids.periodo}"]`);
    await expect(linha.getByTestId("carteira-contrato")).toHaveText(ids.ctA.slice(0, 8));
    await expect(linha.getByTestId("carteira-selo")).toHaveText("Em vigência");
    await expect(linha.getByTestId("carteira-proximo")).toContainText(`Próximo morador a partir de ${br(dia(65))}`);
    await expect(linha.getByTestId("carteira-proximo")).toHaveAttribute("data-contrato", ids.ctB);
    await d.screenshot({ path: `${SAIDA}/t218-carteira-proximo-1280.png`, fullPage: true });
    await d.context().close();
  });

  test("2c. 390 — o calendário do anúncio bloqueia o período com contrato (só as datas)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/imoveis/${ids.periodo}`, { waitUntil: "domcontentloaded" });
    const dentro = new Date(`${dia(10)}T12:00:00`);
    const rotulo = `${dentro.getDate()} de ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][dentro.getMonth()]}`;
    const botao = page.locator(`button[aria-label^="${rotulo}"]`).first();
    await expect(botao).toHaveAttribute("data-estado-dia", "indisponivel", { timeout: 20_000 });
    await expect(botao).toBeDisabled();
    const html = await page.content();
    expect(html).not.toContain(inq.nome);
    await botao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t218-calendario-390.png` });
  });
});
