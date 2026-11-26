import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1730 — E1091 @E1091 (ORDEM-DUET-446): na prova, o clique em "Escolher este avaliador" não dava resposta nenhuma — dois
  cliques sem confirmação nem mudança; o efeito só aparecia depois de recarregar. A escolha funciona; faltava a tela
  responder na hora.
   1. Depois do clique, SEM recarregar: a tela diz que o avaliador foi escolhido ("Avaliador escolhido por você: nº …"),
      a lista de escolha sai e a etapa da linha do tempo avança. Um clique só grava uma escolha só.
   2. Enquanto o pedido é enviado (servidor lento), a tela diz "Enviando…" e o botão não aceita um segundo clique.
  Massa própria, só contas de teste. As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1730.${sufixo}@lab.vivanomads.test`, nome: "Dina Escolha Sobrenome", role: "owner" as const };
const aval = { email: `av.t1730.${sufixo}@lab.vivanomads.test`, nome: "Ana Teste Avaliadora", role: "tenant" as const };
const ids: Record<string, string> = {};
let numero = "";

async function pedidoPorEscolher(nome: string): Promise<{ imovel: string; pedido: string }> {
  const imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Escolha ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  const { data, error } = await adm().from("vistoria_pedidos").insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "pedido" }).select("id").single();
  if (error) throw error;
  return { imovel, pedido: data.id as string };
}
const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id").eq("id", pedido).single()).data!;
const designacoes = async (pedido: string) => (await adm().from("vistoria_designacoes").select("id", { count: "exact", head: true }).eq("pedido_id", pedido)).count ?? 0;

test.describe("T1730 — E1091: a escolha do avaliador responde na hora, sem recarregar @E1091", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  const imoveis: string[] = [];

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    // Contas sem a marca de teste, como na t315: num pedido que não é de teste, um avaliador com conta de teste fica fora
    // da lista de escolha ("conta de teste fora do rodízio real").
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1730-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, user_id: ids.aval, cidade: CIDADE, numero_credenciado: numero, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: "2020-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const nome of ["resposta", "duplo"]) {
      const p = await pedidoPorEscolher(nome);
      ids[`imovel_${nome}`] = p.imovel;
      ids[`pedido_${nome}`] = p.pedido;
      imoveis.push(p.imovel);
    }
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

  test("1. Depois do clique, sem recarregar: a tela diz o avaliador escolhido, a lista sai e a etapa avança", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    await d.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(d.url()).origin }]);
    await d.goto(`/dashboard/imoveis/${ids.imovel_resposta}/nivel`, { waitUntil: "domcontentloaded" });
    const bloco = d.getByTestId("avaliacao-dono");
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible({ timeout: 30_000 });
    let cargas = 0;
    d.on("load", () => cargas++);
    // E1096 (ORDEM-DUET-453, asserção alterada): o botão passou a "Escolher" (antes "Escolher este avaliador"); só o nome mudou.
    await escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numero}` }).getByRole("button", { name: "Escolher" }).click();
    // A resposta vem na mesma tela, sem ninguém recarregar.
    await expect(bloco.getByTestId("avaliador-designado")).toHaveText(`Avaliador escolhido por você: nº ${numero}`, { timeout: 20_000 });
    await expect(d.getByTestId("avaliacao-escolha")).toHaveCount(0);
    await expect(bloco.getByTestId("etapa-designado")).toHaveAttribute("data-estado", "atual");
    expect(cargas, "a página não foi recarregada").toBe(0);
    expect((await linha(ids.pedido_resposta)).status).toBe("designado");
    expect(await designacoes(ids.pedido_resposta), "uma escolha só").toBe(1);
    await bloco.scrollIntoViewIfNeeded();
    await d.screenshot({ path: `${SAIDA}/t1730-1-escolhido-390.png` });
    await d.context().close();
  });

  test("2. Enquanto o pedido é enviado, o botão não aceita um segundo clique", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    await d.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(d.url()).origin }]);
    await d.goto(`/dashboard/imoveis/${ids.imovel_duplo}/nivel`, { waitUntil: "domcontentloaded" });
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible({ timeout: 30_000 });
    // Segura a resposta do servidor para ver o estado "a enviar".
    await d.route("**/dashboard/imoveis/**", async (rota) => {
      if (rota.request().method() === "POST") await new Promise((r) => setTimeout(r, 2_500));
      await rota.continue();
    });
    const botao = escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numero}` }).getByRole("button");
    await botao.click();
    await expect(botao, "o botão fica desligado enquanto envia").toBeDisabled({ timeout: 2_000 });
    await expect(escolha.getByTestId("acao-enviando"), "a tela diz que está a enviar").toHaveText("Enviando…");
    // O segundo clique da prova: com o botão desligado, não há segundo envio.
    await botao.click({ force: true }).catch(() => null);
    await expect(d.getByTestId("avaliacao-dono").getByTestId("avaliador-designado")).toHaveText(`Avaliador escolhido por você: nº ${numero}`, { timeout: 20_000 });
    expect(await designacoes(ids.pedido_duplo), "uma escolha só").toBe(1);
    await d.context().close();
  });
});
