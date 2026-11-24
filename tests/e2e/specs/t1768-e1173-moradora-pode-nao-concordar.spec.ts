import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1768 — E1173 @E1173 (ORDENS-DUET 751 e 753; linha Parceiros). No imóvel ocupado a visita de avaliação só acontece com a
  concordância do morador. Ele tinha "Concordo" e um link "Prefiro outro horário" para as mensagens: o "não" não ficava
  registado, e o dono e o avaliador continuavam a ler "aguardando a concordância do morador".
  Agora há "Não posso nesta data": a data sai do pedido, o pedido de concordância fica (é o que as telas leem como
  "não concordou"), e o dono e o avaliador são avisados com a data recusada. Os textos são os das ORDENS-DUET 757 e 759. A recusa NÃO é um reagendamento: a data
  seguinte é um "Agendar" novo, sem gastar a vez de ninguém nem pedir as 24 horas. Ninguém responde por ela.
  Como em produção: a chave DESLIGADA (nenhum navegador leva o cookie do laboratório), o dono e o avaliador na lista do
  piloto, a moradora FORA dela. Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. A moradora diz "Não posso nesta data" na própria conta, a menos de 24 horas da data: fica registado, o aviso
      "Concorda com a visita?" dela fica resolvido, e o dono e o avaliador recebem o aviso e o e-mail com a data recusada.
      Print a 390 e a 1280 px, antes e depois.
   2. Os três lados leem a recusa: ela, o dono e o avaliador. O passo "Agendado" do dono continua por fazer, e o
      formulário do avaliador diz "Agendar" (não "Reagendar"), sem a regra do reagendamento.
   3. O avaliador propõe outra data: entra, não gasta a vez de reagendar de ninguém, e o "não concordou" das partes fica
      resolvido. A moradora é perguntada de novo, concorda, e só então a visita fica agendada — e o aviso dela sai do sino.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Santa Rosa da Serra";
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1768.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const avaliador = { email: `aval.t1768.${sufixo}@lab.vivanomads.test`, nome: "Ari Avaliador", role: "tenant" as const };
const moradora = { email: `moradora.t1768.${sufixo}@lab.vivanomads.test`, nome: "Mirela Moradora", role: "tenant" as const };
const TITULO = `Lar ocupado t1768 ${sufixo}`;
const ids: Record<string, string> = {};
let rotaDaMoradora = "";
let recusadaNaTela = "";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
type Pedido = { status: string; agendado_para: string | null; concordancia_em: string | null; concordancia_pedida_em: string | null; reagendou_dono: boolean; reagendou_avaliador: boolean };
const pedido = async () => {
  const { data, error } = await adm().from("vistoria_pedidos").select("status, agendado_para, concordancia_em, concordancia_pedida_em, reagendou_dono, reagendou_avaliador").eq("id", ids.pedido).single();
  if (error) throw error;
  return data as Pedido;
};
const avisos = async (usuario: string, evento: string) => {
  const { data, error } = await adm().from("avisos").select("url, resolvido_em").eq("usuario_id", usuario).eq("evento", evento).eq("ref_id", ids.pedido);
  if (error) throw error;
  return (data ?? []) as { url: string | null; resolvido_em: string | null }[];
};
/** O avaliador propõe uma data pelo formulário dele (o botão diz "Agendar" ou "Reagendar", conforme o pedido tem data). */
async function avaliadorPropoe(a: Page, dia: string, hora: string, botao: "Agendar" | "Reagendar") {
  await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
  const form = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`).getByTestId("agendar-visita");
  await expect(form.getByRole("button", { name: botao, exact: true })).toBeVisible({ timeout: 30_000 });
  // O campo é o do site (data em texto "Data" + seletor de hora): colar "AAAA-MM-DDTHH:MM" no texto preenche os dois.
  await form.getByRole("textbox", { name: "Data", exact: true }).fill(`${dia}T${hora}`);
  await form.getByRole("button", { name: botao, exact: true }).click();
}
const daquiA = (dias: number) => new Date(Date.now() + dias * 24 * HORA).toISOString().slice(0, 10);
/** "25/10/2026 às 10:00", no horário de Brasília — como a tela escreve (quandoVisita, telas-exibicao.ts). */
const quandoVisita = (iso: string) => {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(new Date(iso));
  return `${f({ day: "2-digit", month: "2-digit", year: "numeric" })} às ${f({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
};

test.describe("T1768 — E1173: a moradora pode não concordar com a data, e os três lados leem a recusa @E1173", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador], ["moradora", moradora]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1768-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1768", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    // O piloto, como em produção: o dono e o avaliador na lista; a moradora NÃO.
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1768 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // O pedido do imóvel OCUPADO pela moradora, com a proposta do avaliador aceita pelo dono e ainda sem data de visita.
    const escolha = new Date(Date.now() - 30 * HORA).toISOString();
    const proposta = new Date(Date.now() - 28 * HORA).toISOString();
    const aceite = new Date(Date.now() - 26 * HORA).toISOString();
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, ocupado: true, morador_id: ids.moradora, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta, proposta_aceita_em: aceite })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = ped.id as string;
    const d = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
    if (d.error) throw d.error;
    rotaDaMoradora = `/dashboard/avaliacao-imovel/${ids.pedido}`;
  });

  test.afterAll(async () => {
    const contas = [ids.dono, ids.avaliador, ids.moradora].filter(Boolean);
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

  test("1. a moradora diz 'Não posso nesta data' na própria conta: fica registado, o aviso dela fica resolvido e o dono e o avaliador são avisados com a data recusada", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await avaliadorPropoe(a, daquiA(3), "10:00", "Agendar");
    await expect.poll(async () => (await pedido()).agendado_para, { timeout: 20_000 }).not.toBeNull();
    await a.context().close();
    await expect.poll(async () => (await avisos(ids.moradora, "vistoria_concordancia")).map((x) => [x.url, x.resolvido_em]), { timeout: 20_000 }).toEqual([[rotaDaMoradora, null]]);
    // A visita aproxima-se: faltam 10 horas. É o caso em que a regra do reagendamento (24 horas) fecharia o caminho.
    const perto = new Date(Math.ceil((Date.now() + 10 * HORA) / 60_000) * 60_000).toISOString();
    const mov = await adm().from("vistoria_pedidos").update({ agendado_para: perto }).eq("id", ids.pedido);
    if (mov.error) throw mov.error;
    recusadaNaTela = quandoVisita(perto);
    const m = await entrar(browser, moradora.email, senha);
    for (const w of LARGURAS) {
      await largura(m, w);
      await m.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
      const cartao = m.getByTestId("concordancia");
      await expect(cartao.getByTestId("concordar-visita"), `a ${w} px`).toHaveText(`Concordo com a visita em ${recusadaNaTela}`, { timeout: 30_000 });
      await expect(cartao.getByTestId("nao-concordar-visita"), `a ${w} px: a moradora tem onde dizer que não`).toHaveText("Não posso nesta data");
      // "Prefiro outro horário" abre a conversa dela com o dono, não a lista geral das mensagens.
      await expect(cartao.getByTestId("outro-horario")).toHaveAttribute("href", /^\/dashboard\/mensagens\?conversa=[0-9a-f-]{36}$/);
      expect(await semRolagemLateral(m), `a ${w} px: sem rolagem lateral`).toBe(true);
      await m.screenshot({ path: `${SAIDA}/t1768-1-antes-de-responder-${w}.png` });
    }
    await m.getByTestId("concordancia").getByTestId("nao-concordar-visita").click();
    await expect.poll(async () => (await pedido()).agendado_para, { timeout: 20_000, message: "a recusa limpa a data proposta" }).toBeNull();
    const p = await pedido();
    expect(p.status, "o pedido continua com o avaliador: a recusa não o devolve ao dono").toBe("designado");
    expect(p.concordancia_pedida_em, "o pedido de concordância fica: é ele que diz 'recusou'").not.toBeNull();
    expect(p.concordancia_em).toBeNull();
    expect([p.reagendou_dono, p.reagendou_avaliador], "a recusa não gasta a vez de reagendar de ninguém").toEqual([false, false]);
    for (const w of LARGURAS) {
      await largura(m, w);
      await m.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
      await expect(m.getByTestId("concordancia-recusada"), `a ${w} px`).toHaveText("Avisamos o proprietário e o avaliador. A nova data chega por aqui.", { timeout: 30_000 });
      await expect(m.getByTestId("concordar-visita")).toHaveCount(0);
      await expect(m.getByTestId("nao-concordar-visita")).toHaveCount(0);
      expect(await semRolagemLateral(m), `a ${w} px: sem rolagem lateral`).toBe(true);
      await m.screenshot({ path: `${SAIDA}/t1768-1-depois-de-recusar-${w}.png` });
    }
    await m.context().close();
    // Ela respondeu: o aviso "Concorda com a visita?" fica resolvido (sai do sino).
    await expect.poll(async () => (await avisos(ids.moradora, "vistoria_concordancia")).every((x) => x.resolvido_em !== null), { timeout: 20_000 }).toBe(true);
    // O dono e o avaliador são avisados, cada um na sua página, e o e-mail diz a data que ela recusou.
    await expect.poll(async () => (await avisos(ids.dono, "vistoria_concordancia_recusada")).map((x) => [x.url, x.resolvido_em]), { timeout: 20_000 }).toEqual([[`/dashboard/imoveis/${ids.imovel}/nivel#avaliacao`, null]]);
    await expect.poll(async () => (await avisos(ids.avaliador, "vistoria_concordancia_recusada")).map((x) => [x.url, x.resolvido_em]), { timeout: 20_000 }).toEqual([["/dashboard/parceiro/avaliacao", null]]);
    // No e-mail a data vem sem o ano ("25/11 às 10:00"); o dono e o avaliador leem o mesmo passo: os dois podem propor a data.
    const noEmail = recusadaNaTela.replace(/\/\d{4} às /, " às ");
    for (const [quem, passo] of [[ids.dono, "Proponha outra data na Viva."], [ids.avaliador, "Proponha outra data na Viva."]] as const) {
      await expect
        .poll(async () => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", quem).eq("evento", "vistoria_concordancia_recusada")).data ?? []).map((e) => [String(e.assunto).startsWith("O morador não pode na data da visita"), String(e.corpo).includes(`(${noEmail}, horário de Brasília)`), String(e.corpo).includes(passo)]), { timeout: 20_000 })
        .toEqual([[true, true, true]]);
    }
  });

  test("2. os três lados leem a recusa; o passo 'Agendado' continua por fazer e o avaliador tem 'Agendar', sem a regra do reagendamento", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("avaliacao-situacao"), `a ${w} px`).toHaveText("O morador não pode na data proposta. Proponha outra data ao avaliador.", { timeout: 30_000 });
      await expect(d.getByTestId("avaliacao-dono-pedido")).not.toContainText("aguardando a concordância do morador");
      await expect(d.getByTestId("avaliacao-aceite-confirmado"), "com a recusa, sai o 'Combinem a data da visita.' genérico").toHaveCount(0);
      await expect(d.getByTestId("avaliacao-visita"), "sem data, a linha da visita não existe").toHaveCount(0);
      await expect(d.getByTestId("etapa-agendado"), "ninguém marca o 'Agendado' por ela").not.toHaveAttribute("data-estado", "feito");
      expect(await semRolagemLateral(d), `a ${w} px: sem rolagem lateral`).toBe(true);
      await d.locator('[data-testid="avaliacao-situacao"]').scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1768-2-dono-${w}.png` });
    }
    await d.context().close();
    const a = await entrar(browser, avaliador.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
      await expect(item.getByTestId("avaliador-concordancia-recusada"), `a ${w} px`).toHaveText("O morador não pode na data proposta. Proponha outra data.", { timeout: 30_000 });
      await expect(item).toHaveAttribute("data-status", "designado");
      await expect(item.getByTestId("avaliador-visita")).toHaveCount(0);
      await expect(item.getByTestId("agendar-visita").getByRole("button", { name: "Agendar", exact: true })).toBeVisible();
      await expect(item.getByTestId("regra-reagendar"), "não é um reagendamento").toHaveCount(0);
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await item.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1768-2-avaliador-${w}.png` });
    }
    // A tela do pedido do avaliador lê a mesma frase.
    await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedido}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-concordancia-recusada")).toHaveText("O morador não pode na data proposta. Proponha outra data.", { timeout: 30_000 });
    await a.context().close();
  });

  test("3. a data nova entra como 'Agendar', sem gastar a vez de ninguém; a moradora é perguntada de novo, concorda, e só então a visita fica agendada", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await avaliadorPropoe(a, daquiA(4), "14:00", "Agendar");
    await expect.poll(async () => (await pedido()).agendado_para, { timeout: 20_000, message: "a data nova entra, mesmo a menos de 24 horas da data recusada" }).not.toBeNull();
    await a.context().close();
    const p = await pedido();
    expect([p.reagendou_dono, p.reagendou_avaliador], "a proposta depois da recusa não é um reagendamento").toEqual([false, false]);
    expect(p.status, "com data nova, a visita ainda espera a moradora").toBe("designado");
    expect(p.concordancia_em).toBeNull();
    const nova = quandoVisita(p.agendado_para!);
    // O "não concordou" que as partes leram deixa de valer; a moradora é perguntada de novo.
    for (const quem of [ids.dono, ids.avaliador]) {
      await expect.poll(async () => (await avisos(quem, "vistoria_concordancia_recusada")).every((x) => x.resolvido_em !== null), { timeout: 20_000 }).toBe(true);
    }
    await expect.poll(async () => (await avisos(ids.moradora, "vistoria_concordancia")).filter((x) => x.resolvido_em === null).length, { timeout: 20_000 }).toBe(1);
    // O e-mail dela diz que é uma NOVA data (não repete o da primeira proposta).
    await expect
      .poll(async () => ((await adm().from("emails_teste").select("assunto").eq("usuario_id", ids.moradora).eq("evento", "vistoria_concordancia")).data ?? []).map((e) => String(e.assunto).startsWith("Concorda com a nova data da visita")).sort(), { timeout: 20_000 })
      .toEqual([false, true]);
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Data proposta: a visita fica confirmada quando o morador concordar.", { timeout: 30_000 });
    const m = await entrar(browser, moradora.email, senha);
    await m.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("concordar-visita")).toHaveText(`Concordo com a visita em ${nova}`, { timeout: 30_000 });
    await m.getByTestId("concordar-visita").click();
    await expect.poll(async () => (await pedido()).status, { timeout: 20_000 }).toBe("agendado");
    await expect(m.getByTestId("concordancia-feita")).toHaveText(`Você concordou com a visita em ${nova}, horário de Brasília.`, { timeout: 20_000 });
    await m.context().close();
    // O ponto do sino: depois de ela concordar, nenhum "Concorda com a visita?" fica por resolver.
    await expect.poll(async () => (await avisos(ids.moradora, "vistoria_concordancia")).every((x) => x.resolvido_em !== null), { timeout: 20_000 }).toBe(true);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Visita confirmada.", { timeout: 30_000 });
    await d.context().close();
    // Os avisos da visita confirmada ficam por ler: o "Concordo" resolve os antigos antes de gravar estes.
    for (const quem of [ids.dono, ids.avaliador]) {
      await expect.poll(async () => (await avisos(quem, "vistoria_agendada")).filter((x) => x.resolvido_em === null).length, { timeout: 20_000 }).toBe(1);
    }
  });
});
