import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1728 — E1079 @E1079, fatia 3 (ORDEM-DUET-445): o pedido do avaliador pelo mockup aprovado (avaliador-pedido), SEM
  desfazer o E648. Massa própria, só contas de teste: um avaliador ativo e três pedidos à espera da resposta dele.
   1. A 390 e a 1280 px: "Novo pedido de avaliação" com a etiqueta "Novo", a foto do imóvel (a imagem carrega), o local
      só com bairro e cidade (nunca a rua), o porte, o valor da tabela como REFERÊNCIA (nunca "Você recebe") e os botões
      "Aceitar pedido" e "Recusar". Sem a linha da data pedida pelo dono. Sem rolagem lateral.
   2. "Aceitar pedido" abre, na mesma tela, o valor e o prazo do avaliador; enviada a proposta, grava a proposta de hoje
      (E648) e a tela passa a "Proposta enviada", ainda sem a rua e sem "Você recebe".
   3. Depois de o dono aceitar a proposta: "Você recebe R$ 280,00", o endereço completo e "Agendar a visita".
   4. "Recusar" segue pela ação de hoje: o pedido volta ao dono e a tela volta à lista.
   5. Na lista do avaliador, "Ver o pedido" leva a esta tela; os campos de hoje continuam na lista.
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const RUA = "Rua das Palmeiras, 450";
const BAIRRO = "Santa Mônica";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1728.${sufixo}@lab.vivanomads.test`, nome: "Dora Pedido Sobrenome", role: "owner" as const };
const aval = { email: `av.t1728.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const ids: { dono?: string; aval?: string; cred?: string } = {};
const imoveis: string[] = [];
const pedidos: { tela?: string; recusa?: string; lista?: string } = {};

/** Um pedido novo para o avaliador da trava: escolhido pelo dono, sem resposta ainda. */
async function pedidoNovo(nome: string): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Pedido ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  await fotosReais(imovel, ids.dono!);
  const { error: eEnd } = await adm().from("properties").update({ exact_address: RUA, address: BAIRRO, city: CIDADE }).eq("id", imovel);
  if (eEnd) throw eEnd;
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "designado", avaliador_id: ids.cred, designado_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e2 } = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: agora });
  if (e2) throw e2;
  return data.id as string;
}
async function noPedido(browser: Browser, pedido: string, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, aval.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t344).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  return page;
}
const linhaDoPedido = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, valor_proposto, prazo_proposto_dias, proposta_em").eq("id", pedido).single()).data!;
const respostaDe = async (pedido: string) => (await adm().from("vistoria_designacoes").select("resposta").eq("pedido_id", pedido).eq("avaliador_id", ids.cred!).single()).data?.resposta as string | null;

test.describe("T1728 — E1079: o pedido do avaliador pelo mockup, com a proposta do E648 de pé @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1728-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, user_id: ids.aval, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: "2026-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    pedidos.tela = await pedidoNovo("tela");
    pedidos.recusa = await pedidoNovo("recusa");
    pedidos.lista = await pedidoNovo("lista");
  });

  test.afterAll(async () => {
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.aval) await adm().from("parceiros").delete().eq("user_id", ids.aval);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas([ids.dono, ids.aval].filter(Boolean) as string[]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. ${largura} px: o pedido novo como no desenho — foto, bairro e cidade, porte, valor de referência e os dois botões`, async ({ browser }) => {
      const p = await noPedido(browser, pedidos.tela!, largura);
      const tela = p.getByTestId("pedido-avaliador");
      await expect(p.getByRole("heading", { level: 1, name: "Novo pedido de avaliação" })).toBeVisible({ timeout: 30_000 });
      await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Novo");
      await expect(tela.getByTestId("pedido-capa").locator("img")).toBeVisible();
      await expect.poll(() => tela.getByTestId("pedido-capa").locator("img").evaluate((im) => (im as HTMLImageElement).complete && (im as HTMLImageElement).naturalWidth > 0), { message: "a foto do imóvel carrega" }).toBe(true);
      await expect(tela.getByTestId("pedido-local")).toHaveText(`${BAIRRO} · ${CIDADE}`);
      await expect(tela.getByTestId("pedido-porte")).toHaveText("Porte: 1 ou 2 quartos");
      await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Valor de referência: R$ 250,00");
      await expect(tela.getByRole("button", { name: "Aceitar pedido" })).toBeVisible();
      await expect(tela.getByRole("button", { name: "Recusar" })).toBeVisible();
      // ORDEM-DUET-445: antes do aceite do dono não há rua, nem "Você recebe", nem a data pedida pelo dono.
      await expect(tela).not.toContainText("Palmeiras");
      await expect(tela).not.toContainText("Você recebe");
      await expect(tela).not.toContainText("Data pedida");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t1728-1-pedido-${largura}.png`, fullPage: true });
      await tela.screenshot({ path: `${SAIDA}/t1728-1-pedido-bloco-${largura}.png` });
      await p.context().close();
    });
  }

  test("2. 'Aceitar pedido' abre o valor e o prazo na mesma tela; enviada a proposta, a tela passa a 'Proposta enviada'", async ({ browser }) => {
    const p = await noPedido(browser, pedidos.tela!, 390);
    const tela = p.getByTestId("pedido-avaliador");
    const endereco = p.url();
    await tela.getByRole("button", { name: "Aceitar pedido" }).click();
    await expect(tela.getByLabel("Seu valor (R$)")).toBeVisible();
    await expect(tela.getByLabel(/Prazo do laudo \(dias úteis/)).toBeVisible();
    expect(p.url(), "os campos abrem na mesma tela").toBe(endereco);
    expect(await respostaDe(pedidos.tela!), "abrir os campos ainda não aceita nada").toBeNull();
    await p.screenshot({ path: `${SAIDA}/t1728-2-aceitar-aberto-390.png`, fullPage: true });
    await tela.getByLabel("Seu valor (R$)").fill("280");
    await tela.getByLabel(/Prazo do laudo \(dias úteis/).fill("5");
    await tela.getByRole("button", { name: "Enviar proposta" }).click();
    // E648: aceitar é a proposta do avaliador (valor e prazo dele), à espera do dono.
    await expect.poll(() => respostaDe(pedidos.tela!), { timeout: 20_000 }).toBe("aceita");
    // A ação grava a resposta e, logo a seguir, o valor e o prazo no pedido: espera a segunda gravação.
    await expect.poll(async () => Number((await linhaDoPedido(pedidos.tela!)).valor_proposto), { timeout: 20_000 }).toBe(280);
    const linha = await linhaDoPedido(pedidos.tela!);
    expect(linha.prazo_proposto_dias).toBe(5);
    expect(linha.status, "o pedido continua à espera do dono").toBe("designado");
    await expect(p.getByRole("heading", { level: 1, name: "Pedido de avaliação", exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Proposta enviada");
    // E1156 (asserção alterada, ORDENS-DUET 712 e 713): o prazo do laudo é o combinado, em dias úteis depois da visita.
    await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Proposta enviada: R$ 280,00 · laudo em até 5 dias úteis depois da visita");
    await expect(tela.getByTestId("pedido-aguarda-dono")).toContainText("Falta o proprietário aceitar a sua proposta");
    await expect(tela.getByRole("button", { name: "Aceitar pedido" })).toHaveCount(0);
    await expect(tela).not.toContainText("Palmeiras");
    await expect(tela).not.toContainText("Você recebe");
    await p.screenshot({ path: `${SAIDA}/t1728-2-proposta-enviada-390.png`, fullPage: true });
    await p.context().close();
  });

  test("3. Depois de o dono aceitar a proposta: 'Você recebe', o endereço completo e 'Agendar a visita'", async ({ browser }) => {
    // O aceite do dono é o passo de hoje (aceitarProposta); aqui entra pelo banco, como preparo.
    const { error } = await adm().from("vistoria_pedidos").update({ proposta_aceita_em: new Date().toISOString() }).eq("id", pedidos.tela!);
    expect(error).toBeNull();
    const p = await noPedido(browser, pedidos.tela!, 390);
    const tela = p.getByTestId("pedido-avaliador");
    await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Aceito pelo proprietário", { timeout: 30_000 });
    await expect(tela.getByTestId("pedido-valor-linha")).toHaveText("Você recebe R$ 280,00");
    await expect(tela.getByTestId("pedido-local")).toHaveText(`${RUA} · ${BAIRRO} · ${CIDADE}`);
    await expect(tela.getByRole("link", { name: "Agendar a visita" })).toHaveAttribute("href", "/dashboard/parceiro/avaliacao#agenda");
    await p.screenshot({ path: `${SAIDA}/t1728-3-aceito-390.png`, fullPage: true });
    await p.context().close();
  });

  test("4. 'Recusar' segue pela ação de hoje: o pedido volta ao dono e a tela volta à lista", async ({ browser }) => {
    const p = await noPedido(browser, pedidos.recusa!, 390);
    await p.getByTestId("pedido-avaliador").getByRole("button", { name: "Recusar" }).click();
    await expect.poll(() => respostaDe(pedidos.recusa!), { timeout: 20_000 }).toBe("recusada");
    await p.waitForURL(/\/dashboard\/parceiro\/avaliacao(#pedidos)?$/, { timeout: 20_000 });
    expect((await linhaDoPedido(pedidos.recusa!)).avaliador_id, "o pedido deixa de ser deste avaliador").toBeNull();
    await p.context().close();
  });

  test("5. Na lista do avaliador, 'Ver o pedido' leva à tela nova; os campos de hoje continuam na lista", async ({ browser }) => {
    const p = await entrar(browser, aval.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(p.url()).origin }]);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidos.lista}"]`);
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item.getByTestId("proposta-valor"), "a proposta pela lista continua lá").toBeVisible();
    await item.getByRole("link", { name: "Ver o pedido" }).click();
    await p.waitForURL(new RegExp(`/dashboard/parceiro/avaliacao/${pedidos.lista}$`), { timeout: 20_000 });
    await expect(p.getByRole("heading", { level: 1, name: "Novo pedido de avaliação" })).toBeVisible({ timeout: 30_000 });
    await p.context().close();
  });
});
