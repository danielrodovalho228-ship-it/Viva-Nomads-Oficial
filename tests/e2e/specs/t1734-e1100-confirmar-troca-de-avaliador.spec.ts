import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1734 — E1100 @E1100 (ORDEM-DUET-465, classe A): "Escolher outro avaliador" descartava o avaliador escolhido e a
  proposta viva num clique, sem confirmação, sem abrir a escolha e sem volta. Só contas de teste; cidades próprias do spec.
   1. Com outro avaliador na cidade: o primeiro clique NÃO descarta nada; abre a confirmação, que escreve o que se perde
      (o avaliador, a proposta com valor e prazo, "não dá para desfazer") e diz que há 1 outro para escolher. "Manter esta
      proposta" fecha e nada muda. Confirmando, o pedido volta à escolha, a tela avisa e mostra a lista com o OUTRO
      avaliador (o descartado não volta). Print a 390 e a 1280 px.
   2. Sem outro avaliador na cidade (o caso que matou a massa da fatia 4): a confirmação avisa ANTES do clique que o
      pedido vai ficar aguardando; confirmando, a tela diz que não há outro agora.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE_A = "Patrocínio";
const CIDADE_B = "Monte Carmelo";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1734.${sufixo}@lab.vivanomads.test`, nome: "Dora Troca", role: "owner" as const };
const escolhido = { email: `esc.t1734.${sufixo}@lab.vivanomads.test`, nome: "Elias Escolhido", role: "tenant" as const };
const reserva = { email: `res.t1734.${sufixo}@lab.vivanomads.test`, nome: "Rita Reserva", role: "tenant" as const };
const unico = { email: `uni.t1734.${sufixo}@lab.vivanomads.test`, nome: "Ugo Único", role: "tenant" as const };
const ids: Record<string, string> = {};
const numeros: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}

/** Avaliador credenciado ativo na cidade, dentro do piloto (como na t1722 e na t1732). */
async function credenciar(chave: string, conta: { nome: string }, uid: string, cidade: string) {
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: uid, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `${chave}-t1734-${sufixo}`, categorias: ["fotografia"], cidades: [cidade] })
    .select("id")
    .single();
  if (eP) throw eP;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  numeros[chave] = n as string;
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade, numero_credenciado: numeros[chave], status: "ativo", experiencia_link: `https://portfolio.lab.vivanomads.test/t1734-${chave}`, conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`cred_${chave}`] = cred.id as string;
  const pa = await adm().from("vistoria_piloto").insert({ user_id: uid, nota: "T1734 (laboratório)" });
  if (pa.error) throw pa.error;
}

/**
 * O pedido já com o avaliador escolhido e a proposta dele viva (R$ 380,00 · laudo em 5 dias), à espera do aceite do dono.
 * `teste: true` como o pedido que a própria tela abre para um dono de conta de teste (só assim os avaliadores de conta de
 * teste entram na lista; em imóvel real eles ficam fora).
 */
async function pedidoComProposta(imovel: string, cidade: string, cred: string): Promise<string> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: cred, designado_em: agora, escolhido_em: agora, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: cred, designado_em: agora, resposta: "aceita", respondido_em: agora });
  if (d.error) throw d.error;
  return data.id as string;
}

const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, valor_proposto, proposta_em, aguardando_avaliador").eq("id", pedido).single()).data!;

test.describe("T1734 — E1100: 'Escolher outro avaliador' pede confirmação e leva à escolha do novo @E1100", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["escolhido", escolhido], ["reserva", reserva], ["unico", unico]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    await credenciar("escolhido", escolhido, ids.escolhido, CIDADE_A);
    await credenciar("reserva", reserva, ids.reserva, CIDADE_A);
    await credenciar("unico", unico, ids.unico, CIDADE_B);
    ids.imovelA = await criarImovelPronto(ids.dono, `Casa A t1734 ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Casa B t1734 ${sufixo}`, { ativo: true });
    const a = await adm().from("properties").update({ city: CIDADE_A }).eq("id", ids.imovelA);
    const b = await adm().from("properties").update({ city: CIDADE_B }).eq("id", ids.imovelB);
    if (a.error ?? b.error) throw a.error ?? b.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert([CIDADE_A, CIDADE_B].flatMap((cidade) => ["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade, porte, valor: porte === "q1_2" ? 350 : 300 }))));
    if (eT) throw eT;
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1734 (laboratório)" });
    if (p.error) throw p.error;
    ids.pedidoA = await pedidoComProposta(ids.imovelA, CIDADE_A, ids.cred_escolhido);
    ids.pedidoB = await pedidoComProposta(ids.imovelB, CIDADE_B, ids.cred_unico);
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelA, ids.imovelB].filter(Boolean);
    const pedidos = [ids.pedidoA, ids.pedidoB].filter(Boolean);
    if (pedidos.length) {
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().in("cidade", [CIDADE_A, CIDADE_B]);
    const contas = [ids.dono, ids.escolhido, ids.reserva, ids.unico].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    const creds = [ids.cred_escolhido, ids.cred_reserva, ids.cred_unico].filter(Boolean);
    if (creds.length) {
      await adm().from("vistoria_designacoes").delete().in("avaliador_id", creds);
      await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    }
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. há outro avaliador: o clique abre a confirmação com o que se perde; 'Manter' não muda nada; confirmar leva à escolha do outro", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovelA}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      await expect(proposta).toBeVisible({ timeout: 30_000 });
      await expect(proposta).toContainText("Proposta do avaliador: R$ 380,00 · laudo em 5 dias");

      // O primeiro clique só abre a confirmação: o pedido continua com o avaliador e a proposta.
      await proposta.getByTestId("trocar-avaliador").click();
      const conf = proposta.getByTestId("troca-confirmacao");
      await expect(conf).toBeVisible();
      await expect(conf.getByTestId("troca-titulo")).toHaveText("Escolher outro avaliador?");
      await expect(conf.getByTestId("troca-titulo")).toBeFocused(); // o foco vai para a confirmação (teclado e leitor de tela)
      await expect(conf.getByTestId("troca-perde").locator("li")).toHaveText([
        `O avaliador nº ${numeros.escolhido} sai deste pedido e não volta a aparecer na lista.`,
        "A proposta dele é descartada: R$ 380,00 · laudo em 5 dias.",
        "Não dá para desfazer.",
      ]);
      await expect(conf.getByTestId("troca-depois")).toHaveText(`Depois, você escolhe o novo avaliador: há 1 disponível em ${CIDADE_A}.`);
      await expect(conf.getByRole("button", { name: "Descartar e escolher outro" })).toBeVisible();
      const antes = await linha(ids.pedidoA);
      expect(antes.status).toBe("designado");
      expect(antes.avaliador_id).toBe(ids.cred_escolhido);
      expect(Number(antes.valor_proposto)).toBe(380);
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await d.screenshot({ path: `${SAIDA}/t1734-1-confirmacao-${w}.png`, fullPage: true });

      // "Manter esta proposta": fecha a confirmação e nada muda.
      await conf.getByRole("button", { name: "Manter esta proposta" }).click();
      await expect(proposta.getByTestId("troca-confirmacao")).toHaveCount(0);
      await expect(proposta.getByTestId("trocar-avaliador")).toBeVisible();
      await expect(proposta.getByTestId("trocar-avaliador")).toBeFocused(); // e volta ao botão que a abriu
      await expect(proposta.getByRole("button", { name: "Aceitar valor e prazo" })).toBeVisible();
      expect((await linha(ids.pedidoA)).status).toBe("designado");
    }

    // Agora confirma (a 1280 px): o pedido volta à escolha e a tela leva o dono à lista, com o OUTRO avaliador.
    const proposta = d.getByTestId("avaliacao-proposta");
    await proposta.getByTestId("trocar-avaliador").click();
    await proposta.getByTestId("troca-confirmacao").getByRole("button", { name: "Descartar e escolher outro" }).click();
    await expect.poll(async () => (await linha(ids.pedidoA)).status, { timeout: 20_000 }).toBe("pedido");
    const depois = await linha(ids.pedidoA);
    expect(depois.avaliador_id).toBeNull();
    expect(depois.valor_proposto).toBeNull();
    expect(depois.proposta_em).toBeNull();
    expect(depois.aguardando_avaliador).toBe(false);
    await expect(d.getByTestId("troca-feita")).toHaveText("Avaliador e proposta descartados. Escolha o novo avaliador na lista abaixo.", { timeout: 20_000 });
    await expect(d.getByTestId("troca-feita")).toBeFocused();
    await expect(d.getByTestId("avaliacao-proposta")).toHaveCount(0);
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible();
    await expect(escolha).toBeInViewport();
    const cartoes = escolha.getByTestId("avaliacao-sugerido");
    await expect(cartoes).toHaveCount(1);
    await expect(cartoes.first()).toContainText(reserva.nome);
    await expect(escolha).not.toContainText(escolhido.nome);
    for (const w of LARGURAS) {
      await largura(d, w);
      await expect(escolha).toBeVisible();
      await d.screenshot({ path: `${SAIDA}/t1734-1-depois-${w}.png`, fullPage: true });
    }
    await d.context().close();
  });

  test("2. não há outro avaliador: a confirmação avisa antes; confirmando, a tela diz que o pedido fica aguardando", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelB}/nivel`, { waitUntil: "domcontentloaded" });
    const proposta = d.getByTestId("avaliacao-proposta");
    await expect(proposta).toBeVisible({ timeout: 30_000 });
    await proposta.getByTestId("trocar-avaliador").click();
    const conf = proposta.getByTestId("troca-confirmacao");
    await expect(conf.getByTestId("troca-depois")).toHaveText(
      // E1177 (asserção alterada, ORDEM-DUET-778): sem a promessa do aviso.
      `Atenção: não há outro avaliador disponível em ${CIDADE_B} agora. Se você descartar, o pedido fica aguardando e a equipe da Viva é avisada.`,
    );
    await expect(conf.getByTestId("troca-depois")).toHaveAttribute("data-sem-outro", "1");
    expect((await linha(ids.pedidoB)).status).toBe("designado");
    await d.screenshot({ path: `${SAIDA}/t1734-2-sem-outro-390.png`, fullPage: true });

    await conf.getByRole("button", { name: "Descartar e escolher outro" }).click();
    await expect.poll(async () => (await linha(ids.pedidoB)).status, { timeout: 20_000 }).toBe("pedido");
    expect((await linha(ids.pedidoB)).aguardando_avaliador).toBe(true);
    await expect(d.getByTestId("troca-feita")).toHaveText("Avaliador e proposta descartados. Não há outro avaliador disponível agora. A equipe da Viva foi avisada.", { timeout: 20_000 });
    // E1177 (asserção alterada, ORDEM-DUET-778): a lista vazia diz o motivo — o único avaliador da cidade já foi escolhido neste pedido.
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Os avaliadores da sua cidade já foram escolhidos neste pedido e não continuam nele. A equipe da Viva foi avisada.");
    await expect(d.getByTestId("avaliacao-escolha")).toHaveCount(0);
    await d.context().close();
  });
});
