import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T1725 — E1079 @E1079, fatia 4 (ORDEM-DUET-385): a visita do avaliador pelo mockup aprovado (avaliador-visita).
  Massa própria, só contas de teste: um avaliador ativo e três avaliações —
  uma em visita com a foto do anúncio e 2 fotos de cômodo ("Fachada do prédio" e "Sala de estar"), uma em visita sem
  foto nenhuma e sem foto no anúncio, e uma com a visita já concluída.
   1. A 390 e a 1280 px: "Visita em andamento", a foto do imóvel, o "Roteiro da visita" com as cinco linhas do desenho
      (fachada e sala marcadas, o resto por fazer), "Fotos do imóvel" com as 2 miniaturas (a imagem carrega) e 1 vaga
      "Adicionar foto", e "Continuar". O bloco vem antes do checklist. Sem rolagem lateral.
   2. "Adicionar foto" leva ao envio de foto que já existia; enviada a foto da "Cozinha", a linha fica marcada e a
      grade passa a 3 miniaturas e uma linha nova de vagas. "Continuar" leva ao checklist.
   3. Sem foto nenhuma: nada marcado, três vagas e nenhuma caixa vazia no lugar da foto do imóvel. "Concluir a visita"
      continua lá. Com a visita concluída, a tela é a do laudo e o bloco da visita não aparece.
   4. ORDEM-DUET-431, resposta 1 — o roteiro TRAVA "Concluir a visita": faltando a foto de Quartos e Banheiros, a tela
      diz o que falta antes do clique, o clique não conclui e a avaliação continua agendada. Com a foto dos cinco
      ambientes, conclui. (E1117, perna 3: o botão vem desativado; a recusa do servidor prova-se religando-o à mão.)
   5. ORDEM-DUET-431/435, resposta 2 — antes do dia marcado a tela diz "Visita agendada" (nunca "em andamento"); o
      roteiro e as fotos continuam lá.
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const BUCKET = "avaliacao-imovel";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1725.${sufixo}@lab.vivanomads.test`, nome: "Dora Visita Sobrenome", role: "owner" as const };
const aval = { email: `av.t1725.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const ids: { dono?: string; aval?: string; cred?: string } = {};
const imoveis: string[] = [];
const caminhos: string[] = [];
const pedidos: { tela?: string; vazia?: string; concluida?: string; futura?: string } = {};

/** Uma avaliação do avaliador da trava, no estado pedido, com as fotos de cômodo dadas (arquivo de verdade no bucket). */
async function avaliacao(nome: string, status: "agendado" | "realizada", comodos: string[], comCapa: boolean, emDias = 0): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Visita ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  if (comCapa) await fotosReais(imovel, ids.dono!);
  else await adm().from("property_photos").delete().eq("property_id", imovel);
  const agora = new Date();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status, avaliador_id: ids.cred, designado_em: agora.toISOString(), agendado_para: (emDias > 0 ? new Date(agora.getTime() + emDias * 86_400_000) : agora).toISOString(), ...(status === "realizada" ? { visita_concluida_em: agora.toISOString() } : {}) })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  await adm().from("vistoria_designacoes").insert({ pedido_id: id, avaliador_id: ids.cred, resposta: "aceita", respondido_em: agora.toISOString() });
  for (const [n, comodo] of comodos.entries()) {
    const path = `${id}/t1725-${n}`;
    const up = await adm().storage.from(BUCKET).upload(path, pngDeTeste(n + 3, 320, 320), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    caminhos.push(path);
    const { error: e2 } = await adm().from("vistoria_checklist_fotos").insert({ pedido_id: id, comodo, path });
    if (e2) throw e2;
  }
  return id;
}

async function naAvaliacao(browser: Browser, pedido: string, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, aval.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t344).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  return page;
}
const carregou = (page: Page, seletor: string) => page.locator(seletor).evaluateAll((imgs) => imgs.map((im) => (im as HTMLImageElement).complete && (im as HTMLImageElement).naturalWidth > 0));
const statusDe = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status as string;
const linhasDoRoteiro = (page: Page) => page.getByTestId("visita-roteiro").locator("li");
const marcadas = (page: Page) => linhasDoRoteiro(page).evaluateAll((ls) => ls.map((l) => `${l.getAttribute("data-roteiro")}:${l.getAttribute("data-feito")}`));

test.describe("T1725 — E1079: a visita do avaliador pelo mockup (foto do imóvel, roteiro, fotos, Continuar) @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1725-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
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
    pedidos.tela = await avaliacao("tela", "agendado", ["Fachada do prédio", "Sala de estar"], true);
    pedidos.vazia = await avaliacao("vazia", "agendado", [], false);
    pedidos.concluida = await avaliacao("concluida", "realizada", ["Sala"], true);
    // Visita marcada para daqui a 3 dias: ainda não está "em andamento".
    pedidos.futura = await avaliacao("futura", "agendado", ["Sala"], true, 3);
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const { data: fotos } = await adm().from("vistoria_checklist_fotos").select("path, vistoria_pedidos!inner(property_id)").in("vistoria_pedidos.property_id", imoveis);
      const todos = [...new Set([...caminhos, ...((fotos ?? []) as { path: string }[]).map((f) => f.path)])];
      if (todos.length) await adm().storage.from(BUCKET).remove(todos);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    await apagarContas([ids.aval, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. a ${largura} px: título, foto do imóvel, roteiro marcado pelas fotos, miniaturas e vaga, Continuar; o bloco antes do checklist`, async ({ browser }) => {
      const page = await naAvaliacao(browser, pedidos.tela!, largura);
      await expect(page.getByRole("heading", { level: 1, name: "Visita em andamento" })).toBeVisible({ timeout: 30_000 });
      const bloco = page.getByTestId("visita-em-andamento");
      // A foto do imóvel é a 1ª do anúncio e carrega.
      await expect(bloco.getByTestId("visita-capa")).toBeVisible();
      await expect.poll(() => carregou(page, '[data-testid="visita-capa"] img'), { timeout: 15_000 }).toEqual([true]);
      // O roteiro do desenho, marcado pelo que já tem foto.
      await expect(bloco.getByRole("heading", { name: "Roteiro da visita" })).toBeVisible();
      await expect(linhasDoRoteiro(page)).toHaveText([/^Fotos da fachada/, /^Sala/, /^Cozinha/, /^Quartos/, /^Banheiros/]);
      expect(await marcadas(page)).toEqual(["fachada:sim", "sala:sim", "cozinha:nao", "quartos:nao", "banheiros:nao"]);
      // "Fotos do imóvel": as 2 fotos de cômodo (a imagem carrega) e a vaga que completa a linha de três.
      await expect(bloco.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible();
      await expect(bloco.getByTestId("visita-foto")).toHaveCount(2);
      await expect.poll(() => carregou(page, '[data-testid="visita-foto"] img'), { timeout: 15_000 }).toEqual([true, true]);
      await expect(bloco.getByTestId("visita-adicionar-foto")).toHaveText(["Adicionar foto"]);
      await expect(bloco.getByRole("link", { name: "Continuar" })).toBeVisible();
      // O bloco vem antes do checklist, que continua inteiro por baixo.
      const yBloco = (await bloco.boundingBox())!.y;
      const yItens = (await page.getByRole("heading", { name: "Itens", exact: true }).boundingBox())!.y;
      expect(yBloco, "a visita vem antes do checklist").toBeLessThan(yItens);
      if (largura === 390) {
        // No celular o cartão do roteiro sobe por cima da foto, como no desenho.
        const capa = (await bloco.getByTestId("visita-capa").boundingBox())!;
        const roteiro = (await bloco.getByTestId("visita-roteiro").boundingBox())!;
        expect(roteiro.y, "o roteiro sobe por cima da foto").toBeLessThan(capa.y + capa.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${SAIDA}/t1725-1-visita-${largura}.png` });
      await bloco.screenshot({ path: `${SAIDA}/t1725-1-visita-bloco-${largura}.png` });
      await page.context().close();
    });
  }

  test("2. 'Adicionar foto' leva ao envio que já existia; enviada a foto da cozinha, a linha fica marcada e a grade ganha a miniatura; 'Continuar' leva ao checklist", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.tela!, 390);
    const bloco = page.getByTestId("visita-em-andamento");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await bloco.getByTestId("visita-adicionar-foto").first().click();
    await expect(page).toHaveURL(/#enviar-foto$/);
    const envio = page.getByTestId("avaliacao-fotos");
    await expect(envio).toBeInViewport();
    await envio.getByLabel("Cômodo").fill("Cozinha");
    await envio.locator('input[type="file"]').setInputFiles({ name: "cozinha.png", mimeType: "image/png", buffer: pngDeTeste(9) });
    await envio.getByRole("button", { name: "Enviar foto" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedidos.tela!)).data ?? []).length, { timeout: 30_000 }).toBe(3);
    await page.goto(`/dashboard/parceiro/avaliacao/${pedidos.tela}`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => marcadas(page), { timeout: 30_000 }).toEqual(["fachada:sim", "sala:sim", "cozinha:sim", "quartos:nao", "banheiros:nao"]);
    await expect(bloco.getByTestId("visita-foto")).toHaveCount(3);
    await expect.poll(() => carregou(page, '[data-testid="visita-foto"] img'), { timeout: 15_000 }).toEqual([true, true, true]);
    // Linha cheia: abre uma linha nova de vagas.
    await expect(bloco.getByTestId("visita-adicionar-foto")).toHaveCount(3);
    await bloco.screenshot({ path: `${SAIDA}/t1725-2-visita-tres-fotos-390.png` });
    await bloco.getByRole("link", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/#itens$/);
    await expect(page.getByRole("heading", { name: "Itens", exact: true })).toBeInViewport();
    await page.context().close();
  });

  test("3. sem foto nenhuma: nada marcado, três vagas e nenhuma caixa vazia; 'Concluir a visita' continua; com a visita concluída a tela é a do laudo", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.vazia!, 390);
    const bloco = page.getByTestId("visita-em-andamento");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco.getByTestId("visita-capa")).toHaveCount(0);
    expect(await marcadas(page)).toEqual(["fachada:nao", "sala:nao", "cozinha:nao", "quartos:nao", "banheiros:nao"]);
    await expect(bloco.getByTestId("visita-foto")).toHaveCount(0);
    await expect(bloco.getByTestId("visita-adicionar-foto")).toHaveCount(3);
    await expect(page.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" })).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t1725-3-visita-sem-fotos-390.png` });

    await page.goto(`/dashboard/parceiro/avaliacao/${pedidos.concluida}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Laudo da avaliação" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("visita-em-andamento")).toHaveCount(0);
    await page.context().close();
  });

  test("4. o roteiro TRAVA 'Concluir a visita': com ambientes sem foto diz o que falta e não conclui; com os cinco, conclui", async ({ browser }) => {
    // Depois do caso 2 a avaliação tem fachada, sala e cozinha: faltam Quartos e Banheiros.
    const page = await naAvaliacao(browser, pedidos.tela!, 390);
    const FALTA = "Para concluir a visita, falta a foto de: Quartos e Banheiros. Envie uma foto de cada ambiente do roteiro.";
    const concluir = page.getByTestId("concluir-visita");
    await expect(concluir.getByTestId("concluir-faltas")).toHaveText(FALTA, { timeout: 30_000 });
    await concluir.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1725-4-concluir-travado-390.png` });
    // E1117 (perna 3, ORDEM-DUET-514): com foto por enviar o botão já vem desativado. A recusa do servidor continua a
    // valer para quem contornar a tela: religado o botão à mão, o clique não conclui.
    const botao = concluir.getByRole("button", { name: "Concluir a visita" });
    await expect(botao).toBeDisabled();
    await botao.evaluate((b) => b.removeAttribute("disabled"));
    await botao.click();
    // O servidor recusa com a mesma frase e a avaliação continua agendada.
    await expect(concluir.getByTestId("acao-erro")).toHaveText(FALTA, { timeout: 20_000 });
    expect(await statusDe(pedidos.tela!), "sem a foto de dois ambientes a visita não conclui").toBe("agendado");

    // Chegam as fotos que faltavam: a frase some e a visita conclui.
    const { error } = await adm().from("vistoria_checklist_fotos").insert([
      { pedido_id: pedidos.tela, comodo: "Quarto de casal", path: `${pedidos.tela}/t1725-quarto` },
      { pedido_id: pedidos.tela, comodo: "Banheiro social", path: `${pedidos.tela}/t1725-banheiro` },
    ]);
    if (error) throw error;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => marcadas(page), { timeout: 30_000 }).toEqual(["fachada:sim", "sala:sim", "cozinha:sim", "quartos:sim", "banheiros:sim"]);
    await expect(page.getByTestId("concluir-faltas")).toHaveCount(0);
    await page.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
    await expect.poll(() => statusDe(pedidos.tela!), { timeout: 30_000 }).toBe("realizada");
    await page.context().close();
  });

  test("5. antes do dia marcado a tela diz 'Visita agendada', nunca 'em andamento'; o roteiro e as fotos continuam lá", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.futura!, 390);
    await expect(page.getByRole("heading", { level: 1, name: "Visita agendada" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Visita em andamento")).toHaveCount(0);
    await expect(page.getByTestId("visita-em-andamento").getByRole("heading", { name: "Roteiro da visita" })).toBeVisible();
    expect(await marcadas(page)).toEqual(["fachada:nao", "sala:sim", "cozinha:nao", "quartos:nao", "banheiros:nao"]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SAIDA}/t1725-5-visita-agendada-390.png` });
    await page.context().close();
  });
});
