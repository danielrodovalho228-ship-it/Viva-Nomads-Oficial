import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T1742 — E1117 @E1117 (ORDEM-DUET-514): os quatro defeitos da tela de execução da visita, uma trava por perna.
  Massa própria, só contas de teste: um avaliador ativo e quatro avaliações em visita (agendadas para hoje), uma por
  caso, para cada perna morder sozinha: "arquivo" (3 fotos), "contagem" (fachada, sala e quarto: faltam Cozinha e
  Banheiros), "concluir" (falta só Banheiros) e "ruido" (sem foto).
   1. Sucesso falso: depois de uma foto enviada, o formulário volta ao começo ("Nenhum arquivo escolhido"). Um novo
      "Enviar foto" SEM arquivo não deixa "Foto enviada." na tela, diz "Escolha a foto." e não grava nada.
   2. Sem recarregar: enviada a foto da cozinha, a contagem de fotos sobe, a linha do roteiro fica marcada e a frase
      do que falta deixa de falar da cozinha.
   3. "Concluir a visita" fica DESATIVADO enquanto faltar foto do roteiro, com o motivo ligado ao botão; chegada a
      última foto, o botão liga sem recarregar e a visita conclui.
   4. O dB(A) guardado continua na tela depois de recarregar (no campo e na linha "Última medição guardada").
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const BUCKET = "avaliacao-imovel";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1742.${sufixo}@lab.vivanomads.test`, nome: "Dalva Execução Sobrenome", role: "owner" as const };
const aval = { email: `av.t1742.${sufixo}@lab.vivanomads.test`, nome: "Rui Teste Avaliador", role: "tenant" as const };
const ids: { dono?: string; aval?: string; cred?: string } = {};
const imoveis: string[] = [];
const pedidos: { arquivo?: string; contagem?: string; concluir?: string; ruido?: string } = {};

/** Uma avaliação em visita (agendada para agora) do avaliador da trava, com as fotos de cômodo dadas. */
async function avaliacao(nome: string, comodos: string[]): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Execução ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "agendado", avaliador_id: ids.cred, designado_em: agora, agendado_para: agora })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  await adm().from("vistoria_designacoes").insert({ pedido_id: id, avaliador_id: ids.cred, resposta: "aceita", respondido_em: agora });
  for (const [n, comodo] of comodos.entries()) {
    const path = `${id}/t1742-${n}`;
    const up = await adm().storage.from(BUCKET).upload(path, pngDeTeste(n + 3, 320, 320), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    const { error: e2 } = await adm().from("vistoria_checklist_fotos").insert({ pedido_id: id, comodo, path });
    if (e2) throw e2;
  }
  return id;
}

async function naAvaliacao(browser: Browser, pedido: string): Promise<Page> {
  const page = await entrar(browser, aval.email, senha);
  await page.setViewportSize({ width: 390, height: 844 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t1725).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Visita em andamento" })).toBeVisible({ timeout: 30_000 });
  return page;
}
const nFotos = async (pedido: string) => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedido)).data ?? []).length;
const statusDe = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status as string;
const marcadas = (page: Page) => page.getByTestId("visita-roteiro").locator("li").evaluateAll((ls) => ls.map((l) => `${l.getAttribute("data-roteiro")}:${l.getAttribute("data-feito")}`));

/** Envia a foto de um cômodo pelo formulário da tela. */
async function enviarFoto(page: Page, comodo: string, n: number) {
  const form = page.getByTestId("avaliacao-foto-form");
  await form.getByLabel("Cômodo", { exact: true }).fill(comodo);
  await form.locator('input[type="file"]').setInputFiles({ name: `${comodo.toLowerCase().replace(/\s+/g, "-")}.png`, mimeType: "image/png", buffer: pngDeTeste(n) });
  await form.getByRole("button", { name: "Enviar foto" }).click();
}

test.describe("T1742 — E1117: a tela de execução da visita não mente (foto, contagem, Concluir, dB(A)) @E1117", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1742-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
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
    pedidos.arquivo = await avaliacao("arquivo", ["Fachada do prédio", "Sala de estar", "Quarto de casal"]);
    pedidos.contagem = await avaliacao("contagem", ["Fachada do prédio", "Sala de estar", "Quarto de casal"]);
    pedidos.concluir = await avaliacao("concluir", ["Fachada do prédio", "Sala de estar", "Cozinha", "Quarto de casal"]);
    pedidos.ruido = await avaliacao("ruido", []);
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const { data: fotos } = await adm().from("vistoria_checklist_fotos").select("path, vistoria_pedidos!inner(property_id)").in("vistoria_pedidos.property_id", imoveis);
      const todos = [...new Set(((fotos ?? []) as { path: string }[]).map((f) => f.path))];
      if (todos.length) await adm().storage.from(BUCKET).remove(todos);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    await apagarContas([ids.aval, ids.dono]);
  });

  test("1. 'Enviar foto' sem arquivo, depois de uma foto enviada: nada de 'Foto enviada.', a tela diz 'Escolha a foto.' e nada é gravado", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.arquivo!);
    const form = page.getByTestId("avaliacao-foto-form");
    await enviarFoto(page, "Corredor", 7);
    await expect(form.getByTestId("acao-ok")).toHaveText("Foto enviada.", { timeout: 30_000 });
    await expect.poll(() => nFotos(pedidos.arquivo!), { timeout: 15_000 }).toBe(4);
    // O sucesso limpa o formulário: o seletor não pode continuar a mostrar o arquivo que já foi.
    await expect(form.locator("[data-seletor-arquivo]")).toContainText("Nenhum arquivo escolhido");
    await expect(form.locator("[data-seletor-arquivo]")).not.toContainText("corredor.png");

    // Segunda tentativa, com o cômodo escrito e SEM arquivo.
    await form.getByLabel("Cômodo", { exact: true }).fill("Varanda");
    await form.getByRole("button", { name: "Enviar foto" }).click();
    await expect(form.getByText("Escolha a foto.")).toBeVisible({ timeout: 10_000 });
    await expect(form.getByText("Foto enviada.")).toHaveCount(0);
    await form.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1742-1-enviar-sem-arquivo-390.png` });
    // Nada foi gravado: continuam as 4 fotos.
    await page.waitForTimeout(1500);
    expect(await nFotos(pedidos.arquivo!), "sem arquivo, nenhuma foto nova").toBe(4);
    await page.context().close();
  });

  test("2. sem recarregar: enviada a foto da cozinha, a contagem sobe, o roteiro marca a linha e a frase do que falta muda", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.contagem!);
    const contagem = page.getByTestId("avaliacao-fotos-contagem");
    const faltas = page.getByTestId("concluir-faltas");
    await expect(contagem).toHaveText("3 foto(s) enviada(s).");
    await expect(faltas).toHaveText("Para concluir a visita, falta a foto de: Cozinha e Banheiros. Envie uma foto de cada ambiente do roteiro.");
    expect(await marcadas(page)).toEqual(["fachada:sim", "sala:sim", "cozinha:nao", "quartos:sim", "banheiros:nao"]);

    await enviarFoto(page, "Cozinha", 9);
    await expect(page.getByTestId("avaliacao-foto-form").getByTestId("acao-ok")).toHaveText("Foto enviada.", { timeout: 30_000 });
    // Tudo isto SEM page.reload nem page.goto.
    await expect(contagem).toHaveText("4 foto(s) enviada(s).", { timeout: 15_000 });
    await expect(faltas).toHaveText("Para concluir a visita, falta a foto de: Banheiros. Envie uma foto de cada ambiente do roteiro.");
    expect(await marcadas(page)).toEqual(["fachada:sim", "sala:sim", "cozinha:sim", "quartos:sim", "banheiros:nao"]);
    await expect(page.getByTestId("visita-em-andamento").getByTestId("visita-foto")).toHaveCount(4);
    await page.context().close();
  });

  test("3. 'Concluir a visita' desativado enquanto falta foto do roteiro, com o motivo ligado ao botão; com a última foto liga sem recarregar e conclui", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.concluir!);
    const concluir = page.getByTestId("concluir-visita");
    const botao = concluir.getByRole("button", { name: "Concluir a visita" });
    const faltas = concluir.getByTestId("concluir-faltas");
    await expect(faltas).toHaveText("Para concluir a visita, falta a foto de: Banheiros. Envie uma foto de cada ambiente do roteiro.");
    await expect(botao).toBeDisabled();
    // O motivo está ligado ao botão (quem usa leitor de tela ouve porquê).
    const descritoPor = await botao.getAttribute("aria-describedby");
    expect(descritoPor, "o botão desativado aponta para o motivo").toBeTruthy();
    expect(await faltas.getAttribute("id")).toBe(descritoPor);
    await concluir.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1742-3-concluir-desativado-390.png` });
    expect(await statusDe(pedidos.concluir!)).toBe("agendado");

    // Chega a foto que faltava: o botão liga sem recarregar e a visita conclui.
    await enviarFoto(page, "Banheiro social", 11);
    await expect(faltas).toHaveCount(0, { timeout: 30_000 });
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect.poll(() => statusDe(pedidos.concluir!), { timeout: 30_000 }).toBe("realizada");
    await page.context().close();
  });

  test("4. o dB(A) guardado continua na tela depois de recarregar: no campo e na linha da última medição", async ({ browser }) => {
    const page = await naAvaliacao(browser, pedidos.ruido!);
    const form = page.getByTestId("avaliacao-dba-form");
    const campo = form.getByLabel(/dB\(A\) medido/);
    await expect(campo).toHaveValue("");
    await campo.fill("62,5");
    await form.getByRole("button", { name: "Guardar dB(A)" }).click();
    await expect(form.getByTestId("acao-ok")).toHaveText("Medição de ruído guardada (uso interno).", { timeout: 20_000 });
    // Ficou gravado.
    await expect.poll(async () => Number((await adm().from("vistoria_medicoes").select("dba").eq("pedido_id", pedidos.ruido!).eq("tipo", "ruido_dba").order("medido_em", { ascending: false }).limit(1).maybeSingle()).data?.dba ?? NaN), { timeout: 15_000 }).toBe(62.5);
    // Sem recarregar, a tela já mostra o que guardou.
    await expect(page.getByTestId("avaliacao-dba-guardado")).toHaveText("Última medição guardada: 62,5 dB(A).", { timeout: 15_000 });
    await expect(campo).toHaveValue("62,5");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Visita em andamento" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("avaliacao-dba-guardado")).toHaveText("Última medição guardada: 62,5 dB(A).");
    await expect(page.getByTestId("avaliacao-dba-form").getByLabel(/dB\(A\) medido/)).toHaveValue("62,5");
    await page.getByTestId("avaliacao-dba-form").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1742-4-dba-guardado-390.png` });

    // Uma medição nova substitui a que a tela mostra (a anterior fica no histórico interno).
    await page.getByTestId("avaliacao-dba-form").getByLabel(/dB\(A\) medido/).fill("48");
    await page.getByTestId("avaliacao-dba-form").getByRole("button", { name: "Guardar dB(A)" }).click();
    await expect(page.getByTestId("avaliacao-dba-guardado")).toHaveText("Última medição guardada: 48 dB(A).", { timeout: 20_000 });
    await page.context().close();
  });
});
