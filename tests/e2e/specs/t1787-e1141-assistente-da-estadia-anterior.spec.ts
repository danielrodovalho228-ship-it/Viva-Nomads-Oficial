import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1787 — E1141 @E1141 (2.ª fatia da ESPEC-E1090; âmbito julgado na ORDEM-DUET-929; trava de tela dada na mesma ordem).
  Antes: na lista "Seus fechamentos", a estadia ANTERIOR sem contrato (a forma da ORC-2026-0015 de produção: "em
  contrato" sem contrato, ao lado de uma proposta mais nova com contrato) só levava ao orçamento — o dono não a fechava.
  Depois: essa linha tem "Abrir fechamento", com `?c=<candidatura>&p=<proposta>`, e o assistente abre com os valores
  DESSA proposta. O `p` é validado no servidor. Massa só no banco do laboratório, contas de teste:
   1. (1280 e 390 px) A linha da estadia anterior abre o assistente dela: a linha fica marcada e o assistente mostra o
      número da proposta antiga (não o da nova). Print nas duas larguras.
   2. Sem p, como antes: a página abre a estadia mais nova.
   3. p de uma estadia que já tem contrato: o assistente abre só para leitura, com "Ver contrato" e sem "Gerar
      contrato" (alterado na ORDEM-DUET-982; antes levava ao contrato por redirect).
   4. p de outra candidatura: "Não encontramos esse fechamento" e nenhum assistente dessa proposta.
   5. (guarda 4 do coordenador, ORDEM-DUET-933) Chamada DIRETA às rotas da taxa e do contrato com um p alheio (de outra
      candidatura) ou numa fase errada (proposta enviada, não acordada): as duas recusam com a mesma mensagem e nada é
      reservado nem cobrado (nenhuma linha em cobrancas_fechamento da candidatura).
  Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1094): corre também no portão do #4084, porque o #4084 mexe no assistente do
  Fechamento e no 1º pagamento; a t1789 tem o caso combinado E1141×#4084.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (nome: string, quem: string, role: "owner" | "tenant") => ({ email: `${quem}.t1787.${sufixo}@lab.vivanomads.test`, nome, role });
const D = conta("Doris Estadias Sobrenome", "dona", "owner");
const M = conta("Milena Estadias Sobrenome", "mora", "tenant");
const N = conta("Nadia Estadias Sobrenome", "mora2", "tenant");

const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const haDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const T = { B: `[TESTE QA] Estadias B ${sufixo}`, O: `[TESTE QA] Estadias outra ${sufixo}` };

async function aceitar(lead: string, quando: string) {
  const { error } = await adm().from("leads").update({ accepted_at: quando, accepted_plan: "essential", accepted_commission_rate: 0.12 }).eq("id", lead);
  if (error) throw error;
}

/** Uma proposta acordada, gravada no banco com a versão atual (valor próprio, para se ver qual o assistente abriu). */
async function proposta(lead: string, imovel: string, dono: string, morador: string, status: string, aceitaEm: string, entrada: string, valor: number): Promise<{ id: string; numero: string }> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: lead, property_id: imovel, owner_id: dono, tenant_id: morador, status, versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: aceitaEm })
    .select("id, numero")
    .single();
  if (error) throw error;
  const { error: ev } = await adm().from("proposta_versoes").insert({
    proposta_id: data.id, versao: 1, autor: "owner", valor_base: valor, valor_mensal: valor, meses: 2, data_entrada: entrada, total_mensal: valor, total_contrato: valor * 2, mensagem: "Proposta da t1787.",
  });
  if (ev) throw ev;
  return { id: data.id as string, numero: data.numero as string };
}

async function contrato(lead: string, imovel: string, morador: string, propostaId: string, inicio: string, fim: string, criadoEm: string): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({ lead_id: lead, property_id: imovel, tenant_id: morador, proposta_id: propostaId, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 2800, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", periodo: `[${inicio},${fim}]`, created_at: criadoEm, assinado_proprietario_em: criadoEm, assinado_inquilino_em: criadoEm })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function noFechamento(browser: Browser, largura: 390 | 1280, busca = ""): Promise<Page> {
  const page = await entrar(browser, D.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/fechamento${busca}`, { waitUntil: "domcontentloaded" });
  return page;
}
const linhaDe = (page: Page, chave: string) => page.locator(`[data-testid="fecho-linha"][data-chave="${chave}"]`);

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  for (const [k, c] of Object.entries({ D, M, N })) ids[k] = await criarConta(c, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", Object.values(ids));
  ids.imB = await criarImovelPronto(ids.D, T.B, { ativo: true, preco: 2800 });
  ids.imO = await criarImovelPronto(ids.D, T.O, { ativo: true, preco: 2800 });

  // A forma do caso de produção: a ORC antiga "em contrato" SEM contrato; a nova com contrato assinado.
  ids.leadB = await criarLead(ids.D, ids.M, ids.imB, true);
  await aceitar(ids.leadB, haDias(6));
  const antiga = await proposta(ids.leadB, ids.imB, ids.D, ids.M, "em_contrato", haDias(5), emDias(100), 3100);
  ids.orcAntiga = antiga.id;
  ids.numAntiga = antiga.numero;
  const nova = await proposta(ids.leadB, ids.imB, ids.D, ids.M, "contrato_assinado", haDias(4), emDias(20), 2800);
  ids.orcNova = nova.id;
  ids.numNova = nova.numero;
  ids.ctB = await contrato(ids.leadB, ids.imB, ids.M, nova.id, emDias(20), emDias(79), haDias(3));
  // Uma proposta da mesma candidatura numa fase errada (enviada, ainda não acordada).
  ids.orcEnviada = (await proposta(ids.leadB, ids.imB, ids.D, ids.M, "enviada", haDias(1), emDias(140), 3300)).id;

  // Outra candidatura da mesma dona, com a sua proposta acordada (para o p de outra candidatura).
  ids.leadO = await criarLead(ids.D, ids.N, ids.imO, true);
  await aceitar(ids.leadO, haDias(8));
  ids.orcOutra = (await proposta(ids.leadO, ids.imO, ids.D, ids.N, "aceita", haDias(7), emDias(30), 2900)).id;
});

test.afterAll(async () => {
  const leads = [ids.leadB, ids.leadO].filter(Boolean);
  if (leads.length) {
    await adm().from("cobrancas_fechamento").delete().in("lead_id", leads);
    await adm().from("contratos").delete().in("lead_id", leads);
    await adm().from("propostas").delete().in("lead_id", leads);
    await adm().from("leads").delete().in("id", leads);
  }
  const imoveis = [ids.imB, ids.imO].filter(Boolean);
  if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
  await apagarContas([ids.D, ids.M, ids.N]);
});

test.describe("T1787 — E1141: o assistente da estadia anterior @E1141", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  for (const largura of [1280, 390] as const) {
    test(`1. a estadia anterior sem contrato abre o assistente dela (${largura} px)`, async ({ browser }) => {
      const page = await noFechamento(browser, largura);
      await expect(page.getByTestId("seus-fechamentos")).toBeVisible({ timeout: 30_000 });
      const anterior = linhaDe(page, `A:${ids.orcAntiga}`);
      await expect(anterior.getByTestId("fecho-estado")).toHaveText("Por gerar");
      const acao = anterior.getByTestId("fecho-acao");
      await expect(acao).toHaveAttribute("data-acao", "assistente");
      await expect(acao).toHaveText("Abrir fechamento");
      await expect(acao).toHaveAttribute("href", `/dashboard/fechamento?c=${ids.leadB}&p=${ids.orcAntiga}`);
      await expect(acao).toBeInViewport({ ratio: 0.5 });
      await acao.click();
      await page.waitForURL((u) => u.searchParams.get("p") === ids.orcAntiga, { timeout: 30_000 });
      await expect(linhaDe(page, `A:${ids.orcAntiga}`)).toHaveAttribute("data-atual", "sim", { timeout: 30_000 });
      await expect(linhaDe(page, `A:${ids.orcNova}`)).toHaveAttribute("data-atual", "nao");
      const valores = page.getByTestId("fechamento-proposta");
      await expect(valores).toContainText(ids.numAntiga);
      await expect(valores).not.toContainText(ids.numNova);
      await page.screenshot({ path: `${SAIDA}/t1787-caso1-${largura}.png`, fullPage: true });
      await page.context().close();
    });
  }

  test("2. sem p, como antes: a candidatura abre a estadia mais nova", async ({ browser }) => {
    const page = await noFechamento(browser, 1280, `?c=${ids.leadB}`);
    await expect(linhaDe(page, `A:${ids.orcNova}`)).toHaveAttribute("data-atual", "sim", { timeout: 30_000 });
    await expect(linhaDe(page, `A:${ids.orcAntiga}`)).toHaveAttribute("data-atual", "nao");
    await page.context().close();
  });

  // Caso 3 alterado (ORDEM-DUET-982, sobre a decisão da ORDEM-DUET-978): sem redirect; o assistente abre só para
  // leitura, com "Ver contrato" (para o contrato dessa estadia) e sem "Gerar contrato".
  test("3. p de uma estadia que já tem contrato: o assistente abre só para leitura, com Ver contrato e sem Gerar contrato", async ({ browser }) => {
    const page = await noFechamento(browser, 1280, `?c=${ids.leadB}&p=${ids.orcNova}`);
    const verContrato = page.getByTestId("fechamento-somente-leitura");
    await expect(verContrato).toBeVisible({ timeout: 30_000 });
    await expect(verContrato).toHaveText("Ver contrato");
    await expect(verContrato).toHaveAttribute("href", `/dashboard/contratos/${ids.ctB}`);
    await expect(page.getByTestId("fechamento-gerar-contrato")).toHaveCount(0);
    expect(new URL(page.url()).pathname, "sem redirect: continua no fechamento").toBe("/dashboard/fechamento");
    expect(new URL(page.url()).searchParams.get("p")).toBe(ids.orcNova);
    await page.context().close();
  });

  test("4. p de outra candidatura: não encontrado, e o assistente não abre essa proposta", async ({ browser }) => {
    const page = await noFechamento(browser, 1280, `?c=${ids.leadB}&p=${ids.orcOutra}`);
    await expect(page.getByTestId("fechamento-nao-encontrado")).toHaveText("Não encontramos esse fechamento. Estes são os seus.", { timeout: 30_000 });
    await expect(linhaDe(page, `A:${ids.orcAntiga}`)).toHaveAttribute("data-atual", "nao");
    await page.context().close();
  });

  test("5. chamada direta às rotas com um p alheio ou numa fase errada: recusada, sem efeito", async ({ browser }) => {
    const page = await noFechamento(browser, 1280);
    for (const rota of ["/api/comissao", "/api/contrato"]) {
      for (const p of [ids.orcOutra, ids.orcEnviada]) {
        const r = await page.request.post(rota, { data: { leadId: ids.leadB, propostaId: p, termMonths: 2, guarantee: "Caução", costSplit: {} } });
        expect(r.status(), `${rota} com ${p}`).toBe(404);
        expect((await r.json()).error, `${rota} com ${p}`).toBe("Não encontramos esse fechamento.");
      }
    }
    const { data: cobrancas, error } = await adm().from("cobrancas_fechamento").select("id").eq("lead_id", ids.leadB);
    expect(error).toBeNull();
    expect(cobrancas ?? []).toHaveLength(0);
    await page.context().close();
  });
});
