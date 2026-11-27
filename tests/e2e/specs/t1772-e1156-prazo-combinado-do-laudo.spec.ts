import { test, expect, type Page } from "@playwright/test";
import { diaUtilNoEnsaio } from "../fixtures/feriados-do-ensaio";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1772 — E1156 @E1156 (ORDENS-DUET 654, 712, 713, 734 e 770; linha Parceiros). A casa prometia o laudo "em até 48 horas
  úteis" depois da visita, igual para todos. A decisão do Daniel: vale o prazo COMBINADO com o avaliador, em dias úteis
  depois da visita — o avaliador propõe (teto de 5; sem proposta, o padrão é 2) e o dono vê o compromisso ao lado do
  valor antes de aceitar. Os pedidos já abertos mantêm a promessa que receberam.
  Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O avaliador propõe em dias úteis depois da visita: acima do teto é recusado; com 3 dias úteis entra, e os dois
      lados leem "laudo em até 3 dias úteis depois da visita" — o dono, ao lado do valor, antes de aceitar. Print a 390
      e a 1280 px.
   2. Com a visita marcada, o dono lê "Laudo até DD/MM/AAAA" (3 dias úteis depois da visita); com a visita feita, "o
      laudo sai até DD/MM/AAAA". Nenhuma das duas telas fala em 48 horas.
   3. O pedido anterior à regra mantém a promessa que recebeu: "laudo em 7 dias".
   4. (ORDEM-774) O termo do perfil segue o teto: em "Meus termos", 6 dias é recusado com a mesma frase da proposta e
      nada é gravado; com 5 entra.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Serra do Salitre";
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1772.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const avaliador = { email: `aval.t1772.${sufixo}@lab.vivanomads.test`, nome: "Ari Avaliador", role: "tenant" as const };
const TITULO = `Lar t1772 ${sufixo}`;
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
type Pedido = { status: string; valor_proposto: number | string | null; prazo_proposto_dias: number | null; prazo_laudo_dias_uteis: number | null; proposta_em: string | null };
const pedido = async () => {
  const { data, error } = await adm().from("vistoria_pedidos").select("status, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, proposta_em").eq("id", ids.pedido).single();
  if (error) throw error;
  return data as Pedido;
};
const mudar = async (campos: Record<string, unknown>) => {
  const r = await adm().from("vistoria_pedidos").update(campos).eq("id", ids.pedido);
  if (r.error) throw r.error;
};
/** "25/10/2026" no horário de Brasília — como a tela escreve a data do laudo. */
const dia = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
/**
 * A última segunda-feira, às 10:00 de Brasília: 3 dias úteis depois é a quinta da mesma semana, sem fim de semana no meio.
 * E1192 (ORDEM-DUET-861): os dias úteis pulam os feriados nacionais, por isso a semana escolhida é a última SEM feriado
 * de segunda a quinta (lista do ensaio, à parte do produto) — senão "segunda + 3 dias úteis" deixava de ser a quinta.
 */
const segundaPassada = () => {
  const d = new Date();
  d.setUTCHours(13, 0, 0, 0);
  const semFeriadoAteQuinta = () => [0, 1, 2, 3].every((n) => diaUtilNoEnsaio(new Date(d.getTime() + n * 24 * HORA).toISOString().slice(0, 10)));
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() !== 1 || !semFeriadoAteQuinta());
  return d;
};

test.describe("T1772 — E1156: o laudo sai no prazo combinado com o avaliador, em dias úteis depois da visita @E1156", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1772-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1772", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    // A chave no piloto, como em produção: o dono e o avaliador na lista.
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1772 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // O pedido do imóvel (vago), com o avaliador escolhido pelo dono e ainda SEM proposta.
    const escolha = new Date(Date.now() - 2 * HORA).toISOString();
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, ocupado: false, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = ped.id as string;
    const d = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: ids.cred, designado_em: escolha });
    if (d.error) throw d.error;
  });

  test.afterAll(async () => {
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    if (ids.pedido) {
      await adm().from("vistoria_fila_admin").delete().eq("pedido_id", ids.pedido);
      await adm().from("vistoria_designacoes").delete().eq("pedido_id", ids.pedido);
    }
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas(contas);
  });

  test("1. o avaliador propõe em dias úteis depois da visita: acima do teto é recusado; com 3, os dois lados leem o compromisso — o dono, antes de aceitar", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    const form = item.getByTestId("proposta-avaliador");
    await expect(form, "o pedido novo traz o formulário da proposta").toBeVisible({ timeout: 30_000 });
    await expect(form).toContainText("Prazo do laudo (dias úteis depois da visita, até 5)");
    // E1192: a tela explica "dias úteis" uma vez, pela nota do calendário único.
    await expect(a.getByTestId("nota-dias-uteis")).toHaveCount(1);
    await expect(a.getByTestId("nota-dias-uteis")).toHaveText("Dias úteis: segunda a sexta, sem feriados nacionais.");
    // Acima do teto: o campo trava no navegador; tirando a trava do campo, o servidor recusa na mesma.
    await form.getByTestId("proposta-valor").fill("380");
    await form.getByTestId("proposta-prazo").evaluate((el) => el.removeAttribute("max"));
    await form.getByTestId("proposta-prazo").fill("6");
    await form.getByTestId("designacao-aceitar").click();
    await expect(a.getByText("Informe o prazo do laudo em dias úteis inteiros, de 1 a 5, contados depois da visita.")).toBeVisible({ timeout: 20_000 });
    expect((await pedido()).proposta_em, "a proposta acima do teto não entra").toBeNull();
    // Dentro do teto: entra, e o avaliador lê o que propôs.
    await form.getByTestId("proposta-valor").fill("380");
    await form.getByTestId("proposta-prazo").fill("3");
    await form.getByTestId("designacao-aceitar").click();
    await expect.poll(async () => (await pedido()).proposta_em, { timeout: 20_000 }).not.toBeNull();
    const p = await pedido();
    expect(p.prazo_laudo_dias_uteis, "o prazo combinado fica no pedido, em dias úteis").toBe(3);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(item.getByTestId("aguarda-aceite-proprietario")).toContainText("laudo em até 3 dias úteis depois da visita", { timeout: 30_000 });
    await a.context().close();
    // O dono vê o compromisso ao lado do valor, antes de aceitar.
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      await expect(proposta, `a ${w} px`).toContainText(/Proposta do avaliador: R\$\s380,00 · laudo em até 3 dias úteis depois da visita/, { timeout: 30_000 });
      await expect(proposta.getByTestId("aceitar-proposta"), "o compromisso está à vista antes do aceite").toBeVisible();
      // E1192: ao lado do prazo em dias úteis, a nota — uma vez na tela do dono.
      await expect(d.getByTestId("nota-dias-uteis"), `a ${w} px`).toHaveCount(1);
      await expect(proposta.getByTestId("nota-dias-uteis"), `a ${w} px`).toHaveText("Dias úteis: segunda a sexta, sem feriados nacionais.");
      await expect(d.getByTestId("avaliacao-dono-pedido")).not.toContainText("48 horas");
      expect(await semRolagemLateral(d), `a ${w} px: sem rolagem lateral`).toBe(true);
      await proposta.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1772-1-dono-antes-de-aceitar-${w}.png` });
    }
    await d.context().close();
  });

  test("2. com a visita marcada o dono lê 'Laudo até DD/MM/AAAA'; com a visita feita, 'o laudo sai até DD/MM/AAAA'", async ({ browser }) => {
    const visita = segundaPassada();
    const quinta = dia(new Date(visita.getTime() + 3 * 24 * HORA).toISOString());
    await mudar({ proposta_aceita_em: new Date(visita.getTime() - 24 * HORA).toISOString(), status: "agendado", agendado_para: visita.toISOString() });
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toContainText(new RegExp(`Combinado com o avaliador: R\\$\\s380,00 · Laudo até ${quinta}\\.`), { timeout: 30_000 });
    await mudar({ status: "realizada", visita_concluida_em: visita.toISOString() });
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("avaliacao-situacao"), `a ${w} px`).toHaveText(`Visita feita: o laudo sai até ${quinta}.`, { timeout: 30_000 });
      await expect(d.getByTestId("avaliacao-dono-pedido")).not.toContainText("48 horas");
      expect(await semRolagemLateral(d), `a ${w} px: sem rolagem lateral`).toBe(true);
      await d.getByTestId("avaliacao-situacao").scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1772-2-dono-visita-feita-${w}.png` });
    }
    await d.context().close();
  });

  test("3. o pedido anterior à regra mantém a promessa que recebeu: 'laudo em 7 dias'", async ({ browser }) => {
    await mudar({ status: "designado", proposta_aceita_em: null, agendado_para: null, visita_concluida_em: null, prazo_laudo_dias_uteis: null, prazo_proposto_dias: 7, proposta_em: new Date(Date.now() - HORA).toISOString() });
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-proposta")).toContainText(/Proposta do avaliador: R\$\s380,00 · laudo em 7 dias/, { timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-proposta")).not.toContainText("dias úteis");
    await d.context().close();
  });

  test("4. o termo do perfil segue o teto: em 'Meus termos', 6 dias é recusado com a mesma frase da proposta; com 5 entra", async ({ browser }) => {
    const termoGravado = async () => {
      const { data, error } = await adm().from("avaliadores_credenciamento").select("prazo_entrega_dias").eq("id", ids.cred).single();
      if (error) throw error;
      return (data as { prazo_entrega_dias: number | null }).prazo_entrega_dias;
    };
    const a = await entrar(browser, avaliador.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const termos = a.getByTestId("meus-termos");
    await expect(termos, "o avaliador ativo tem o painel dos próprios termos").toBeVisible({ timeout: 30_000 });
    const prazo = termos.locator('input[name="prazoEntregaDias"]');
    await expect(prazo, "o campo do perfil trava no teto da proposta").toHaveAttribute("max", "5");
    // Acima do teto: tirando a trava do campo, o servidor recusa na mesma, com a frase da proposta.
    await termos.locator('input[name="valor"]').fill("250");
    await prazo.evaluate((el) => el.removeAttribute("max"));
    await prazo.fill("6");
    await termos.getByRole("button", { name: "Salvar termos" }).click();
    await expect(a.getByText("Informe o prazo do laudo em dias úteis inteiros, de 1 a 5, contados depois da visita.")).toBeVisible({ timeout: 20_000 });
    expect(await termoGravado(), "o termo acima do teto não é gravado").toBeNull();
    // No teto: entra.
    await termos.locator('input[name="valor"]').fill("250");
    await prazo.fill("5");
    await termos.getByRole("button", { name: "Salvar termos" }).click();
    await expect.poll(termoGravado, { timeout: 20_000 }).toBe(5);
    await a.context().close();
  });
});
