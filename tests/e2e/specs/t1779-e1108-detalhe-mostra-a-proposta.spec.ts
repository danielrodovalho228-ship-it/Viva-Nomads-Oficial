import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1779 — E1108 @E1108 (ORDEM-DUET-787; linha Parceiros): a volta do E1108 à construção.
  Do lado do avaliador, o valor e o prazo que ele submeteu só apareciam no detalhe enquanto o pedido estava na etapa do
  pedido. Marcada a visita, a tela passa a ser a da visita e do laudo, e os dois valores sumiam — a linha da lista
  continuava a mostrá-los.
  A cura: a tela da visita e do laudo mostra a proposta combinada, pelas mesmas duas linhas da etapa "aceito" e pelas
  mesmas colunas que a lista lê.
  Cenário do piloto, como em produção: chave desligada (sem o cookie do laboratório), contas de teste na lista do
  piloto. Massa e cidade próprias (Estrela do Sul); só contas de teste.
   1. Visita marcada: o detalhe mostra "Você recebe R$ 300,00" e "Laudo em até 3 dias úteis depois da visita" — e a
      linha da lista do mesmo pedido mostra o mesmo valor e o mesmo prazo. A 390 e a 1280 px, com print.
   2. Visita feita (etapa do laudo): as mesmas duas linhas.
   3. Pedido anterior à regra dos dias úteis: a promessa como foi escrita — "Laudo em 2 dias".
   4. A avaliação de teste do credenciamento (sem escolha do dono, sem proposta) não mostra a linha.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Estrela do Sul";
const ROTA = "/dashboard/parceiro/avaliacao";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1779.${sufixo}@lab.vivanomads.test`, nome: "Dalva Proposta", role: "owner" as const };
const aval = { email: `av.t1779.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const imoveis: string[] = [];
type Caso = "agendado" | "realizada" | "antigo" | "credenciamento";
const pedidos = {} as Record<Caso, string>;
const ha = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();
const daquiA = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString();

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
const item = (page: Page, id: string) => page.locator(`[data-testid="avaliacao-designada"][data-pedido="${id}"]`);

async function pedidoDoAvaliador(caso: Caso, nome: string, campos: Record<string, unknown>): Promise<void> {
  const imovel = await criarImovelPronto(ids.dono, `[TESTE QA] t1779 ${nome}`, { ativo: true });
  imoveis.push(imovel);
  const up = await adm().from("properties").update({ city: CIDADE }).eq("id", imovel);
  if (up.error) throw up.error;
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, avaliador_id: ids.cred, teste: true, designado_em: ha(50), ...campos })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e2 } = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: ha(50), resposta: "aceita", respondido_em: ha(40) });
  if (e2) throw e2;
  pedidos[caso] = data.id as string;
}

test.describe("T1779 — E1108: o detalhe do avaliador continua a mostrar a proposta depois de marcada a visita @E1108", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-t1779-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1779", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1779 (laboratório)" });
      if (p.error) throw p.error;
    }
    // A proposta como a tela a grava hoje: o valor, e o prazo nas duas colunas (dias úteis depois da visita).
    const proposta = { escolhido_em: ha(50), valor_proposto: 300, prazo_proposto_dias: 3, prazo_laudo_dias_uteis: 3, proposta_em: ha(40), proposta_aceita_em: ha(30) };
    await pedidoDoAvaliador("agendado", "Chácara do Combinado", { status: "agendado", ...proposta, agendado_para: daquiA(2) });
    await pedidoDoAvaliador("realizada", "Sobrado da Visita Feita", { status: "realizada", ...proposta, agendado_para: ha(26), visita_concluida_em: ha(24) });
    // O pedido anterior à regra dos dias úteis: só a coluna antiga do prazo.
    await pedidoDoAvaliador("antigo", "Casa da Promessa Antiga", { status: "agendado", ...proposta, valor_proposto: 250, prazo_proposto_dias: 2, prazo_laudo_dias_uteis: null, agendado_para: daquiA(3) });
    // A avaliação de teste do credenciamento: de teste, sem escolha do dono e sem proposta.
    await pedidoDoAvaliador("credenciamento", "Apartamento de teste", { status: "agendado", valor_tabela: 0, agendado_para: daquiA(4) });
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const ped = ((await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis)).data ?? []).map((x) => x.id as string);
      if (ped.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", ped);
      if (ids.cred) await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    const contas = [ids.dono, ids.aval].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. visita marcada: o detalhe mostra o valor e o prazo combinados — os mesmos da linha da lista, a 390 e a 1280 px", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      // A linha da lista: a fonte que já mostrava a proposta.
      await a.goto(ROTA, { waitUntil: "domcontentloaded" });
      await expect(item(a, pedidos.agendado), "a lista carregou").toBeVisible({ timeout: 30_000 });
      await expect(item(a, pedidos.agendado)).toContainText(`${CIDADE} · 1 ou 2 quartos · R$ 300,00 · 3 dias úteis`);
      // O detalhe: a tela da visita, com a proposta à vista.
      await a.goto(`${ROTA}/${pedidos.agendado}`, { waitUntil: "domcontentloaded" });
      await expect(a.getByTestId("pedido-imovel"), "a tela da visita abriu").toBeVisible({ timeout: 30_000 });
      const linha = a.getByTestId("proposta-combinada");
      await expect(linha.getByTestId("proposta-combinada-valor"), `a ${w} px: o valor que o avaliador propôs`).toHaveText("Você recebe R$ 300,00");
      await expect(linha.getByTestId("proposta-combinada-prazo"), `a ${w} px: o prazo que o avaliador propôs`).toHaveText("Laudo em até 3 dias úteis depois da visita");
      await expect(linha).toBeInViewport();
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t1779-1-visita-marcada-${w}.png` });
    }
    await a.context().close();
  });

  test("2. visita feita (etapa do laudo): as mesmas duas linhas", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto(`${ROTA}/${pedidos.realizada}`, { waitUntil: "domcontentloaded" });
      await expect(a.getByTestId("avaliacao-concluir"), "a tela do laudo abriu").toHaveAttribute("data-status", "realizada", { timeout: 30_000 });
      await expect(a.getByTestId("proposta-combinada-valor")).toHaveText("Você recebe R$ 300,00");
      await expect(a.getByTestId("proposta-combinada-prazo")).toHaveText("Laudo em até 3 dias úteis depois da visita");
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t1779-2-visita-feita-${w}.png` });
    }
    await a.context().close();
  });

  test("3. pedido anterior à regra dos dias úteis: a promessa como foi escrita", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await a.goto(`${ROTA}/${pedidos.antigo}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-imovel")).toBeVisible({ timeout: 30_000 });
    await expect(a.getByTestId("proposta-combinada-valor")).toHaveText("Você recebe R$ 250,00");
    await expect(a.getByTestId("proposta-combinada-prazo")).toHaveText("Laudo em 2 dias");
    await a.context().close();
  });

  test("4. a avaliação de teste do credenciamento (sem proposta) não mostra a linha", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await a.goto(`${ROTA}/${pedidos.credenciamento}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-imovel"), "a tela da visita abriu").toBeVisible({ timeout: 30_000 });
    await expect(a.getByTestId("proposta-combinada")).toHaveCount(0);
    await expect(a.locator("main")).not.toContainText("Você recebe");
    await a.context().close();
  });
});
