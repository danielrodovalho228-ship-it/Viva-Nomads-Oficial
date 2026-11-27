import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { codigoDoImovel } from "../../../src/lib/imovel-pagina";
import { dataBRT } from "../../../src/lib/datas-brasilia";

/*
  T1744 — E1125 @E1125 (ORDEM-DUET-539, classe A): dois resíduos do E1104, um caso por ramo. Só contas de teste; cidade
  própria do spec (Iturama); a chave fica DESLIGADA (sem o cookie do laboratório), como em produção, e a dona entra pelo
  piloto.
   1. RAMO DO MORADOR. A moradora pura não vê o cartão "Avaliação do imóvel". A DONA a usar o painel como moradora
      (tem imóveis; o modo gravado é morador) também não o vê — era o que a regra antiga deixava passar, porque só
      olhava a conta. De volta ao modo proprietário, o cartão aparece. 390 e 1280 px.
   2. RAMO DO DESTINO. A dona com DUAS avaliações em curso: o cartão leva à porta (a lista), não a uma avaliação
      escolhida em silêncio. A lista diz quantas são e põe primeiro a pedida mais recentemente; cada imóvel diz o código
      e de quando é o pedido. O botão do primeiro leva ao pedido dele. 390 e 1280 px.
   3. Com UMA avaliação em curso (a outra foi cancelada), o cartão volta a levar direto a ela.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Iturama";
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1744.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const moradora = { email: `mor.t1744.${sufixo}@lab.vivanomads.test`, nome: "Mara Moradora", role: "tenant" as const };
const ids: Record<string, string> = {};
const titulos = { antigo: `Casa do pedido antigo t1744 ${sufixo}`, recente: `Casa do pedido recente t1744 ${sufixo}`, semPedido: `Casa sem pedido t1744 ${sufixo}` };
// O pedido ANTIGO é do imóvel criado por ÚLTIMO: pela regra antiga (o primeiro imóvel da lista com pedido em curso), o
// cartão ia para ele. É o caso da ronda: o clique levou a uma avaliação que não era a mais recente.
const PEDIDO_ANTIGO_EM = "2026-11-02T15:00:00Z";
const PEDIDO_RECENTE_EM = "2026-11-21T15:00:00Z";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
const hrefNoImovel = (id: string) => `/dashboard/imoveis/${id}/nivel#avaliacao-do-imovel`;

async function gravarModo(conta: string, modo: "owner" | "tenant") {
  // O que a troca de papel pela tela grava (setPreferredMode): o modo e o papel ativo.
  const { error } = await adm().from("profiles").update({ preferred_mode: modo, papel_ativo: modo === "owner" ? "proprietario" : "morador" }).eq("id", conta);
  if (error) throw error;
}
async function pedidoEmCurso(imovel: string, criadoEm: string): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dona, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true, criado_em: criadoEm })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T1744 — E1125: o cartão 'Avaliação do imóvel' é só do papel de dono, e o destino dele é legível @E1125", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.moradora = await criarConta(moradora, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dona);
    if (t.error) throw t.error;
    // A ordem de criação dos imóveis é o contrário da dos pedidos: o do pedido recente nasce primeiro.
    ids.recente = await criarImovelPronto(ids.dona, titulos.recente, { ativo: true });
    ids.semPedido = await criarImovelPronto(ids.dona, titulos.semPedido, { ativo: true });
    ids.antigo = await criarImovelPronto(ids.dona, titulos.antigo, { ativo: true });
    const imoveis = [ids.recente, ids.semPedido, ids.antigo];
    const base = Date.parse("2026-10-01T12:00:00Z");
    for (const [i, id] of imoveis.entries()) {
      const c = await adm().from("properties").update({ city: CIDADE, created_at: new Date(base + i * 86_400_000).toISOString() }).eq("id", id);
      if (c.error) throw c.error;
    }
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: 350 })));
    if (eT) throw eT;
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dona, nota: "T1744 (laboratório)" });
    if (p.error) throw p.error;
  });

  test.afterAll(async () => {
    const imoveis = [ids.recente, ids.semPedido, ids.antigo].filter(Boolean);
    if (imoveis.length) {
      const pedidos = ((await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis)).data ?? []).map((x) => x.id as string);
      if (pedidos.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const contas = [ids.dona, ids.moradora].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. ramo do morador: nem a moradora pura nem a dona em modo morador veem o cartão; no modo proprietário ele aparece", async ({ browser }) => {
    // A moradora pura.
    const m = await entrar(browser, moradora.email, senha);
    for (const w of LARGURAS) {
      await largura(m, w);
      await m.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      await expect(m.getByTestId("servicos-grade")).toBeVisible({ timeout: 30_000 });
      await expect(m.getByTestId("servicos-avaliacao")).toHaveCount(0);
      await expect(m.getByTestId("servicos-grade")).not.toContainText("Avaliação do imóvel");
    }
    await m.context().close();

    // A dona, a usar o painel como moradora (o modo gravado é morador). Tem três imóveis: pela conta, é dona.
    await gravarModo(ids.dona, "tenant");
    const d = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const grade = d.getByTestId("servicos-grade");
      await expect(grade).toBeVisible({ timeout: 30_000 });
      await expect(d.getByTestId("servicos-avaliacao")).toHaveCount(0);
      await expect(grade).not.toContainText("Avaliação do imóvel");
      await semRolagemLateral(d);
      await grade.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1744-1-dona-em-modo-morador-${w}.png`, fullPage: true });
    }
    // De volta ao modo proprietário, a mesma conta, a mesma página: o cartão está lá.
    await gravarModo(ids.dona, "owner");
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const card = d.getByTestId("servicos-avaliacao");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText("Avaliação do imóvel");
      await card.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1744-1-dona-em-modo-proprietario-${w}.png` });
    }
    await d.context().close();
  });

  test("2. ramo do destino: com duas avaliações em curso o cartão leva à lista, a mais recente primeiro, cada uma com o código e a data", async ({ browser }) => {
    await gravarModo(ids.dona, "owner");
    ids.pedidoAntigo = await pedidoEmCurso(ids.antigo, PEDIDO_ANTIGO_EM);
    ids.pedidoRecente = await pedidoEmCurso(ids.recente, PEDIDO_RECENTE_EM);
    const d = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const card = d.getByTestId("servicos-avaliacao");
      await expect(card).toBeVisible({ timeout: 30_000 });
      // Nem o pedido antigo (o do imóvel criado por último, aonde a regra antiga levava), nem outro escolhido em silêncio.
      await expect(card).toHaveAttribute("href", "/dashboard/servicos/avaliacao");
      await card.click();
      const porta = d.getByTestId("porta-avaliacao");
      await expect(porta).toHaveAttribute("data-estado", "escolher", { timeout: 30_000 });
      await expect(d).toHaveURL(/\/dashboard\/servicos\/avaliacao$/);
      await expect(porta.getByTestId("porta-varias-em-curso")).toHaveText("Você tem 2 avaliações em curso. Escolha qual abrir.");
      const itens = porta.getByTestId("porta-imovel");
      await expect(itens).toHaveCount(3);
      // A ordem: a pedida mais recentemente, a mais antiga, e por fim o imóvel sem pedido.
      await expect(itens.nth(0)).toContainText(titulos.recente);
      await expect(itens.nth(1)).toContainText(titulos.antigo);
      await expect(itens.nth(2)).toContainText(titulos.semPedido);
      for (const [i, id, quando] of [[0, ids.recente, PEDIDO_RECENTE_EM], [1, ids.antigo, PEDIDO_ANTIGO_EM]] as const) {
        const item = itens.nth(i);
        await expect(item).toHaveAttribute("data-em-curso", "1");
        await expect(item.getByTestId("porta-imovel-codigo")).toHaveText(`${codigoDoImovel(id)} · ${CIDADE}`);
        await expect(item.getByTestId("porta-imovel-pedido-em")).toHaveText(`Avaliação pedida em ${dataBRT(quando)}`);
        await expect(item.getByTestId("porta-imovel-acao")).toHaveText("Ver o pedido em curso");
        await expect(item.getByTestId("porta-imovel-acao")).toHaveAttribute("href", hrefNoImovel(id));
      }
      await expect(itens.nth(2)).toHaveAttribute("data-em-curso", "0");
      await expect(itens.nth(2).getByTestId("porta-imovel-codigo")).toHaveText(`${codigoDoImovel(ids.semPedido)} · ${CIDADE}`);
      await expect(itens.nth(2).getByTestId("porta-imovel-pedido-em")).toHaveCount(0);
      await expect(itens.nth(2).getByTestId("porta-imovel-acao")).toHaveText("Pedir avaliação");
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t1744-2-lista-das-avaliacoes-em-curso-${w}.png`, fullPage: true });
      // O botão do primeiro leva ao pedido dele (o mais recente), com o bloco à vista.
      await itens.nth(0).getByTestId("porta-imovel-acao").click();
      await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.recente}/nivel#avaliacao-do-imovel$`));
      const pedido = d.getByTestId("avaliacao-dono-pedido");
      await expect(pedido).toBeVisible({ timeout: 30_000 });
      await expect(pedido).toHaveAttribute("data-status", "pedido");
      await expect(d.getByTestId("avaliacao-dono")).toBeInViewport();
    }
    await d.context().close();
  });

  test("3. com uma só avaliação em curso, o cartão leva direto a ela e a porta não pede escolha", async ({ browser }) => {
    const c = await adm().from("vistoria_pedidos").update({ status: "cancelada" }).eq("id", ids.pedidoAntigo);
    if (c.error) throw c.error;
    const d = await entrar(browser, dona.email, senha);
    await largura(d, 390);
    await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    const card = d.getByTestId("servicos-avaliacao");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute("href", hrefNoImovel(ids.recente));
    await card.click();
    await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.recente}/nivel#avaliacao-do-imovel$`));
    await expect(d.getByTestId("avaliacao-dono-pedido")).toBeVisible({ timeout: 30_000 });
    await d.goto("/dashboard/servicos/avaliacao", { waitUntil: "domcontentloaded" });
    const porta = d.getByTestId("porta-avaliacao");
    await expect(porta).toHaveAttribute("data-estado", "escolher", { timeout: 30_000 });
    await expect(porta.getByTestId("porta-varias-em-curso")).toHaveCount(0);
    await expect(porta.getByTestId("porta-imovel").nth(0)).toContainText(titulos.recente);
    await expect(porta.getByTestId("porta-imovel").nth(0)).toHaveAttribute("data-em-curso", "1");
    await d.context().close();
  });
});
