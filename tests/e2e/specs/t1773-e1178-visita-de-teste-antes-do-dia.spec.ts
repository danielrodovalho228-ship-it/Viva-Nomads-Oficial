import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T1773 — E1178 @E1178 (ORDENS-DUET 777 e 779; decisão do coordenador; linha Parceiros). Duas coisas no mesmo item:
   • a exceção de teste: o pedido de TESTE com o avaliador de TESTE faz a visita antes do dia marcado;
   • o furo de segurança: a regra "a visita só começa no dia marcado" só existia na etiqueta da tela — o servidor
     aceitava itens, fotos e a conclusão em qualquer dia. Agora a tela e o servidor leem a mesma função.
  Massa própria: um dono e um avaliador de TESTE, e um avaliador REAL (conta sem a marca de teste), só no laboratório.
   1. O avaliador de teste abre o pedido de teste agendado para depois de amanhã: vê a faixa "Visita de teste —
      liberada antes do dia marcado." e o checklist, responde um item, envia a foto que faltava e conclui a visita.
      Print a 390 e a 1280 px.
   2. O avaliador real, num pedido real antes do dia: a tela diz "A visita só começa no dia marcado.", sem faixa de
      teste, sem checklist e sem "Concluir a visita". O roteiro e as fotos continuam lá, só em leitura (ORDEM-431).
      Print a 390 e a 1280 px.
   3. O servidor recusa na mesma: com a página aberta no dia, a visita é reagendada para outro dia; o item respondido
      e o "Concluir a visita" voltam com "A visita só começa no dia marcado." e nada é gravado.
   4. Só os dois juntos: pedido de teste com avaliador real, e pedido real com avaliador de teste, não passam.
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Patrocínio";
const BUCKET = "avaliacao-imovel";
const HORA = 3_600_000;
const FAIXA = "Visita de teste — liberada antes do dia marcado.";
const RECUSA = "A visita só começa no dia marcado.";
const ROTEIRO = ["Fachada do prédio", "Sala de estar", "Cozinha", "Quarto de casal", "Banheiro social"];
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1773.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const avalTeste = { email: `av.teste.t1773.${sufixo}@lab.vivanomads.test`, nome: "Tito Teste Avaliador", role: "tenant" as const };
const avalReal = { email: `av.real.t1773.${sufixo}@lab.vivanomads.test`, nome: "Rita Avaliadora", role: "tenant" as const };
const ids: { dono?: string; avalTeste?: string; avalReal?: string; credTeste?: string; credReal?: string } = {};
const imoveis: string[] = [];
const pedidos: { teste?: string; real?: string; testeComReal?: string; realComTeste?: string } = {};

/** Depois de amanhã, à mesma hora: em qualquer hora do dia, o dia de Brasília do agendamento ainda não chegou. */
const outroDia = () => new Date(Date.now() + 48 * HORA).toISOString();

async function credenciar(conta: { nome: string }, userId: string, apelido: string): Promise<string> {
  const { data: parc, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `aval-t1773-${apelido}-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (error) throw error;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: c, error: e2 } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, user_id: userId, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1773", conduta_versao: "2026-10-23", ativado_em: "2026-01-01T00:00:00Z" })
    .select("id")
    .single();
  if (e2) throw e2;
  return c.id as string;
}

/** Uma avaliação agendada, com as fotos de cômodo dadas. */
async function avaliacao(nome: string, cred: string, pedidoDeTeste: boolean, agendadoPara: string, comodos: string[]): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `Lar t1773 ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "agendado", teste: pedidoDeTeste, avaliador_id: cred, designado_em: agora, agendado_para: agendadoPara })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: id, avaliador_id: cred, resposta: "aceita", respondido_em: agora });
  if (d.error) throw d.error;
  for (const [n, comodo] of comodos.entries()) {
    const path = `${id}/t1773-${n}`;
    const up = await adm().storage.from(BUCKET).upload(path, pngDeTeste(n + 3, 320, 320), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    const { error: e2 } = await adm().from("vistoria_checklist_fotos").insert({ pedido_id: id, comodo, path });
    if (e2) throw e2;
  }
  return id;
}

async function naAvaliacao(browser: Browser, conta: { email: string }, pedido: string, largura = 390): Promise<Page> {
  const page = await entrar(browser, conta.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t1725 e na t1742).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  return page;
}
const statusDe = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status as string;
const nItens = async (pedido: string) => ((await adm().from("vistoria_checklist").select("chave").eq("pedido_id", pedido)).data ?? []).length;
const nFotos = async (pedido: string) => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedido)).data ?? []).length;
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** A tela de antes do dia: o aviso, e nada do que o servidor recusaria. */
async function esperaTravada(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Visita agendada" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("visita-antes-do-dia")).toHaveText(RECUSA);
  await expect(page.getByTestId("visita-de-teste")).toHaveCount(0);
  await expect(page.getByTestId("checklist-avaliador")).toHaveCount(0);
  await expect(page.getByTestId("avaliacao-foto-form")).toHaveCount(0);
  await expect(page.getByTestId("concluir-visita")).toHaveCount(0);
  // ORDEM-431: o roteiro e as fotos já enviadas continuam na tela, sem o que leva ao envio.
  await expect(page.getByTestId("visita-em-andamento").getByRole("heading", { name: "Roteiro da visita" })).toBeVisible();
  await expect(page.getByTestId("visita-foto")).toHaveCount(ROTEIRO.length);
  await expect(page.getByTestId("visita-adicionar-foto")).toHaveCount(0);
  await expect(page.getByTestId("visita-continuar")).toHaveCount(0);
}

test.describe("T1773 — E1178: a visita de teste antes do dia, e a trava do dia também no servidor @E1178", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.avalTeste = await criarConta(avalTeste, senha);
    ids.avalReal = await criarConta(avalReal, senha);
    // Só o dono e o avaliador de teste levam a marca de teste; a Rita é uma conta real do laboratório.
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.avalTeste]);
    if (t.error) throw t.error;
    const r = await adm().from("profiles").update({ is_teste: false }).eq("id", ids.avalReal);
    if (r.error) throw r.error;
    ids.credTeste = await credenciar(avalTeste, ids.avalTeste, "teste");
    ids.credReal = await credenciar(avalReal, ids.avalReal, "real");
    pedidos.teste = await avaliacao("teste", ids.credTeste, true, outroDia(), ROTEIRO.slice(0, 4));
    pedidos.real = await avaliacao("real", ids.credReal, false, outroDia(), ROTEIRO);
    pedidos.testeComReal = await avaliacao("teste-com-real", ids.credReal, true, outroDia(), ROTEIRO);
    pedidos.realComTeste = await avaliacao("real-com-teste", ids.credTeste, false, outroDia(), ROTEIRO);
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const { data: fotos } = await adm().from("vistoria_checklist_fotos").select("path, vistoria_pedidos!inner(property_id)").in("vistoria_pedidos.property_id", imoveis);
      const todos = [...new Set(((fotos ?? []) as { path: string }[]).map((f) => f.path))];
      if (todos.length) await adm().storage.from(BUCKET).remove(todos);
      const contas = [ids.dono, ids.avalTeste, ids.avalReal].filter(Boolean);
      if (contas.length) {
        await adm().from("emails_teste").delete().in("usuario_id", contas);
        await adm().from("avisos").delete().in("usuario_id", contas);
      }
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
      await adm().from("properties").delete().in("id", imoveis);
    }
    for (const cred of [ids.credTeste, ids.credReal]) {
      if (!cred) continue;
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", cred);
    }
    await apagarContas([ids.avalTeste, ids.avalReal, ids.dono].filter(Boolean) as string[]);
  });

  test("1. o avaliador de teste abre o pedido de teste antes do dia: vê a faixa e o checklist, responde um item, envia a foto e conclui a visita", async ({ browser }) => {
    const page = await naAvaliacao(browser, avalTeste, pedidos.teste!);
    await expect(page.getByTestId("visita-de-teste")).toHaveText(FAIXA, { timeout: 30_000 });
    // O dia ainda não chegou: o título não se adianta, e não há o aviso de antes do dia.
    await expect(page.getByRole("heading", { level: 1, name: "Visita agendada" })).toBeVisible();
    await expect(page.getByTestId("visita-antes-do-dia")).toHaveCount(0);
    await expect(page.getByTestId("checklist-avaliador")).toBeVisible();
    for (const w of LARGURAS) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await expect(page.getByTestId("visita-de-teste")).toBeVisible();
      expect(await semRolagemLateral(page), `sem rolagem lateral a ${w} px`).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t1773-1-visita-de-teste-${w}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Um item do checklist: o servidor aceita.
    expect(await nItens(pedidos.teste!)).toBe(0);
    await page.locator('[data-testid="checklist-avaliador"] button[data-testid^="item-"]').first().click();
    await expect.poll(() => nItens(pedidos.teste!), { timeout: 30_000 }).toBe(1);
    await expect(page.getByText(RECUSA)).toHaveCount(0);
    // A foto que faltava no roteiro: o servidor aceita, e o botão de concluir liga.
    const concluir = page.getByTestId("concluir-visita");
    const botao = concluir.getByRole("button", { name: "Concluir a visita" });
    await expect(botao).toBeDisabled();
    const form = page.getByTestId("avaliacao-foto-form");
    await form.getByLabel("Cômodo", { exact: true }).fill(ROTEIRO[4]);
    await form.locator('input[type="file"]').setInputFiles({ name: "banheiro.png", mimeType: "image/png", buffer: pngDeTeste(11) });
    await form.getByRole("button", { name: "Enviar foto" }).click();
    await expect.poll(() => nFotos(pedidos.teste!), { timeout: 30_000 }).toBe(5);
    await expect(botao).toBeEnabled({ timeout: 30_000 });
    await botao.click();
    await expect.poll(() => statusDe(pedidos.teste!), { timeout: 30_000 }).toBe("realizada");
    await page.context().close();
  });

  test("2. o avaliador real, num pedido real antes do dia: a tela diz 'A visita só começa no dia marcado.', sem checklist nem conclusão", async ({ browser }) => {
    const page = await naAvaliacao(browser, avalReal, pedidos.real!);
    await esperaTravada(page);
    await expect(page.getByTestId("visita-antes-do-dia-data")).toContainText("Visita marcada para");
    for (const w of LARGURAS) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await expect(page.getByTestId("visita-antes-do-dia")).toBeVisible();
      expect(await semRolagemLateral(page), `sem rolagem lateral a ${w} px`).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t1773-2-antes-do-dia-${w}.png` });
    }
    expect(await statusDe(pedidos.real!)).toBe("agendado");
    await page.context().close();
  });

  test("3. o servidor recusa na mesma: com a página aberta no dia e a visita reagendada, o item e o 'Concluir a visita' voltam com o texto e nada é gravado", async ({ browser }) => {
    // No dia marcado, a visita real abre como sempre.
    const noDia = await adm().from("vistoria_pedidos").update({ agendado_para: new Date().toISOString() }).eq("id", pedidos.real!);
    if (noDia.error) throw noDia.error;
    const page = await naAvaliacao(browser, avalReal, pedidos.real!);
    await expect(page.getByRole("heading", { level: 1, name: "Visita em andamento" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("visita-de-teste")).toHaveCount(0);
    await expect(page.getByTestId("checklist-avaliador")).toBeVisible();
    const botao = page.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" });
    await expect(botao).toBeEnabled();
    // A visita passa para outro dia com a página ainda aberta: a tela já não vale, quem responde é o servidor.
    const reagendada = await adm().from("vistoria_pedidos").update({ agendado_para: outroDia() }).eq("id", pedidos.real!);
    if (reagendada.error) throw reagendada.error;
    await page.locator('[data-testid="checklist-avaliador"] button[data-testid^="item-"]').first().click();
    await expect(page.getByTestId("checklist-avaliador").getByRole("alert")).toHaveText(RECUSA, { timeout: 30_000 });
    expect(await nItens(pedidos.real!), "o item recusado não é gravado").toBe(0);
    await botao.click();
    await expect(page.getByTestId("concluir-visita").getByText(RECUSA)).toBeVisible({ timeout: 30_000 });
    expect(await statusDe(pedidos.real!), "a visita não conclui antes do dia").toBe("agendado");
    // Recarregada, a tela volta a dizer o mesmo que o servidor.
    await page.reload({ waitUntil: "domcontentloaded" });
    await esperaTravada(page);
    await page.context().close();
  });

  test("4. só os dois juntos: pedido de teste com avaliador real, e pedido real com avaliador de teste, não passam antes do dia", async ({ browser }) => {
    const real = await naAvaliacao(browser, avalReal, pedidos.testeComReal!);
    await esperaTravada(real);
    await real.context().close();
    const teste = await naAvaliacao(browser, avalTeste, pedidos.realComTeste!);
    await esperaTravada(teste);
    await teste.context().close();
  });
});
