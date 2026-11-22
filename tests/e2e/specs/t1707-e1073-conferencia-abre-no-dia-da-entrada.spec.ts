import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { hojeBR } from "../../../src/lib/utils";

/*
  T1707 — E1073 @E1073: a conferência de ENTRADA só abre às 00:00 (horário de Brasília) do dia da entrada. Antes disso
  a seção diz quando abre e não oferece registrar, anexar nem responder; o servidor recusa quem tentar. O fecho não
  muda (dia da entrada no horário de check-in do anúncio + 48 h). Regra validada pelo coordenador (ORDEM-DUET-322).
   1. Entrada AMANHÃ (dia de Brasília), check-in às 15:00: dono e moradora veem "abre em DD/MM às 00:00, horário de
      Brasília (o dia da entrada)", sem formulário, sem laudo, sem confirmar. O prazo de fecho continua à vista.
   2. Entrada HOJE: a seção está aberta desde as 00:00 — mesmo antes das 15:00 do check-in; o dono registra um item.
   3. A entrada passa para amanhã DEPOIS de a página abrir (a página não sabia): o servidor recusa o registro com a
      data em que abre, e nenhum item é gravado.
  Capturas a 390 e a 1280 px da seção antes da abertura. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const HOJE = hojeBR();
const AMANHA = addDiasISO(HOJE, 1);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** 00:00 de Brasília do dia (UTC−3, sem horário de verão desde 2019) como instante ISO. */
const meiaNoiteBrasilia = (iso: string) => new Date(`${iso}T03:00:00.000Z`).toISOString();
/** O fecho: o dia da entrada às 15:00 de Brasília + 48 h. */
const fechoAs15 = (iso: string) => new Date(new Date(`${iso}T18:00:00.000Z`).getTime() + 48 * 3_600_000).toISOString();

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1707.${sufixo}@lab.vivanomads.test`, nome: "Dora Abertura Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1707.${sufixo}@lab.vivanomads.test`, nome: "Iris Abertura Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

async function entradaEm(inicio: string) {
  const { error } = await adm().from("contrato_blocos").update({ inicio, fim: addDiasISO(inicio, 60) }).eq("contrato_id", ids.contrato!);
  if (error) throw error;
}

const itensGravados = async () => {
  const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato!);
  const confIds = (confs ?? []).map((c) => c.id as string);
  if (!confIds.length) return 0;
  return ((await adm().from("conferencia_itens").select("id").in("conferencia_id", confIds)).data ?? []).length;
};

async function abrirContrato(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("conferencia-entrada")).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

test.describe("T1707 — E1073: a conferência de entrada só abre no dia da entrada @E1073", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio abertura ${sufixo}`, { ativo: true, preco: 3200 });
    const { error: eImovel } = await adm().from("properties").update({ checkin_after: "15:00", checkout_before: "11:00" }).eq("id", ids.imovel);
    if (eImovel) throw eImovel;
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: AMANHA, fim: addDiasISO(AMANHA, 60), meses: 2, valor: 6400, caucao: 3200, status: "agendado" });
    if (eBloco) throw eBloco;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato);
      const confIds = (confs ?? []).map((c) => c.id as string);
      if (confIds.length) {
        for (const t of ["conferencia_laudos", "conferencia_respostas", "conferencia_itens"]) await adm().from(t).delete().in("conferencia_id", confIds);
        await adm().from("conferencias").delete().in("id", confIds);
      }
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. entrada amanhã: dono e moradora veem quando abre, sem formulário, laudo nem confirmar", async ({ browser }) => {
    const esperado = `A conferência de entrada abre em ${ddmm(AMANHA)} às 00:00, horário de Brasília (o dia da entrada).`;
    for (const [quem, email, rota] of [
      ["dono", dono.email, `/dashboard/contratos/${ids.contrato}`],
      ["moradora", inq.email, `/dashboard/locacoes/${ids.contrato}`],
    ] as const) {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: 1280, height: 900 });
      await abrirContrato(page, rota);
      const secao = page.getByTestId("conferencia-entrada");
      const aviso = secao.getByTestId("conferencia-entrada-abre-em");
      await expect(aviso, `${quem}: a seção diz quando abre`).toHaveText(esperado);
      await expect(aviso, `${quem}: a abertura é 00:00 de Brasília do dia da entrada`).toHaveAttribute("data-abertura", meiaNoiteBrasilia(AMANHA));
      await expect(secao.getByTestId("conferencia-entrada-form"), `${quem}: sem formulário de item`).toHaveCount(0);
      await expect(secao.getByTestId("conferencia-entrada-laudo-botao"), `${quem}: sem anexar laudo`).toHaveCount(0);
      await expect(secao.getByTestId("conferencia-entrada-confirmar"), `${quem}: sem confirmar`).toHaveCount(0);
      await expect(secao.getByTestId("conferencia-entrada-vazia"), `${quem}: sem "Registre abaixo…"`).toHaveCount(0);
      // O fecho não muda: o dia da entrada às 15:00 (check-in do anúncio) + 48 h.
      await expect(secao.getByTestId("conferencia-prazo")).toHaveAttribute("data-prazo", fechoAs15(AMANHA));
      if (quem === "dono") {
        for (const largura of [1280, 390] as const) {
          await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
          await aviso.scrollIntoViewIfNeeded();
          await expect(aviso).toBeInViewport({ ratio: 1 });
          await secao.screenshot({ path: `${SAIDA}/t1707-1-antes-da-abertura-${largura}.png` });
        }
      }
      await page.context().close();
    }
    expect(await itensGravados()).toBe(0);
  });

  test("2. entrada hoje: a seção está aberta desde as 00:00 e o dono registra um item", async ({ browser }) => {
    await entradaEm(HOJE);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirContrato(page, `/dashboard/contratos/${ids.contrato}`);
    const secao = page.getByTestId("conferencia-entrada");
    await expect(secao.getByTestId("conferencia-entrada-abre-em")).toHaveCount(0);
    const form = secao.getByTestId("conferencia-entrada-form");
    await expect(form).toBeVisible();
    await form.getByLabel("Cômodo", { exact: true }).fill("Sala");
    await form.getByLabel("Itens e estado do cômodo").fill("Sofá e mesa em bom estado.");
    await form.getByRole("button", { name: "Adicionar item" }).click();
    await expect(secao.getByTestId("conferencia-entrada-itens")).toContainText("Sala", { timeout: 30_000 });
    await expect.poll(itensGravados, { timeout: 20_000 }).toBe(1);
    await page.context().close();
  });

  test("3. a entrada passa para amanhã depois de a página abrir: o servidor recusa e diz quando abre", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirContrato(page, `/dashboard/contratos/${ids.contrato}`);
    const secao = page.getByTestId("conferencia-entrada");
    const form = secao.getByTestId("conferencia-entrada-form");
    await expect(form, "a página abriu com a conferência aberta").toBeVisible();
    await entradaEm(AMANHA);

    await form.getByLabel("Cômodo", { exact: true }).fill("Quarto");
    await form.getByLabel("Itens e estado do cômodo").fill("Cama e armário em bom estado.");
    await form.getByRole("button", { name: "Adicionar item" }).click();
    await expect(secao.getByTestId("conferencia-erro")).toHaveText(`A conferência de entrada só abre no dia da entrada: ${ddmm(AMANHA)} às 00:00, horário de Brasília.`, { timeout: 30_000 });
    expect(await itensGravados(), "o item recusado não foi gravado (só o do caso 2)").toBe(1);
    await page.context().close();
  });
});
