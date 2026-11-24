import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1737 — E1102 @E1102 (ORDEM-DUET-465): "Ver o pedido" do avaliador abria /dashboard/parceiro/avaliacao/<id> em branco
  e devolvia-o ao painel; o avaliador não abria o detalhe do próprio pedido.
  A causa: um pedido "designado" ao avaliador SEM a linha em vistoria_designacoes — a forma do pedido da massa de QA
  0256, que existe em produção para o UDI-002. A lista oferecia "Ver o pedido" e o formulário de proposta; a tela não
  achava a designação e voltava ao painel; o formulário respondia "O prazo de 24 horas para responder já passou".
  Cenário do piloto, como em produção: chave desligada (sem o cookie do laboratório), contas de teste na lista do piloto.
  Massa e cidade próprias (Patos de Minas).
   1. O pedido sem a linha de designação: a lista oferece "Ver o pedido" e o clique ABRE a tela (não volta ao painel),
      a 390 e a 1280 px; o endereço direto também abre. Sem relógio inventado (nada vence esse pedido).
   2. Nessa tela, "Aceitar pedido" → "Enviar proposta" funciona: a designação que faltava nasce com a resposta e a
      proposta fica no pedido. Nunca "o prazo de 24 horas passou".
   3. "Recusar" também: o pedido volta ao dono e a recusa fica registrada (aparece no histórico do avaliador).
   5. E1102 (lacuna A da ORDEM-DUET-618/623): com a recusa gravada na designação, o endereço do pedido não abre a tela de
      responder — mesmo com o pedido ainda "designado" a ele (a massa força esse estado; o fluxo devolve o pedido ao dono).
   4. Todo link que a lista oferece ("Ver o pedido", "Abrir o checklist") abre a tela daquele pedido — nenhum devolve o
      avaliador ao painel.
  Acrescento da ORDEM-DUET-492: o pedido designado sem designação aparece em "Para responder" (e não em "Visitas"),
  sem relógio inventado e sem o formulário antigo; enviada a proposta, passa a "Visitas" como qualquer pedido (casos 1 e 4).
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Patos de Minas";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1737.${sufixo}@lab.vivanomads.test`, nome: "Dirce Pedido", role: "owner" as const };
const aval = { email: `av.t1737.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const imoveis: string[] = [];
const pedidos: { semLinha?: string; semLinhaRecusa?: string; novo?: string; agendado?: string } = {};
const ROTA = "/dashboard/parceiro/avaliacao";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
const ha = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

async function imovelNovo(nome: string): Promise<string> {
  const id = await criarImovelPronto(ids.dono, `[TESTE QA] t1737 ${nome} ${sufixo}`, { ativo: true });
  imoveis.push(id);
  const { error } = await adm().from("properties").update({ city: CIDADE }).eq("id", id);
  if (error) throw error;
  return id;
}
/** Um pedido do avaliador da trava. `linha`: a resposta gravada na designação; "nenhuma" = sem a linha (a forma da massa 0256). */
async function pedidoDoAvaliador(nome: string, campos: Record<string, unknown>, linha: "nenhuma" | null | "aceita" | "recusada"): Promise<string> {
  const imovel = await imovelNovo(nome);
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, teste: true, ...campos })
    .select("id")
    .single();
  if (error) throw error;
  if (linha !== "nenhuma") {
    const { error: e2 } = await adm()
      .from("vistoria_designacoes")
      .insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: campos.designado_em, resposta: linha, respondido_em: linha ? new Date().toISOString() : null });
    if (e2) throw e2;
  }
  return data.id as string;
}
const linhaDoPedido = async (id: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, proposta_em, valor_proposto, prazo_proposto_dias").eq("id", id).single()).data!;
const designacoesDe = async (id: string) => ((await adm().from("vistoria_designacoes").select("avaliador_id, resposta").eq("pedido_id", id)).data ?? []) as { avaliador_id: string; resposta: string | null }[];
const item = (page: Page, id: string) => page.locator(`[data-testid="avaliacao-designada"][data-pedido="${id}"]`);
/** Os pedidos de uma secção da lista do avaliador ("avaliacoes-designadas" = Para responder; "avaliacoes-visitas" = Visitas). */
const pedidosDaSecao = async (page: Page, secao: "avaliacoes-designadas" | "avaliacoes-visitas") =>
  (await page.getByTestId(secao).locator('[data-testid="avaliacao-designada"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-pedido") ?? ""))).sort();

test.describe("T1737 — E1102: o avaliador abre o detalhe do próprio pedido @E1102", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-t1737-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1737", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1737 (laboratório)" });
      if (p.error) throw p.error;
    }
    // A forma da massa 0256: designado há dias, de teste, SEM a linha em vistoria_designacoes.
    pedidos.semLinha = await pedidoDoAvaliador("sem linha", { designado_em: ha(20) }, "nenhuma");
    await fotosReais(imoveis[0], ids.dono); // a capa do pedido carrega de verdade (o print mostra a tela como ela é)
    pedidos.semLinhaRecusa = await pedidoDoAvaliador("sem linha, recusa", { designado_em: ha(20) }, "nenhuma");
    // Os pedidos comuns: um novo (escolhido pelo dono agora) e um com a visita agendada.
    const agora = new Date().toISOString();
    pedidos.novo = await pedidoDoAvaliador("novo", { designado_em: agora, escolhido_em: agora }, null);
    pedidos.agendado = await pedidoDoAvaliador(
      "agendado",
      { status: "agendado", designado_em: ha(2), escolhido_em: ha(2), valor_proposto: 300, prazo_proposto_dias: 2, proposta_em: ha(1.5), proposta_aceita_em: ha(1), agendado_para: new Date(Date.now() + 2 * 86_400_000).toISOString() },
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

  test("1. o pedido sem a linha de designação: 'Ver o pedido' abre a tela (não volta ao painel), a 390 e a 1280 px", async ({ browser }) => {
    expect(await designacoesDe(pedidos.semLinha!), "a massa: sem linha de designação").toHaveLength(0);
    const a = await entrar(browser, aval.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto(ROTA, { waitUntil: "domcontentloaded" });
      const link = item(a, pedidos.semLinha!).getByTestId("abrir-pedido");
      await expect(link, "a lista oferece 'Ver o pedido' para o pedido que é do avaliador").toBeVisible({ timeout: 30_000 });
      await link.click();
      const tela = a.getByTestId("pedido-avaliador");
      await expect(tela, "a tela do pedido abre (antes: em branco e de volta ao painel)").toBeVisible({ timeout: 30_000 });
      expect(new URL(a.url()).pathname).toBe(`${ROTA}/${pedidos.semLinha}`);
      await expect(tela).toHaveAttribute("data-etapa", "novo");
      await expect(tela.getByTestId("pedido-titulo")).toHaveText("Novo pedido de avaliação");
      await expect(tela.getByTestId("pedido-local")).toContainText(CIDADE);
      await expect(tela.getByTestId("pedido-porte")).toHaveText("Porte: 1 ou 2 quartos");
      await expect(tela.getByRole("button", { name: "Aceitar pedido" })).toBeVisible();
      await expect(tela.getByRole("button", { name: "Recusar" })).toBeVisible();
      // Nada vence este pedido (não há designação aberta para a rotina): a tela não inventa um prazo.
      await expect(tela.getByTestId("pedido-prazo-resposta")).toHaveCount(0);
      // A foto do imóvel carrega (não é uma caixa vazia).
      await expect.poll(() => tela.getByTestId("pedido-capa").locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await semRolagemLateral(a);
      // O clique deixa o foco no atalho "Pular para o conteúdo" (comportamento geral da casca); o print é da tela.
      await a.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await a.screenshot({ path: `${SAIDA}/t1737-1-pedido-sem-linha-${w}.png`, fullPage: true });
    }
    // O endereço direto também abre (era o mesmo desvio).
    await a.goto(`${ROTA}/${pedidos.semLinha}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-avaliador")).toBeVisible({ timeout: 30_000 });
    expect(new URL(a.url()).pathname).toBe(`${ROTA}/${pedidos.semLinha}`);
    // Na lista, esse pedido não mostra prazo de resposta nem o formulário antigo: a resposta sai pela tela do pedido.
    await a.goto(ROTA, { waitUntil: "domcontentloaded" });
    await expect(item(a, pedidos.semLinha!).getByTestId("abrir-pedido")).toBeVisible({ timeout: 30_000 });
    await expect(item(a, pedidos.semLinha!).getByTestId("prazo-resposta")).toHaveCount(0);
    await expect(item(a, pedidos.semLinha!).getByTestId("proposta-avaliador")).toHaveCount(0);
    // ORDEM-DUET-492: ele espera a resposta do avaliador, então fica em "Para responder" (antes caía em "Visitas"),
    // ao lado do pedido novo comum; em "Visitas" só o que já tem resposta. E o painel conta os três como novos.
    expect(await pedidosDaSecao(a, "avaliacoes-designadas"), "Para responder: os dois sem a linha e o novo").toEqual([pedidos.semLinha, pedidos.semLinhaRecusa, pedidos.novo].sort());
    expect(await pedidosDaSecao(a, "avaliacoes-visitas"), "Visitas: só o agendado").toEqual([pedidos.agendado]);
    await expect(a.getByTestId("avaliacoes-designadas").locator(`[data-pedido="${pedidos.semLinha}"]`).getByTestId("designacao-aceitar"), "sem o formulário antigo em 'Para responder'").toHaveCount(0);
    // O pedido novo comum segue com o relógio e o formulário (nada mudou para ele).
    await expect(item(a, pedidos.novo!).getByTestId("prazo-resposta")).toBeVisible();
    await expect(item(a, pedidos.novo!).getByTestId("proposta-avaliador")).toBeVisible();
    await a.context().close();
  });

  test("2. nessa tela, aceitar com valor e prazo funciona: a designação que faltava nasce com a resposta", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA}/${pedidos.semLinha}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await tela.getByRole("button", { name: "Aceitar pedido" }).click({ timeout: 30_000 });
    await tela.getByLabel("Seu valor (R$)").fill("320");
    await tela.getByLabel(/Prazo do laudo \(dias úteis/).fill("3");
    await tela.getByRole("button", { name: "Enviar proposta" }).click();
    await expect.poll(async () => (await linhaDoPedido(pedidos.semLinha!)).proposta_em, { timeout: 20_000 }).not.toBeNull();
    const l = await linhaDoPedido(pedidos.semLinha!);
    expect(Number(l.valor_proposto)).toBe(320);
    expect(l.prazo_proposto_dias).toBe(3);
    expect(l.status).toBe("designado");
    expect(await designacoesDe(pedidos.semLinha!)).toEqual([{ avaliador_id: ids.cred, resposta: "aceita" }]);
    // A tela relê o pedido e sai do "novo"; nunca a recusa do prazo.
    await expect(a.getByTestId("pedido-avaliador")).not.toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await expect(a.getByText(/prazo de \d+ horas? para responder já passou/i)).toHaveCount(0);
    await expect(a.getByText("Este pedido não está mais com você.")).toHaveCount(0);
    await a.context().close();
  });

  test("3. recusar também funciona: o pedido volta ao dono e a recusa fica registrada", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA}/${pedidos.semLinhaRecusa}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await tela.getByRole("button", { name: "Recusar" }).click();
    await expect.poll(async () => (await linhaDoPedido(pedidos.semLinhaRecusa!)).status, { timeout: 20_000 }).toBe("pedido");
    expect((await linhaDoPedido(pedidos.semLinhaRecusa!)).avaliador_id).toBeNull();
    expect(await designacoesDe(pedidos.semLinhaRecusa!)).toEqual([{ avaliador_id: ids.cred, resposta: "recusada" }]);
    await expect.poll(() => new URL(a.url()).pathname, { timeout: 20_000 }).toBe(ROTA);
    await a.goto(ROTA, { waitUntil: "domcontentloaded" });
    await expect(a.locator('[data-testid="avaliacao-fora"][data-resposta="recusada"]')).toHaveCount(1, { timeout: 30_000 });
    await expect(item(a, pedidos.semLinhaRecusa!)).toHaveCount(0);
    await a.context().close();
  });

  test("4. todo link que a lista oferece abre a tela daquele pedido — nenhum devolve o avaliador ao painel", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(ROTA, { waitUntil: "domcontentloaded" });
    await expect(item(a, pedidos.novo!).getByTestId("abrir-pedido")).toBeVisible({ timeout: 30_000 });
    // ORDEM-DUET-492: com a proposta enviada (caso 2), o pedido sem a linha saiu de "Para responder" e está em "Visitas".
    expect(await pedidosDaSecao(a, "avaliacoes-designadas")).toEqual([pedidos.novo]);
    expect(await pedidosDaSecao(a, "avaliacoes-visitas")).toEqual([pedidos.semLinha, pedidos.agendado].sort());
    const links = a.locator('[data-testid="abrir-pedido"], [data-testid="abrir-checklist"]');
    const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    // O pedido que recebeu a proposta no caso 2, o novo e o agendado.
    expect(hrefs.sort()).toEqual([pedidos.semLinha, pedidos.novo, pedidos.agendado].map((id) => `${ROTA}/${id}`).sort());
    for (const href of hrefs) {
      await a.goto(ROTA, { waitUntil: "domcontentloaded" });
      const link = a.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible({ timeout: 30_000 });
      await link.click();
      // A tela do pedido (ou do checklist) tem a volta para a lista; o painel e a página "não encontrada" não têm.
      await expect(a.getByRole("link", { name: "Voltar às avaliações" }), `abre ${href}`).toBeVisible({ timeout: 30_000 });
      expect(new URL(a.url()).pathname, `fica em ${href}`).toBe(href);
      await expect(a.getByTestId("painel-nao-encontrado")).toHaveCount(0);
    }
    // O pedido novo, comum, segue como era: "Novo", com o prazo de resposta.
    await a.goto(`${ROTA}/${pedidos.novo}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-avaliador")).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await expect(a.getByTestId("pedido-prazo-resposta")).toHaveText(/^Responda em 23 h \d{2} min$/);
    await a.context().close();
  });
  test("5. com a recusa gravada na designação, o endereço do pedido não reabre a tela de responder", async ({ browser }) => {
    // Massa forçada: o pedido ainda "designado" a este avaliador, com a recusa dele gravada (a regra da etapa é a guarda).
    const recusado = await pedidoDoAvaliador("recusado e ainda designado", { designado_em: ha(3) }, "recusada");
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA}/${recusado}`, { waitUntil: "domcontentloaded" });
    await expect(a.locator("main")).toBeVisible({ timeout: 30_000 });
    await a.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(a.getByTestId("pedido-avaliador"), "a tela de responder não abre depois da recusa").toHaveCount(0);
    await expect(a.getByRole("button", { name: "Aceitar pedido" })).toHaveCount(0);
    await a.context().close();
  });
});
