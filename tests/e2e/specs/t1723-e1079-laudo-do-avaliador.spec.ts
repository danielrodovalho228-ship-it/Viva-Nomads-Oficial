import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T1723 — E1079 @E1079, fatia 5 (ORDEM-DUET-385/397): o laudo do avaliador pelo mockup aprovado (avaliador-laudo).
  Massa própria, só contas de teste: um avaliador ativo e três avaliações com a visita já concluída
  (duas com o checklist completo e 2 fotos; uma com 1 item por responder e sem foto).
   1. A 390 e a 1280 px: "Laudo da avaliação", "Escolha o nível do imóvel", os três níveis em cartões com a frase do
      desenho, NENHUM pré-marcado (a plataforma não calcula o nível), o resumo "2 fotos enviadas" e "Checklist
      completo", e o bloco de assinar ANTES do checklist. Escolher um nível marca o cartão. Sem rolagem lateral.
   2. Sem escolher o nível, "Assinar laudo" não emite nada. Escolhido "Premium" e assinado, o laudo sai e o nível
      GRAVADO é o que o avaliador escolheu (ORDEM-397, ponto 1).
   3. Checklist com item por responder e sem foto: o resumo diz o que falta e nunca "completo".
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1723.${sufixo}@lab.vivanomads.test`, nome: "Dora Laudo Sobrenome", role: "owner" as const };
const aval = { email: `av.t1723.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const ids: { dono?: string; aval?: string; cred?: string } = {};
const imoveis: string[] = [];
const pedidos: { tela?: string; assinar?: string; incompleto?: string } = {};
const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };

/** Uma avaliação com a visita concluída, o checklist respondido (menos `pular`) e `fotos` fotos de cômodo. */
async function visitaConcluida(nome: string, pular: string[], fotos: number): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Laudo ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  const agora = new Date();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "realizada", avaliador_id: ids.cred, designado_em: agora.toISOString(), agendado_para: new Date(agora.getTime() - 2 * 3_600_000).toISOString(), visita_concluida_em: agora.toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  await adm().from("vistoria_designacoes").insert({ pedido_id: id, avaliador_id: ids.cred, resposta: "aceita", respondido_em: agora.toISOString() });
  const linhas = ITENS_CHECKLIST.filter((i) => !pular.includes(i.chave)).map((i) => ({ pedido_id: id, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null }));
  const { error: e2 } = await adm().from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
  if (e2) throw e2;
  await adm().from("vistoria_pedidos").update({ ruido_respostas: SILENCIO }).eq("id", id);
  await adm().from("vistoria_medicoes").insert([
    { pedido_id: id, tipo: "internet", ponto: "quarto_principal", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
    { pedido_id: id, tipo: "internet", ponto: "trabalho", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
  ]);
  for (let n = 0; n < fotos; n++) {
    const { error: e3 } = await adm().from("vistoria_checklist_fotos").insert({ pedido_id: id, comodo: n === 0 ? "sala" : `quarto ${n}`, path: `${id}/comodo-${n}.webp` });
    if (e3) throw e3;
  }
  return id;
}

async function noLaudo(browser: Browser, pedido: string, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, aval.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t344).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Laudo da avaliação" })).toBeVisible({ timeout: 30_000 });
  return page;
}
const statusDe = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status as string;

test.describe("T1723 — E1079: o laudo do avaliador pelo mockup (níveis em cartões, resumo, Assinar laudo) @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1723-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
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
    pedidos.tela = await visitaConcluida("tela", [], 2);
    pedidos.assinar = await visitaConcluida("assinar", [], 2);
    pedidos.incompleto = await visitaConcluida("incompleto", [ITENS_CHECKLIST[0].chave], 0);
  });

  test.afterAll(async () => {
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    await apagarContas([ids.aval, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. a ${largura} px: título e subtítulo do desenho, três níveis em cartões sem nenhum pré-marcado, resumo e o bloco antes do checklist`, async ({ browser }) => {
      const page = await noLaudo(browser, pedidos.tela!, largura);
      await expect(page.locator("main")).toContainText("Escolha o nível do imóvel");
      const form = page.getByTestId("enviar-laudo");
      const niveis = form.getByTestId("laudo-nivel").locator("label");
      await expect(niveis).toHaveText([/^Essencial\s*Simples e funcional$/, /^Conforto\s*Bem equipado e acolhedor$/, /^Premium\s*Acabamento superior$/]);
      // A plataforma não calcula o nível: nada vem escolhido.
      await expect(form.getByRole("radio", { checked: true })).toHaveCount(0);
      // O resumo diz o que o sistema tem.
      const resumo = form.getByTestId("laudo-resumo").locator("li");
      await expect(resumo).toHaveText(["2 fotos enviadas", "Checklist completo"]);
      await expect(resumo.nth(0)).toHaveAttribute("data-ok", "sim");
      await expect(resumo.nth(1)).toHaveAttribute("data-ok", "sim");
      await expect(form.getByRole("button", { name: "Assinar laudo" })).toBeVisible();
      // O bloco de assinar vem antes do checklist (na etapa do laudo).
      const yLaudo = (await form.boundingBox())!.y;
      const yChecklist = (await page.getByRole("heading", { name: "Itens", exact: true }).boundingBox())!.y;
      expect(yLaudo, "o laudo vem antes do checklist").toBeLessThan(yChecklist);
      // Escolher marca o cartão: a moldura verde-escura do desenho.
      const conforto = form.getByTestId("laudo-nivel-conforto");
      await conforto.click();
      await expect(conforto.getByRole("radio")).toBeChecked();
      await expect(form.getByRole("radio", { checked: true })).toHaveCount(1);
      await expect.poll(async () => conforto.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe("rgb(11, 72, 48)");
      expect(await form.getByTestId("laudo-nivel-premium").evaluate((el) => getComputedStyle(el).borderTopColor), "os outros ficam sem moldura").not.toBe("rgb(11, 72, 48)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${SAIDA}/t1723-1-laudo-${largura}.png` });
      await form.screenshot({ path: `${SAIDA}/t1723-1-laudo-bloco-${largura}.png` });
      await page.context().close();
    });
  }

  test("2. sem nível não assina; com 'Premium' escolhido e assinado, o nível gravado é o que o avaliador escolheu", async ({ browser }) => {
    const page = await noLaudo(browser, pedidos.assinar!, 390);
    const form = page.getByTestId("enviar-laudo");
    await form.getByTestId("assino-laudo").getByRole("checkbox").check();
    await form.getByRole("button", { name: "Assinar laudo" }).click();
    // Sem nível escolhido o navegador não envia (o campo é obrigatório): nada é emitido.
    await expect(form.locator('input[name="nivel"]:invalid')).toHaveCount(3);
    await page.waitForTimeout(1_500);
    expect(await statusDe(pedidos.assinar!), "sem nível, a avaliação continua por assinar").toBe("realizada");
    expect(((await adm().from("vistoria_laudos").select("id").eq("pedido_id", pedidos.assinar!)).data ?? []).length).toBe(0);
    await form.getByTestId("laudo-nivel-premium").click();
    await form.getByRole("button", { name: "Assinar laudo" }).click();
    await expect.poll(async () => statusDe(pedidos.assinar!), { timeout: 30_000 }).toBe("laudo_emitido");
    const { data: laudo } = await adm().from("vistoria_laudos").select("nivel_sustentado, assinado_em").eq("pedido_id", pedidos.assinar!).order("versao", { ascending: false }).limit(1).single();
    expect(laudo?.nivel_sustentado, "o nível gravado é o escolhido no laudo assinado").toBe("premium");
    expect(laudo?.assinado_em, "o laudo sai assinado").not.toBeNull();
    await page.context().close();
  });

  test("3. checklist com item por responder e sem foto: o resumo diz o que falta, nunca 'completo'", async ({ browser }) => {
    const page = await noLaudo(browser, pedidos.incompleto!, 390);
    const resumo = page.getByTestId("enviar-laudo").getByTestId("laudo-resumo").locator("li");
    await expect(resumo).toHaveText(["Nenhuma foto enviada", "Checklist incompleto: falta 1 item"]);
    await expect(resumo.nth(0)).toHaveAttribute("data-ok", "nao");
    await expect(resumo.nth(1)).toHaveAttribute("data-ok", "nao");
    await expect(page.getByTestId("enviar-laudo")).not.toContainText("Checklist completo");
    await page.getByTestId("enviar-laudo").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1723-3-laudo-incompleto-390.png` });
    await page.context().close();
  });
});
