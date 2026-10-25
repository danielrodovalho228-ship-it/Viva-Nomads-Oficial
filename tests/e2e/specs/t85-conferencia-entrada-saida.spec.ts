import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
  pdf,
} from "../fixtures/laboratorio";
import { jpegComGps } from "../fixtures/exif";
import { metadadoNoDeposito } from "../fixtures/exif-deposito";

/**
 * T85 — CONFERÊNCIA DE ENTRADA E SAÍDA (ordens 404cd213 e d3c60126; achado do Moacir no #466).
 * Contas NOVAS: dono com imóvel publicado, inquilino com contrato em vigência e um terceiro sem relação.
 *  1. Dono registra um cômodo com foto na conferência de ENTRADA; a foto aparece no item.
 *  2. Inquilino vê o item do dono, registra o dele e confirma: "Aguardando a outra parte"; o formulário some.
 *  3. Dono contesta (o motivo é obrigatório): "Contestada"; depois disso nada mais muda.
 *  4. Laudo independente na SAÍDA: não-PDF e PDF acima de 15 MB são recusados; o PDF válido entra,
 *     aparece como "Laudo independente — prevalece sobre as fotos" para as duas partes e não se anexa de novo.
 *  5. Terceiro não vê a conferência do contrato (nem pelo dono, nem pelo inquilino).
 * Tudo a 390 px, sem rolagem lateral (360 e 1280 também no teste 2).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.conf.${sufixo}@lab.vivanomads.test`, nome: "Otávio Conferência", role: "owner" as const };
const inquilino = { email: `inq.conf.${sufixo}@lab.vivanomads.test`, nome: "Iara Conferência", role: "tenant" as const };
const terceiro = { email: `ter.conf.${sufixo}@lab.vivanomads.test`, nome: "Tiago Terceiro", role: "tenant" as const };
const titulo = `Studio mobiliado da conferência ${sufixo}`;
const ids: { dono?: string; inquilino?: string; terceiro?: string; imovel?: string; contrato?: string } = {};
// Começo da spec (com folga para o relógio do Storage): o teste de EXIF só confere o que esta execução enviou.
const INICIO = new Date(Date.now() - 60_000);
const SALA = `Sala ${sufixo}`;
const QUARTO = `Quarto ${sufixo}`;

async function semRolagemLateral(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 844 });
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, `sem rolagem lateral a ${largura}px`).toBeLessThanOrEqual(1);
}

async function adicionarItem(page: Page, tipo: "entrada" | "saida", comodo: string, descricao: string, comFoto: boolean) {
  const form = page.getByTestId(`conferencia-${tipo}-form`);
  // Espera a hidratação: preencher antes dela faz o envio recarregar a página e perder o item.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await form.getByLabel("Cômodo", { exact: true }).fill(comodo);
  await form.getByLabel("Itens e estado do cômodo").fill(descricao);
  // Foto como sai do celular (EXIF e GPS): o cenário 6 confere que o depósito guarda sem metadado.
  if (comFoto) await form.getByLabel("Foto do cômodo").setInputFiles({ name: "comodo.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(3) });
  await form.getByRole("button", { name: "Adicionar item" }).click();
}

test.describe("T85 — Conferência de entrada e saída: fotos, confirmar/contestar e laudo independente", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.terceiro = await criarConta(terceiro, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true });
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
        assinado_proprietario_em: agora,
        assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const hoje = new Date();
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(hoje), fim: dia(new Date(hoje.getTime() + 60 * 86_400_000)), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
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
    await apagarContas([ids.dono, ids.inquilino, ids.terceiro]);
  });

  test("1. dono registra cômodo com foto na entrada", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conferencia-entrada")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-estado")).toHaveText("Em andamento");
    await adicionarItem(page, "entrada", SALA, "Sofá sem manchas, TV na parede.", true);
    const itens = page.getByTestId("conferencia-entrada-itens");
    // Se o servidor recusar o item, a tela mostra o motivo: sem ele a falha vira só "não encontrado".
    await expect(page.getByTestId("conferencia-erro")).toHaveCount(0);
    await expect(itens).toContainText(SALA, { timeout: 20_000 });
    await expect(itens.getByRole("img", { name: `Foto: ${SALA}` })).toBeVisible();
    await semRolagemLateral(page, 390);
    await page.context().close();
  });

  test("2. inquilino vê o item do dono, registra o dele e confirma", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const entrada = page.getByTestId("conferencia-entrada");
    await expect(entrada).toBeVisible({ timeout: 20_000 });
    await expect(entrada).toContainText(SALA);
    await expect(entrada).toContainText("Proprietário");
    await adicionarItem(page, "entrada", QUARTO, "Cama de casal, um arranhão na cabeceira.", false);
    await expect(page.getByTestId("conferencia-entrada-itens")).toContainText(QUARTO, { timeout: 20_000 });
    await page.getByTestId("conferencia-entrada-confirmar").click();
    await expect(page.getByTestId("conferencia-entrada-estado")).toHaveText("Aguardando a outra parte", { timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-respostas")).toContainText("Inquilino confirmou");
    // Depois de responder, nada mais se altera.
    await expect(page.getByTestId("conferencia-entrada-form")).toHaveCount(0);
    await expect(page.getByTestId("conferencia-entrada-confirmar")).toHaveCount(0);
    for (const l of [360, 390, 1280]) await semRolagemLateral(page, l);
    await page.context().close();
  });

  test("3. dono contesta (motivo obrigatório) e a conferência trava", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const entrada = page.getByTestId("conferencia-entrada");
    await expect(entrada).toContainText(QUARTO, { timeout: 20_000 });
    await entrada.getByRole("button", { name: "Contestar" }).click();
    // Sem motivo o botão de enviar fica travado.
    await expect(entrada.getByRole("button", { name: "Enviar contestação" })).toBeDisabled();
    await entrada.getByLabel("Motivo da contestação").fill("O arranhão na cabeceira já existia antes da entrada.");
    await entrada.getByRole("button", { name: "Enviar contestação" }).click();
    await expect(page.getByTestId("conferencia-entrada-estado")).toHaveText("Contestada", { timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-respostas")).toContainText("Proprietário contestou");
    await expect(page.getByTestId("conferencia-entrada-respostas")).toContainText("arranhão");
    await expect(page.getByTestId("conferencia-entrada-form")).toHaveCount(0);
    await semRolagemLateral(page, 390);
    await page.context().close();
  });

  test("4. laudo independente na saída: recusa não-PDF e PDF acima de 15 MB; o válido prevalece", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const saida = page.getByTestId("conferencia-saida");
    await expect(saida).toBeVisible({ timeout: 20_000 });
    const campo = page.getByTestId("conferencia-saida-laudo-input");

    await campo.setInputFiles({ name: "laudo.pdf", mimeType: "application/pdf", buffer: Buffer.from("isto não é um PDF de verdade") });
    await expect(page.getByTestId("conferencia-erro")).toContainText("Envie o laudo em PDF", { timeout: 20_000 });

    const grande = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(16 * 1024 * 1024, 0x20)]);
    await campo.setInputFiles({ name: "laudo-grande.pdf", mimeType: "application/pdf", buffer: grande });
    await expect(page.getByTestId("conferencia-erro")).toContainText("até 15 MB", { timeout: 30_000 });
    await expect(page.getByTestId("conferencia-laudo")).toHaveCount(0);

    await campo.setInputFiles({ name: "laudo-ok.pdf", mimeType: "application/pdf", buffer: pdf() });
    const laudo = page.getByTestId("conferencia-laudo");
    await expect(laudo).toBeVisible({ timeout: 30_000 });
    await expect(laudo).toContainText("Laudo independente");
    await expect(laudo).toContainText("prevalece sobre as fotos");
    // Um por conferência: o campo some e não há como anexar outro.
    await expect(page.getByTestId("conferencia-saida-laudo-input")).toHaveCount(0);
    await semRolagemLateral(page, 390);
    await page.context().close();

    // O inquilino também enxerga o laudo, na mesma conferência de saída.
    const inq = await entrar(browser, inquilino.email, senha);
    await inq.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(inq.getByTestId("conferencia-saida").getByTestId("conferencia-laudo")).toContainText("Laudo independente", { timeout: 20_000 });
    await inq.context().close();
  });

  test("5. terceiro não vê a conferência", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, terceiro.email, senha);
    for (const rota of [`/dashboard/contratos/${ids.contrato}`, `/dashboard/locacoes/${ids.contrato}`]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page.getByTestId("conferencia")).toHaveCount(0);
      await expect(page.getByText(SALA)).toHaveCount(0);
      await expect(page.getByText("Laudo independente")).toHaveCount(0);
    }
    await page.context().close();
  });

  // Estudo de segurança (22/10): foto do cômodo com EXIF/GPS revela o aparelho e a coordenada da casa.
  test("6. EXIF/GPS: a foto do cômodo enviada com GPS fica guardada sem metadado no depósito 'conferencia'", async () => {
    const r = await metadadoNoDeposito("conferencia", ids.dono!, INICIO);
    expect(r.conferidas, "a foto do cômodo do cenário 1 deveria estar no depósito").toBeGreaterThan(0);
    expect(r.problemas, "foto enviada com EXIF e GPS tem de ser guardada limpa").toEqual([]);
  });
});
