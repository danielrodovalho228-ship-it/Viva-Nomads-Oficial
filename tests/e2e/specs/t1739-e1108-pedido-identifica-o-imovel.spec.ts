import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1739 — E1108 @E1108 (ORDEM-DUET-491): o detalhe do pedido do avaliador.
   (a) Valores escondidos: a tela tratava todo pedido "de teste" como "sem valor". No piloto o pedido também é de teste
       (a conta do dono é de teste), mas o dono escolheu e o avaliador propôs: os valores têm de aparecer.
   (b) Identificação: o detalhe e a linha da lista não diziam de que imóvel era o pedido. Passam a mostrar o título do
       anúncio e o código VN que o imóvel já tem.
  Cenário do piloto, como em produção: chave desligada (sem o cookie do laboratório), contas de teste na lista do
  piloto. Massa e cidade próprias (Ituiutaba). Os dois pedidos do piloto são da MESMA cidade e do MESMO porte.
   1. Pedido do piloto com a proposta submetida: "Proposta enviada: R$ 250,00 em 2 dias" (nunca "sem valor a
      receber"), com o título e o código VN do imóvel. A 390 e a 1280 px.
   2. Depois do aceite do dono: o estado aceito com os mesmos valores — "Você recebe R$ 250,00" e "Laudo em 2 dias" —,
      com o título e o código VN.
   3. A avaliação de teste do credenciamento (sem escolha do dono, sem proposta) segue "Avaliação de teste: sem valor a
      receber"; também diz o imóvel.
   4. Na lista, cada linha diz o imóvel (título + código): os dois pedidos da mesma cidade e porte ficam distinguíveis;
      a linha do piloto mostra o valor e o prazo propostos e a do credenciamento diz "avaliação de teste". A tela da
      visita agendada também diz o imóvel.
  ORDEM-DUET-546: os títulos da massa são FIXOS (sem o sufixo aleatório, que mudava a largura do título de corrida para
  corrida). O do caso 2 ("Sobrado do Ipê Alto") tem a largura medida para que, a 390 px, a linha acabe a meio do código
  VN: sem o `whitespace-nowrap`, o código parte-se em duas linhas para qualquer código (medido com os mais estreitos e
  os mais largos; o título cabe numa janela de uns 38 px e este fica a meio dela). Assim a guarda de tela morde em toda
  corrida, e o caso 2 confere a própria massa antes de conferir o código: se o desenho da tela mudar e a massa deixar de
  forçar a quebra, o caso falha a dizer isso, em vez de passar sem guardar nada.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Ituiutaba";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1739.${sufixo}@lab.vivanomads.test`, nome: "Dora Imóvel", role: "owner" as const };
const aval = { email: `av.t1739.${sufixo}@lab.vivanomads.test`, nome: "Ari Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const imoveis: string[] = [];
type Caso = "proposta" | "aceito" | "credenciamento" | "agendado";
const pedidos = {} as Record<Caso, string>;
const imovelDe = {} as Record<Caso, { id: string; titulo: string }>;
const ROTA = "/dashboard/parceiro/avaliacao";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
const ha = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();
/** O código VN que o imóvel já tem em todo o site: "VN-" + os 6 primeiros caracteres do id, em maiúsculas. */
const codigoVN = (id: string) => `VN-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
/** O que a tela tem de dizer: "Título do anúncio · VN-XXXXXX". */
const identificacao = (c: Caso) => `${imovelDe[c].titulo} · ${codigoVN(imovelDe[c].id)}`;

async function pedidoDoAvaliador(caso: Caso, nome: string, campos: Record<string, unknown>, resposta: null | "aceita"): Promise<void> {
  // ORDEM-DUET-546: título fixo (o sufixo aleatório ficou só nas contas). Quem distingue as corridas é o id do imóvel.
  const imovel = await criarImovelPronto(ids.dono, `[TESTE QA] t1739 ${nome}`, { ativo: true });
  imoveis.push(imovel);
  const up = await adm().from("properties").update({ city: CIDADE }).eq("id", imovel).select("title").single();
  if (up.error) throw up.error;
  imovelDe[caso] = { id: imovel, titulo: String(up.data.title) };
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, teste: true, ...campos })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e2 } = await adm()
    .from("vistoria_designacoes")
    .insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: campos.designado_em, resposta, respondido_em: resposta ? new Date().toISOString() : null });
  if (e2) throw e2;
  pedidos[caso] = data.id as string;
}
const item = (page: Page, id: string) => page.locator(`[data-testid="avaliacao-designada"][data-pedido="${id}"]`);

test.describe("T1739 — E1108: o pedido do avaliador mostra os valores do piloto e identifica o imóvel @E1108", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-t1739-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1739", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1739 (laboratório)" });
      if (p.error) throw p.error;
    }
    // Piloto: de teste (a conta do dono é de teste) E escolhido pelo dono, com a proposta do avaliador submetida.
    const proposta = { valor_proposto: 250, prazo_proposto_dias: 2 };
    await pedidoDoAvaliador("proposta", "Casa das Acácias", { designado_em: ha(3), escolhido_em: ha(3), ...proposta, proposta_em: ha(1) }, "aceita");
    await fotosReais(imovelDe.proposta.id, ids.dono); // a capa do pedido carrega de verdade (o print mostra a tela como ela é)
    // O mesmo, com o aceite do dono. Mesma cidade e mesmo porte do anterior: só o imóvel os distingue.
    await pedidoDoAvaliador("aceito", "Sobrado do Ipê Alto", { designado_em: ha(5), escolhido_em: ha(5), ...proposta, proposta_em: ha(4), proposta_aceita_em: ha(2) }, "aceita");
    await fotosReais(imovelDe.aceito.id, ids.dono);
    // A avaliação de teste do credenciamento: de teste, o admin designou (sem escolha do dono) e não há proposta.
    await pedidoDoAvaliador("credenciamento", "Apartamento de teste", { designado_em: ha(1) }, null);
    // Uma visita agendada (a tela da visita).
    await pedidoDoAvaliador(
      "agendado",
      "Chácara da Serra",
      { status: "agendado", designado_em: ha(50), escolhido_em: ha(50), valor_proposto: 300, prazo_proposto_dias: 3, proposta_em: ha(40), proposta_aceita_em: ha(30), agendado_para: new Date(Date.now() + 2 * 86_400_000).toISOString() },
      "aceita",
    );
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

  test("1. piloto com a proposta submetida: 'Proposta enviada: R$ 250,00 em 2 dias', com o título e o código VN, a 390 e a 1280 px", async ({ browser }) => {
    // ORDEM-DUET-546: antes o título levava um sufixo aleatório ("Casa das Acácias .+"); agora é fixo.
    expect(identificacao("proposta"), "a massa: título do anúncio + código VN").toMatch(/^\[TESTE QA\] t1739 Casa das Acácias · VN-[A-Z0-9]{6}$/);
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto(`${ROTA}/${pedidos.proposta}`, { waitUntil: "domcontentloaded" });
      const tela = a.getByTestId("pedido-avaliador");
      await expect(tela).toHaveAttribute("data-etapa", "proposta_enviada", { timeout: 30_000 });
      // (a) os valores que o avaliador submeteu estão à vista; o pedido do piloto não é "sem valor".
      await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Proposta enviada: R$ 250,00 em 2 dias");
      await expect(tela).not.toContainText("sem valor a receber");
      await expect(tela).not.toContainText("Você recebe");
      // (b) de que imóvel é: o título do anúncio e o código VN.
      await expect(tela.getByTestId("pedido-imovel")).toHaveText(identificacao("proposta"));
      await expect.poll(() => tela.getByTestId("pedido-capa").locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await semRolagemLateral(a);
      await tela.screenshot({ path: `${SAIDA}/t1739-1-proposta-enviada-${w}.png` });
    }
    await a.context().close();
  });

  test("2. depois do aceite do dono: 'Você recebe R$ 250,00' e 'Laudo em 2 dias' — os mesmos valores —, com o título e o código VN", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto(`${ROTA}/${pedidos.aceito}`, { waitUntil: "domcontentloaded" });
      const tela = a.getByTestId("pedido-avaliador");
      await expect(tela).toHaveAttribute("data-etapa", "aceito", { timeout: 30_000 });
      await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Você recebe R$ 250,00");
      await expect(tela.getByTestId("pedido-prazo-laudo")).toHaveText("Laudo em 2 dias");
      await expect(tela).not.toContainText("sem valor a receber");
      await expect(tela.getByTestId("pedido-imovel")).toHaveText(identificacao("aceito"));
      // O código VN fica inteiro numa linha (a 390 px o hífen partia-o em duas).
      const codigo = tela.getByTestId("pedido-imovel").locator("span");
      if (w === 390) {
        // ORDEM-DUET-546: primeiro a massa. Com a quebra normal (só nesta leitura, e reposta a seguir), o título fixo
        // tem de deixar o código partido em duas linhas; se não deixar, a conferência de baixo não guarda nada.
        const semProtecao = await codigo.evaluate((el: HTMLElement) => {
          const antes = el.style.whiteSpace;
          el.style.whiteSpace = "normal";
          const linhas = el.getClientRects().length;
          el.style.whiteSpace = antes;
          return linhas;
        });
        expect(semProtecao, "a massa força a quebra a 390 px: sem a proteção, o código VN parte-se em duas linhas (se falhar aqui, a tela mudou de largura e o título fixo da massa precisa de ser medido de novo)").toBe(2);
      }
      expect(await codigo.evaluate((el) => el.getClientRects().length), "o código VN numa linha só").toBe(1);
      await expect.poll(() => tela.getByTestId("pedido-capa").locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await semRolagemLateral(a);
      await tela.screenshot({ path: `${SAIDA}/t1739-2-aceito-${w}.png` });
    }
    await a.context().close();
  });

  test("3. a avaliação de teste do credenciamento segue 'Avaliação de teste: sem valor a receber' — e também diz o imóvel", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA}/${pedidos.credenciamento}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Avaliação de teste: sem valor a receber");
    await expect(tela.getByTestId("pedido-prazo-laudo")).toHaveCount(0);
    await expect(tela).not.toContainText("Valor de referência");
    await expect(tela.getByTestId("pedido-imovel")).toHaveText(identificacao("credenciamento"));
    await a.context().close();
  });

  test("4. na lista, cada linha diz o imóvel: os dois pedidos da mesma cidade e porte ficam distinguíveis; a visita também diz o imóvel", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto(ROTA, { waitUntil: "domcontentloaded" });
      await expect(item(a, pedidos.proposta), "a lista carregou").toBeVisible({ timeout: 30_000 });
      for (const c of ["proposta", "aceito", "credenciamento", "agendado"] as const) {
        await expect(item(a, pedidos[c]).getByTestId("pedido-imovel"), `a linha do pedido "${c}" diz o imóvel`).toHaveText(identificacao(c));
      }
      // Os dois do piloto: mesma cidade, mesmo porte, mesmos valores — e linhas diferentes, pelo imóvel.
      const dois = await Promise.all((["proposta", "aceito"] as const).map((c) => item(a, pedidos[c]).getByTestId("pedido-imovel").innerText()));
      expect(dois[0]).not.toBe(dois[1]);
      expect(codigoVN(imovelDe.proposta.id)).not.toBe(codigoVN(imovelDe.aceito.id));
      // (a) na linha: o piloto mostra o valor e o prazo propostos; só o credenciamento diz "avaliação de teste".
      for (const c of ["proposta", "aceito"] as const) {
        await expect(item(a, pedidos[c])).toContainText(`${CIDADE} · 1 ou 2 quartos · R$ 250,00 · 2 dias`);
        await expect(item(a, pedidos[c])).not.toContainText("avaliação de teste");
      }
      await expect(item(a, pedidos.credenciamento)).toContainText(`${CIDADE} · 1 ou 2 quartos · avaliação de teste`);
      await semRolagemLateral(a);
      // O print é das duas linhas do piloto (mesma cidade, mesmo porte), cada uma no meio da tela.
      for (const c of ["proposta", "aceito"] as const) {
        await item(a, pedidos[c]).evaluate((el) => el.scrollIntoView({ block: "center" }));
        await a.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await item(a, pedidos[c]).screenshot({ path: `${SAIDA}/t1739-4-lista-${c}-${w}.png` });
      }
    }
    // A tela da visita agendada (checklist) também diz de que imóvel é.
    await a.goto(`${ROTA}/${pedidos.agendado}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-imovel")).toHaveText(identificacao("agendado"), { timeout: 30_000 });
    await a.context().close();
  });
});
