import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1738 — E1103 @E1103 (ORDEM-DUET-467): a visita confirmada de uma avaliação não aparecia na Agenda geral do parceiro
  (/dashboard/parceiro#agenda): a visita estava na tela do pedido dos dois lados, mas a Agenda só lia os pedidos de
  serviço. Sintoma vizinho: no bloco do dono, "Combinado com o avaliador" sumia depois do agendamento.
  Cenário do piloto, como em produção: chave desligada, contas de teste na lista do piloto. Massa e cidade próprias
  (Araguari).
   1. A Agenda do parceiro lista as visitas confirmadas do avaliador, em ordem, com a data e a hora de Brasília; a
      data só proposta (imóvel ocupado, morador por concordar) e a visita já feita não entram. O item leva à tela da
      visita. Print a 390 e a 1280 px.
   2. Os dois lados, a mesma fonte: o avaliador agenda pela tela dele → a Agenda mostra essa data; o dono vê a mesma
      data no bloco dele e CONTINUA a ver "Combinado com o avaliador: R$ … · laudo em N dias".
   3. Concluída a visita, ela sai da Agenda.
   4. (ORDEM-DUET-495) A contagem "visitas de hoje" do painel do avaliador segue a mesma regra: um pedido "designado"
      com data marcada para HOJE (imóvel ocupado, morador por concordar) NÃO conta; quando o morador concorda e a
      visita fica confirmada, a contagem sobe. É o mesmo pedido: só o estado muda.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Araguari";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1738.${sufixo}@lab.vivanomads.test`, nome: "Dália Agenda", role: "owner" as const };
const aval = { email: `av.t1738.${sufixo}@lab.vivanomads.test`, nome: "Aurélio Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const imoveis: string[] = [];
const pedidos: Record<"proxima" | "depois" | "proposta" | "feita" | "aceito" | "hojeSoProposta", string> = { proxima: "", depois: "", proposta: "", feita: "", aceito: "", hojeSoProposta: "" };
const imovelDe: Record<string, string> = {};
const em = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
/** "25/11/2026 11:00 (horário de Brasília)", como a Agenda escreve. */
function quandoNaAgenda(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (horário de Brasília)`;
}
/** Hoje ao meio-dia de Brasília (15:00 UTC): cai sempre no dia de hoje pelo relógio de Brasília, seja qual for a hora da corrida. */
const diaDeBrasilia = (quando: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(quando));
function hojeAoMeioDiaDeBrasilia(): string {
  return `${diaDeBrasilia(new Date())}T15:00:00.000Z`;
}
/** Um pedido do avaliador da trava, com a proposta aceita pelo dono. */
async function pedido(chave: keyof typeof pedidos, campos: Record<string, unknown>): Promise<void> {
  const imovel = await criarImovelPronto(ids.dono, `[TESTE QA] t1738 ${chave} ${sufixo}`, { ativo: true });
  imoveis.push(imovel);
  imovelDe[chave] = imovel;
  const { error: eC } = await adm().from("properties").update({ city: CIDADE }).eq("id", imovel);
  if (eC) throw eC;
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: ids.cred, teste: true, designado_em: em(-72), escolhido_em: em(-72), valor_proposto: 300, prazo_proposto_dias: 2, proposta_em: em(-60), proposta_aceita_em: em(-48), ...campos })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e2 } = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: em(-72), resposta: "aceita", respondido_em: em(-60) });
  if (e2) throw e2;
  pedidos[chave] = data.id as string;
}
const agendaDoParceiro = async (page: Page) => {
  await page.goto("/dashboard/parceiro#agenda", { waitUntil: "domcontentloaded" });
  const agenda = page.getByTestId("parceiro-agenda");
  await expect(agenda.getByTestId("parceiro-agenda-calendario")).toBeVisible({ timeout: 30_000 });
  return agenda;
};

test.describe("T1738 — E1103: a visita confirmada aparece na Agenda do parceiro @E1103", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `[TESTE QA] ${aval.nome} ${sufixo}`, slug: `av-t1738-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1738", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1738 (laboratório)" });
      if (p.error) throw p.error;
    }
    // Duas visitas confirmadas (a próxima daqui a 3 h; a outra daqui a 5 dias, gravada primeiro: a Agenda ordena).
    await pedido("depois", { agendado_para: em(5 * 24) });
    await pedido("proxima", { agendado_para: em(3) });
    // Data só PROPOSTA: imóvel ocupado, o morador ainda não concordou — o pedido segue "designado".
    await pedido("proposta", { status: "designado", ocupado: true, agendado_para: em(2 * 24), concordancia_pedida_em: em(-1) });
    // Visita já feita (à espera do laudo).
    await pedido("feita", { status: "realizada", agendado_para: em(-24), visita_concluida_em: em(-23) });
    // Proposta aceita, sem data: o avaliador agenda no caso 2.
    await pedido("aceito", { status: "designado" });
    // ORDEM-DUET-495: data marcada para HOJE, mas só proposta (imóvel ocupado, morador por concordar): segue "designado".
    await pedido("hojeSoProposta", { status: "designado", ocupado: true, agendado_para: hojeAoMeioDiaDeBrasilia(), concordancia_pedida_em: em(-1) });
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const ped = ((await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis)).data ?? []).map((x) => x.id as string);
      if (ped.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", ped);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    const contas = [ids.dono, ids.aval].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. a Agenda do parceiro lista as visitas confirmadas, em ordem; a data só proposta e a visita feita não entram", async ({ browser }) => {
    const agendadas = Object.fromEntries(
      (((await adm().from("vistoria_pedidos").select("id, agendado_para").in("id", [pedidos.proxima, pedidos.depois])).data ?? []) as { id: string; agendado_para: string }[]).map((x) => [x.id, x.agendado_para]),
    );
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      const agenda = await agendaDoParceiro(a);
      const itens = agenda.getByTestId("parceiro-agenda-item");
      await expect(itens, "as duas visitas confirmadas (antes: nenhuma)").toHaveCount(2, { timeout: 30_000 });
      await expect(itens.nth(0)).toHaveAttribute("href", `/dashboard/parceiro/avaliacao/${pedidos.proxima}`);
      await expect(itens.nth(0)).toContainText(quandoNaAgenda(agendadas[pedidos.proxima]));
      await expect(itens.nth(0)).toContainText(`Visita de avaliação · ${CIDADE}`);
      await expect(itens.nth(1)).toHaveAttribute("href", `/dashboard/parceiro/avaliacao/${pedidos.depois}`);
      await expect(itens.nth(1)).toContainText(quandoNaAgenda(agendadas[pedidos.depois]));
      // A data só proposta (morador por concordar) e a visita já feita não são visitas confirmadas.
      for (const fora of [pedidos.proposta, pedidos.feita, pedidos.aceito, pedidos.hojeSoProposta]) await expect(agenda.locator(`a[href="/dashboard/parceiro/avaliacao/${fora}"]`)).toHaveCount(0);
      await expect(agenda.getByText("Nenhum horário combinado")).toHaveCount(0);
      await expect(agenda.getByTestId("parceiro-agenda-visitas-erro")).toHaveCount(0);
      await semRolagemLateral(a);
      // O print é do cartão da Agenda (a página do parceiro é longa).
      await agenda.scrollIntoViewIfNeeded();
      await agenda.screenshot({ path: `${SAIDA}/t1738-1-agenda-do-parceiro-${w}.png` });
    }
    // O item leva à tela da visita daquele pedido.
    await largura(a, 390);
    const agenda = await agendaDoParceiro(a);
    await agenda.getByTestId("parceiro-agenda-item").first().click();
    await expect(a.getByRole("link", { name: "Voltar às avaliações" })).toBeVisible({ timeout: 30_000 });
    expect(new URL(a.url()).pathname).toBe(`/dashboard/parceiro/avaliacao/${pedidos.proxima}`);
    await expect(a.getByRole("heading", { level: 1, name: /Visita/ }).first()).toBeVisible();
    await a.context().close();
  });

  test("2. os dois lados, a mesma fonte: o avaliador agenda → a Agenda mostra; o dono vê a mesma data e o combinado continua", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 1280);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const agendar = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidos.aceito}"]`).getByTestId("agendar-visita");
    await expect(agendar).toBeVisible({ timeout: 30_000 });
    // O campo é o do site (data em texto + hora); colar "AAAA-MM-DDTHH:MM" preenche os dois. Hora de Brasília.
    const dia = new Date(Date.now() + 3 * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);
    await agendar.getByRole("textbox", { name: "Data", exact: true }).fill(`${dia}T10:00`);
    await agendar.getByRole("button", { name: "Agendar" }).click();
    const lido = async () => (await adm().from("vistoria_pedidos").select("status, agendado_para").eq("id", pedidos.aceito).single()).data!;
    await expect.poll(async () => (await lido()).status, { timeout: 20_000 }).toBe("agendado");
    const marcado = (await lido()).agendado_para as string;
    expect(marcado).toBe(`${dia}T13:00:00+00:00`);
    const [ano, mes, d] = dia.split("-");

    // A Agenda geral do parceiro passa a listar essa visita, na data que a tela do pedido mostra.
    const agenda = await agendaDoParceiro(a);
    const item = agenda.locator(`a[href="/dashboard/parceiro/avaliacao/${pedidos.aceito}"]`);
    await expect(item).toHaveCount(1, { timeout: 30_000 });
    await expect(item).toContainText(`${d}/${mes}/${ano} 10:00 (horário de Brasília)`);
    await expect(agenda.getByTestId("parceiro-agenda-item")).toHaveCount(3);
    await a.context().close();

    // O lado do dono: a mesma data — e o combinado continua à vista depois do agendamento.
    const dn = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(dn, w);
      await dn.goto(`/dashboard/imoveis/${imovelDe.aceito}/nivel`, { waitUntil: "domcontentloaded" });
      const visita = dn.getByTestId("avaliacao-visita");
      await expect(visita).toContainText(`Visita: ${d}/${mes}/${ano} às 10:00, horário de Brasília`, { timeout: 30_000 });
      await expect(dn.getByTestId("avaliacao-proposta-aceita"), "o combinado não some com o agendamento").toHaveText("Combinado com o avaliador: R$ 300,00 · laudo em 2 dias.");
      await semRolagemLateral(dn);
      // O print é do cartão da avaliação (a página do nível é longa).
      const cartao = dn.getByTestId("avaliacao-dono");
      await cartao.scrollIntoViewIfNeeded();
      await cartao.screenshot({ path: `${SAIDA}/t1738-2-dono-combinado-e-visita-${w}.png` });
    }
    await dn.context().close();
  });

  test("3. concluída a visita, ela sai da Agenda", async ({ browser }) => {
    const { error } = await adm().from("vistoria_pedidos").update({ status: "realizada", visita_concluida_em: new Date().toISOString() }).eq("id", pedidos.proxima);
    if (error) throw error;
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    const agenda = await agendaDoParceiro(a);
    await expect(agenda.getByTestId("parceiro-agenda-item")).toHaveCount(2, { timeout: 30_000 });
    await expect(agenda.locator(`a[href="/dashboard/parceiro/avaliacao/${pedidos.proxima}"]`)).toHaveCount(0);
    await expect(agenda.locator(`a[href="/dashboard/parceiro/avaliacao/${pedidos.depois}"]`)).toHaveCount(1);
    await a.context().close();
  });

  test("4. 'visitas de hoje' do painel: o pedido designado com data para hoje NÃO conta; confirmada a visita, a contagem sobe", async ({ browser }) => {
    // A massa neste ponto: nenhuma visita CONFIRMADA para hoje (a de +5 dias e a do caso 2, daqui a 3 dias; a "próxima"
    // já foi concluída no caso 3). Para hoje só existe a data proposta do pedido "designado".
    const hoje = hojeAoMeioDiaDeBrasilia();
    const estado = async () => (await adm().from("vistoria_pedidos").select("status, agendado_para, concordancia_em").eq("id", pedidos.hojeSoProposta).single()).data!;
    expect(await estado(), "a massa: designado, com data para hoje, morador por concordar").toEqual({ status: "designado", agendado_para: hoje.replace(".000Z", "+00:00"), concordancia_em: null });
    const agendados = ((await adm().from("vistoria_pedidos").select("id, agendado_para").eq("avaliador_id", ids.cred).eq("status", "agendado")).data ?? []) as { id: string; agendado_para: string | null }[];
    const confirmadasHoje = agendados.filter((x) => x.agendado_para && diaDeBrasilia(x.agendado_para) === diaDeBrasilia(new Date()));
    expect(confirmadasHoje, "a massa: nenhuma visita confirmada para hoje").toEqual([]);

    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const painel = a.getByTestId("painel-avaliador");
      // O pedido está na lista do avaliador, com a data de hoje à vista — e mesmo assim não é "visita de hoje".
      await expect(a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidos.hojeSoProposta}"]`).getByTestId("avaliador-visita")).toContainText("(aguardando o morador)", { timeout: 30_000 });
      await expect(painel.getByTestId("painel-visitas-hoje"), "a data só proposta não conta").toHaveText("Você não tem visita hoje");
      await expect(painel.getByTestId("painel-faixa")).toContainText("Nenhuma visita para hoje");
      await expect(painel.getByTestId("painel-cartao-agenda")).toContainText("Hoje • sem visita");
    }

    // O morador concorda: o sistema passa o pedido a "agendado" (é o que a ação da concordância grava). Agora é visita confirmada.
    const { error } = await adm().from("vistoria_pedidos").update({ status: "agendado", concordancia_em: new Date().toISOString() }).eq("id", pedidos.hojeSoProposta);
    if (error) throw error;
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const painel = a.getByTestId("painel-avaliador");
      await expect(painel.getByTestId("painel-visitas-hoje"), "a visita confirmada conta").toHaveText("Você tem 1 visita hoje", { timeout: 30_000 });
      await expect(painel.getByTestId("painel-faixa")).toContainText("1 visita para hoje");
      await expect(painel.getByTestId("painel-cartao-agenda")).toContainText("Hoje • 1 visita");
      await semRolagemLateral(a);
      await painel.screenshot({ path: `${SAIDA}/t1738-4-painel-visitas-de-hoje-${w}.png` });
    }
    await a.context().close();
  });
  test("5. a visita de hoje, depois de feita, deixa de contar como 'visita de hoje'", async ({ browser }) => {
    // E1103 (lacuna A da ORDEM-DUET-618/623): a Agenda já lê só "agendado" no banco; o painel lê todos os pedidos do
    // avaliador e conta pela regra visitaConfirmada — uma visita "realizada" hoje não é visita por fazer.
    const { error } = await adm().from("vistoria_pedidos").update({ status: "realizada", visita_concluida_em: new Date().toISOString() }).eq("id", pedidos.hojeSoProposta);
    if (error) throw error;
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const painel = a.getByTestId("painel-avaliador");
      await expect(painel.getByTestId("painel-visitas-hoje"), "a visita feita não conta").toHaveText("Você não tem visita hoje", { timeout: 30_000 });
      await expect(painel.getByTestId("painel-cartao-agenda")).toContainText("Hoje • sem visita");
    }
    await a.context().close();
  });
});
