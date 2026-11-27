import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1754 — E1153 @E1153 (ORDEM-DUET-651, linha Parceiros, classe A, achado da passagem ao vivo): o dono aceitava a
  proposta do avaliador e os dados ficavam certos, mas o avaliador não era avisado (o aceite mandava o aviso de "visita
  agendada", que o sino só mostra quando o pedido tem data de visita) e nenhum dos lados lia a confirmação combinada.
  Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O dono aceita a proposta (a transição, que já funcionava). Os dois pontos da trava, cada um conferido por si:
      • o aviso dispara: o avaliador tem UM aviso do aceite ligado ao pedido, que leva às Visitas, e nenhum de "visita
        agendada"; e o e-mail do aceite, nos textos do aviso;
      • a frase aparece nos dois lados: "Proposta aceita. Combinem a data da visita." no bloco do dono e na lista do
        avaliador.
   2. O dono: a confirmação continua no bloco depois de recarregar, por cima do combinado e do formulário de data.
      Print a 390 e a 1280 px.
   3. O avaliador: o sino conta o aviso, mostra-o com o imóvel e leva às Visitas; a lista e a tela do pedido leem a
      mesma frase, junto do "agendar". Print a 390 e a 1280 px.
   4. Marcada a data da visita, a frase sai dos dois lados (já não há data por combinar), o combinado e a visita ficam,
      e o aviso de "visita agendada" passa a existir — agora sim.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Conquista";
const FRASE = "Proposta aceita. Combinem a data da visita."; // roteiro aprovado (ORDEM-DUET-651)
const HORA = 3_600_000;
const ROTA_VISITAS = "/dashboard/parceiro/avaliacao#agenda";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1754.${sufixo}@lab.vivanomads.test`, nome: "Dora Aceite", role: "owner" as const };
const avaliador = { email: `aval.t1754.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
// Título curto e sem números: é o que cabe inteiro no assunto do e-mail (a régua tira 4+ dígitos seguidos).
const TITULO = `Lar QA ${sufixo}`;
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const sinoDoParceiro = (p: Page, w: number) => (w === 1280 ? p.getByTestId("topo-parceiro").getByTestId("sino-parceiro") : p.getByTestId("topo-celular").getByTestId("sino-parceiro-celular"));
const painelDoSino = (p: Page, w: number) => (w === 1280 ? p.getByTestId("topo-parceiro").getByTestId("sino-parceiro-painel") : p.getByTestId("topo-celular").getByTestId("sino-parceiro-celular-painel"));

type Aviso = { id: string; titulo: string; url: string | null; lido_em: string | null; resolvido_em: string | null };
const avisosDoAvaliador = async (evento: string) => {
  const { data, error } = await adm().from("avisos").select("id, titulo, url, lido_em, resolvido_em").eq("usuario_id", ids.avaliador).eq("evento", evento).eq("ref_id", ids.pedido);
  if (error) throw error;
  return (data ?? []) as Aviso[];
};
type Email = { assunto: string; corpo: string };
const emailsDoAvaliador = async (evento: string) => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.avaliador).eq("evento", evento)).data ?? []) as Email[];
const linha = async () => (await adm().from("vistoria_pedidos").select("status, avaliador_id, proposta_aceita_em, agendado_para").eq("id", ids.pedido).single()).data!;
const itemDaLista = (a: Page) => a.getByTestId("avaliacoes-visitas").locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);

test.describe("T1754 — E1153: no aceite da proposta, o avaliador é avisado e os dois lados leem a confirmação @E1153", () => {
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
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1754-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    // O cabeçalho do parceiro (com o sino dele) é o da conta que escolheu o papel de parceiro (E668).
    const papel = await adm().from("profiles").update({ papel_ativo: "parceiro", papel_ativo_escolhido_em: new Date().toISOString() }).eq("id", ids.avaliador);
    if (papel.error) throw papel.error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1754", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1754 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // O avaliador escolhido pelo dono já enviou a proposta (R$ 380,00 · laudo em 5 dias), há 10 horas: dentro do prazo.
    const proposta = new Date(Date.now() - 10 * HORA).toISOString();
    const escolha = new Date(Date.now() - 12 * HORA).toISOString();
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = ped.id as string;
    const d = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
    if (d.error) throw d.error;
    // As duas contas começam sem avisos nem e-mails: o que aparecer a seguir é do aceite.
    await adm().from("avisos").delete().in("usuario_id", [ids.dono, ids.avaliador]);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.avaliador]);
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

  test("1. o dono aceita: o aviso dispara ao avaliador (sino e e-mail) e a frase aparece nos dois lados", async ({ browser }) => {
    expect(await avisosDoAvaliador("vistoria_proposta_aceita"), "antes do aceite, nenhum aviso").toHaveLength(0);
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const proposta = d.getByTestId("avaliacao-proposta");
    await expect(proposta).toBeVisible({ timeout: 30_000 });
    await expect(proposta).toContainText("Proposta do avaliador: R$ 380,00 · laudo em 5 dias");
    await expect(d.getByTestId("avaliacao-aceite-confirmado"), "antes do aceite, a confirmação não aparece").toHaveCount(0);
    await proposta.getByTestId("aceitar-proposta").getByRole("button", { name: "Aceitar valor e prazo" }).click();

    // A transição (já funcionava): o aceite fica gravado e o pedido continua com o avaliador.
    await expect.poll(async () => (await linha()).proposta_aceita_em, { timeout: 20_000 }).not.toBeNull();
    const l = await linha();
    expect(l.status).toBe("designado");
    expect(l.avaliador_id).toBe(ids.cred);
    expect(l.agendado_para).toBeNull();
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveText("Combinado com o avaliador: R$ 380,00 · laudo em 5 dias.", { timeout: 20_000 });

    // PONTO 1 — o aviso dispara: um aviso do aceite, ligado ao pedido, por ler, que leva às Visitas.
    await expect.soft.poll(async () => (await avisosDoAvaliador("vistoria_proposta_aceita")).length, { message: "o avaliador recebe o aviso do aceite", timeout: 20_000 }).toBe(1);
    const [aviso] = await avisosDoAvaliador("vistoria_proposta_aceita");
    expect.soft(aviso?.titulo, "o aviso diz o que aconteceu e de que imóvel").toBe(`A sua proposta de avaliação foi aceita · ${TITULO}`);
    expect.soft(aviso?.url, "o aviso leva às Visitas").toBe(ROTA_VISITAS);
    expect.soft(aviso?.lido_em ?? null).toBeNull();
    expect.soft(aviso?.resolvido_em ?? null, "o aviso não nasce resolvido").toBeNull();
    expect.soft(await avisosDoAvaliador("vistoria_agendada"), "no aceite não há visita agendada para avisar").toHaveLength(0);
    // O e-mail do aceite, nos textos do aviso (antes saía "Visita de avaliação agendada", sem haver visita).
    await expect.soft.poll(async () => (await emailsDoAvaliador("vistoria_proposta_aceita")).length, { message: "o e-mail do aceite ao avaliador", timeout: 20_000 }).toBe(1);
    const [email] = await emailsDoAvaliador("vistoria_proposta_aceita");
    expect.soft(email?.assunto).toBe(`A sua proposta de avaliação foi aceita: ${TITULO} · Viva Nomads`);
    expect.soft(email?.assunto?.length ?? 0, "o assunto cabe em 70 caracteres").toBeLessThanOrEqual(70);
    expect.soft(email?.assunto ?? "").not.toMatch(/vistoria_|VIS-\d|VN-[0-9A-F]{6}|\b[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect.soft(email?.corpo ?? "").toContain(`Olá Abel, o proprietário aceitou a sua proposta de avaliação de ${TITULO}. Combinem a data da visita.`);
    expect.soft(email?.corpo ?? "").toContain("Agendar a visita");
    expect.soft(email?.corpo ?? "").toContain(ROTA_VISITAS);
    expect.soft(await emailsDoAvaliador("vistoria_agendada"), "nenhum e-mail de 'visita agendada' no aceite").toHaveLength(0);

    // PONTO 2 — a frase aparece nos dois lados. O dono: no bloco, depois de a tela se redesenhar.
    await expect.soft(d.getByTestId("avaliacao-aceite-confirmado"), "o dono lê a confirmação").toHaveText(FRASE, { timeout: 20_000 });
    await d.context().close();
    // O avaliador: na lista, o pedido está nas Visitas com a mesma frase.
    const a = await entrar(browser, avaliador.email, senha);
    await largura(a, 390);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(itemDaLista(a), "o pedido está nas Visitas").toBeVisible({ timeout: 30_000 });
    await expect.soft(itemDaLista(a).getByTestId("aceite-confirmado"), "o avaliador lê a confirmação").toHaveText(FRASE, { timeout: 20_000 });
    await a.context().close();
  });

  test("2. o dono: a confirmação fica no bloco depois de recarregar, por cima do combinado e do formulário de data", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const confirmacao = d.getByTestId("avaliacao-aceite-confirmado");
      await expect(confirmacao, `a ${w} px`).toHaveText(FRASE, { timeout: 30_000 });
      await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveText("Combinado com o avaliador: R$ 380,00 · laudo em 5 dias.");
      await expect(d.getByTestId("dono-agendar")).toBeVisible();
      await expect(d.getByTestId("avaliacao-proposta"), "a proposta por aceitar já não está na tela").toHaveCount(0);
      const ordem = await d.evaluate(() => {
        const y = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top;
        return { confirmacao: y("avaliacao-aceite-confirmado"), combinado: y("avaliacao-proposta-aceita"), agendar: y("dono-agendar") };
      });
      expect(ordem.confirmacao, "a confirmação vem antes do combinado").toBeLessThan(ordem.combinado);
      expect(ordem.combinado, "e o combinado antes do formulário de data").toBeLessThan(ordem.agendar);
      expect(await semRolagemLateral(d), `a ${w} px: sem rolagem lateral`).toBe(true);
      await confirmacao.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1754-2-dono-${w}.png` });
    }
    await d.context().close();
  });

  test("3. o avaliador: o sino conta o aviso do aceite e leva às Visitas; a lista e a tela do pedido leem a mesma frase", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    for (const w of LARGURAS) {
      // As duas larguras partem do mesmo ponto: o aviso por ler.
      const porLer = await adm().from("avisos").update({ lido_em: null }).eq("usuario_id", ids.avaliador).eq("evento", "vistoria_proposta_aceita");
      if (porLer.error) throw porLer.error;
      await largura(a, w);
      await a.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(sinoDoParceiro(a, w), `a ${w} px: o aviso do aceite conta`).toHaveAttribute("aria-label", "Notificações: 1 não lidas", { timeout: 30_000 });
      await sinoDoParceiro(a, w).click();
      const itens = painelDoSino(a, w).getByTestId("sino-aviso");
      await expect(itens).toHaveCount(1);
      await expect(itens.first()).toHaveText(new RegExp(`A sua proposta de avaliação foi aceita · ${TITULO}`));
      await a.screenshot({ path: `${SAIDA}/t1754-3-sino-${w}.png` });
      // A conferência do estado atual (E1128) não o dá por resolvido: continua lá depois de recarregar.
      expect((await avisosDoAvaliador("vistoria_proposta_aceita"))[0].resolvido_em).toBeNull();

      // O aviso leva às Visitas, onde o pedido está com a confirmação e o formulário de agendar.
      await itens.first().click();
      await expect(a).toHaveURL(/\/dashboard\/parceiro\/avaliacao#agenda$/, { timeout: 30_000 });
      const item = itemDaLista(a);
      await expect(item).toBeVisible({ timeout: 30_000 });
      await expect(item.getByTestId("aceite-confirmado")).toHaveText(FRASE);
      await expect(item.getByTestId("agendar-visita")).toBeVisible();
      await expect(item.getByTestId("aguarda-aceite-proprietario"), "já não espera o aceite").toHaveCount(0);
      const ordem = await item.evaluate((li) => {
        const y = (sel: string) => li.querySelector(sel)!.getBoundingClientRect().top;
        return { confirmacao: y('[data-testid="aceite-confirmado"]'), agendar: y('[data-testid="agendar-visita"]') };
      });
      expect(ordem.confirmacao, "a confirmação vem antes do formulário de agendar").toBeLessThan(ordem.agendar);
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await item.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1754-3-lista-${w}.png` });

      // A tela do pedido: a mesma frase, por cima do "Agendar a visita".
      await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedido}`, { waitUntil: "domcontentloaded" });
      const tela = a.getByTestId("pedido-avaliador");
      await expect(tela.getByTestId("pedido-aceite-confirmado")).toHaveText(FRASE, { timeout: 30_000 });
      await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Aceito pelo proprietário");
      await expect(tela.getByTestId("pedido-agendar")).toBeVisible();
      expect(await semRolagemLateral(a), `a ${w} px, tela do pedido: sem rolagem lateral`).toBe(true);
      await a.screenshot({ path: `${SAIDA}/t1754-3-pedido-${w}.png`, fullPage: true });
    }
    await a.context().close();
  });

  test("4. marcada a data da visita, a frase sai dos dois lados; o combinado e a visita ficam, e o aviso de visita agendada passa a existir", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await largura(a, 1280);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const agendar = itemDaLista(a).getByTestId("agendar-visita");
    await expect(agendar).toBeVisible({ timeout: 30_000 });
    // O campo é o do site (data em texto + hora); colar "AAAA-MM-DDTHH:MM" preenche os dois. Hora de Brasília.
    const dia = new Date(Date.now() + 3 * 86_400_000 - 3 * HORA).toISOString().slice(0, 10);
    await agendar.getByRole("textbox", { name: "Data", exact: true }).fill(`${dia}T10:00`);
    await agendar.getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => (await linha()).status, { timeout: 20_000 }).toBe("agendado");
    expect((await linha()).agendado_para).toBe(`${dia}T13:00:00+00:00`);

    // O avaliador: a visita aparece; a frase "combinem a data" já não.
    await a.reload({ waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    await expect(item.getByTestId("avaliador-visita")).toBeVisible({ timeout: 30_000 });
    await expect(item.getByTestId("aceite-confirmado")).toHaveCount(0);
    // Agora há visita: o aviso de "visita agendada" existe e o sino mostra-o (a regra do E1128 continua a valer).
    await expect.poll(async () => (await avisosDoAvaliador("vistoria_agendada")).length, { timeout: 20_000 }).toBe(1);
    await a.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(sinoDoParceiro(a, 1280)).toHaveAttribute("aria-label", "Notificações: 1 não lidas", { timeout: 30_000 });
    await sinoDoParceiro(a, 1280).click();
    await expect(painelDoSino(a, 1280).getByTestId("sino-aviso").filter({ hasText: "Visita de avaliação agendada" })).toHaveCount(1);
    await a.context().close();

    // O dono: o combinado e a visita ficam; a frase sai.
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-visita")).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveText("Combinado com o avaliador: R$ 380,00 · laudo em 5 dias.");
    await expect(d.getByTestId("avaliacao-aceite-confirmado")).toHaveCount(0);
    await d.context().close();
  });
});
