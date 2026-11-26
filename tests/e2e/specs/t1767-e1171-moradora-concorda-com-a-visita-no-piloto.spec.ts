import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1767 — E1171 @E1171 (ORDEM-DUET-746; BLOQUEADOR da linha Parceiros, achado da passagem ao vivo, perna 5B). No imóvel
  ocupado a visita de avaliação espera a concordância do morador. A página dele (/dashboard/avaliacao-imovel/<pedido>)
  existe, mas perguntava se a avaliação estava ligada para a conta DELE; no piloto quem está na lista é o dono e o
  avaliador. A moradora recebia o aviso "Concorda com a visita de avaliação?", abria a ligação e lia "Página não
  encontrada"; a visita ficava para sempre "aguardando a concordância do morador".
  Como em produção: a chave DESLIGADA (nenhum navegador leva o cookie do laboratório), o dono e o avaliador na lista do
  piloto, a moradora FORA dela. Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O avaliador propõe a data; a moradora recebe o aviso e o e-mail, com a ligação para a página dela; o dono lê
      "Data proposta: a visita fica confirmada quando o morador concordar."
   2. A moradora abre a ligação do aviso a partir da própria conta: a data proposta, "Concordo com a visita em …" e
      "Prefiro outro horário". Sem sessão, a ligação pede o login e volta à mesma página. Quem não é a moradora do
      pedido continua a ler "Página não encontrada": o dono (que está no piloto) e uma conta de fora. Print a 390 e a
      1280 px.
   3. A moradora concorda: o pedido fica com a visita agendada; o dono lê "Visita confirmada." e o avaliador lê
      "Visita agendada"; os dois recebem o aviso da visita.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Cruzeiro da Fortaleza";
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1767.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const avaliador = { email: `aval.t1767.${sufixo}@lab.vivanomads.test`, nome: "Ari Avaliador", role: "tenant" as const };
const moradora = { email: `moradora.t1767.${sufixo}@lab.vivanomads.test`, nome: "Mirela Moradora", role: "tenant" as const };
const estranha = { email: `fora.t1767.${sufixo}@lab.vivanomads.test`, nome: "Estela de Fora", role: "tenant" as const };
const TITULO = `Lar ocupado t1767 ${sufixo}`;
const ids: Record<string, string> = {};
let rotaDaMoradora = "";
let quandoNaTela = "";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const pedido = async () => {
  const { data, error } = await adm().from("vistoria_pedidos").select("status, agendado_para, concordancia_em, ocupado, morador_id").eq("id", ids.pedido).single();
  if (error) throw error;
  return data as { status: string; agendado_para: string | null; concordancia_em: string | null; ocupado: boolean; morador_id: string | null };
};
const avisos = async (usuario: string, evento: string) => {
  const { data, error } = await adm().from("avisos").select("url").eq("usuario_id", usuario).eq("evento", evento).eq("ref_id", ids.pedido);
  if (error) throw error;
  return (data ?? []) as { url: string | null }[];
};
/** "25/10/2026 às 10:00", no horário de Brasília — como a tela escreve (quandoVisita, telas-exibicao.ts). */
const quandoVisita = (iso: string) => {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(new Date(iso));
  return `${f({ day: "2-digit", month: "2-digit", year: "numeric" })} às ${f({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
};

test.describe("T1767 — E1171: a moradora concorda com a visita a partir da própria conta, com a chave no piloto @E1171", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador], ["moradora", moradora], ["estranha", estranha]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1767-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1767", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    // O piloto, como em produção: o dono e o avaliador na lista; a moradora NÃO.
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1767 (laboratório)" });
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
    const contas = [ids.dono, ids.avaliador, ids.moradora, ids.estranha].filter(Boolean);
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

  test("1. o avaliador propõe a data: a moradora recebe o aviso e o e-mail com a ligação para a página dela; o dono lê que falta ela concordar", async ({ browser }) => {
    // A moradora está fora do piloto: é este o caso da passagem ao vivo.
    const { data: lista } = await adm().from("vistoria_piloto").select("user_id").eq("user_id", ids.moradora);
    expect(lista ?? [], "a moradora não está na lista do piloto").toHaveLength(0);
    const a = await entrar(browser, avaliador.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    await expect(item.getByTestId("agendar-visita")).toBeVisible({ timeout: 30_000 });
    await expect(item).toContainText("Imóvel ocupado: a visita só acontece com a concordância do morador.");
    const dia = new Date(Date.now() + 3 * 24 * HORA).toISOString().slice(0, 10);
    // O campo é o do site (data em texto "Data" + seletor de hora): colar "AAAA-MM-DDTHH:MM" no texto preenche os dois.
    await item.getByTestId("agendar-visita").getByRole("textbox", { name: "Data", exact: true }).fill(`${dia}T10:00`);
    await item.getByTestId("agendar-visita").getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => (await pedido()).agendado_para, { timeout: 20_000 }).not.toBeNull();
    const p = await pedido();
    expect(p.status, "ocupado: a data fica proposta, a visita ainda não está agendada").toBe("designado");
    expect(p.concordancia_em).toBeNull();
    quandoNaTela = quandoVisita(p.agendado_para!);
    await a.context().close();
    // O aviso (sino) e o e-mail da moradora levam à página DELA.
    await expect.poll(async () => (await avisos(ids.moradora, "vistoria_concordancia")).map((x) => x.url), { timeout: 20_000 }).toEqual([rotaDaMoradora]);
    await expect
      .poll(async () => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.moradora).eq("evento", "vistoria_concordancia")).data ?? []).map((e) => [String(e.assunto).startsWith("Concorda com a visita de avaliação"), String(e.corpo).includes(rotaDaMoradora)]), { timeout: 20_000 })
      .toEqual([[true, true]]);
    // O dono lê que a visita espera a moradora.
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Data proposta: a visita fica confirmada quando o morador concordar.", { timeout: 30_000 });
    await d.context().close();
  });

  test("2. a moradora abre a ligação do aviso na própria conta: a data proposta, 'Concordo' e 'Prefiro outro horário'; sem sessão, pede o login; quem é de fora lê 'não encontrada'", async ({ browser }) => {
    // Sem sessão: a ligação do e-mail pede o login e guarda a volta à mesma página.
    const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const s = await anon.newPage();
    await s.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(s.url()).pathname, { timeout: 20_000 }).toBe("/auth");
    expect(new URL(s.url()).searchParams.get("redirect"), "o login volta à página da concordância").toBe(rotaDaMoradora);
    await anon.close();
    // Quem não é a moradora deste pedido continua sem página — o dono, mesmo estando no piloto, e uma conta de fora.
    for (const [quem, conta] of [["o dono do pedido", dono], ["uma conta de fora do pedido", estranha]] as const) {
      const x = await entrar(browser, conta.email, senha);
      await x.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
      await expect(x.getByRole("heading", { name: "Página não encontrada" }), `${quem} não abre a concordância da moradora`).toBeVisible({ timeout: 30_000 });
      await expect(x.getByTestId("concordancia")).toHaveCount(0);
      await x.context().close();
    }
    // Com a conta dela (fora do piloto, sem o cookie do laboratório): a página abre.
    const m = await entrar(browser, moradora.email, senha);
    for (const w of LARGURAS) {
      await largura(m, w);
      await m.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
      const cartao = m.getByTestId("concordancia");
      await expect(cartao, `a ${w} px: a página da moradora abre com a chave no piloto`).toBeVisible({ timeout: 30_000 });
      await expect(cartao).toContainText("O avaliador não fotografa os seus pertences. A visita só acontece se você concordar com a data.");
      await expect(cartao.getByTestId("concordar-visita"), `a ${w} px`).toHaveText(`Concordo com a visita em ${quandoNaTela}`);
      await expect(cartao.getByTestId("outro-horario"), `a ${w} px`).toHaveText("Prefiro outro horário");
      // E1173 (asserção alterada, ORDEM-DUET-753): o link passa a abrir a conversa dela com o dono, não a lista geral.
      await expect(cartao.getByTestId("outro-horario")).toHaveAttribute("href", /^\/dashboard\/mensagens\?conversa=[0-9a-f-]{36}$/);
      expect(await semRolagemLateral(m), `a ${w} px: sem rolagem lateral`).toBe(true);
      await m.screenshot({ path: `${SAIDA}/t1767-2-moradora-concorda-${w}.png` });
    }
    await m.context().close();
  });

  test("3. a moradora concorda: a visita fica agendada; o dono lê 'Visita confirmada.' e o avaliador lê 'Visita agendada'", async ({ browser }) => {
    const m = await entrar(browser, moradora.email, senha);
    await m.goto(rotaDaMoradora, { waitUntil: "domcontentloaded" });
    await m.getByTestId("concordancia").getByTestId("concordar-visita").click({ timeout: 30_000 });
    await expect.poll(async () => (await pedido()).status, { timeout: 20_000 }).toBe("agendado");
    expect((await pedido()).concordancia_em).not.toBeNull();
    await expect(m.getByTestId("concordancia-feita")).toHaveText(`Você concordou com a visita em ${quandoNaTela}, horário de Brasília.`, { timeout: 20_000 });
    await expect(m.getByTestId("concordar-visita")).toHaveCount(0);
    await m.context().close();
    // O dono e o avaliador leem o resultado, e os dois recebem o aviso da visita.
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Visita confirmada.", { timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-dono-pedido")).not.toContainText("aguardando a concordância do morador");
    await d.context().close();
    const a = await entrar(browser, avaliador.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    await expect(item).toHaveAttribute("data-status", "agendado", { timeout: 30_000 });
    await expect(item).toContainText("Visita agendada");
    await a.context().close();
    await expect.poll(async () => (await avisos(ids.dono, "vistoria_agendada")).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await avisos(ids.avaliador, "vistoria_agendada")).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  });
});
