import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  Vizinha do E1247 passo 2, PR 2 (ESPEC-E1247-PASSO-2, 5): os avisos do pré-aceite passam a eventos próprios, com a proposta como referência. Corre sem alteração.
  T1786 — E1090 @E1090 (ESPEC-E1090, fechada na ORDEM-DUET-610/611; trava dada na ORDEM-DUET-873).
  Antes: o Fechamento abria só a candidatura aceita mais recente do dono, sem lista; o fecho de outra candidatura não se
  alcançava pelo menu, e a pré-aceitação expirada da mais recente escondia as outras atrás de "Nenhuma candidatura
  aceita ainda". Na prova ao vivo, o dono tinha dois contratos e o Fechamento mostrava um.
  Massa só no banco do laboratório, contas de teste, quatro donas (cada uma vê só os seus fechos):
   1. O caso de produção + o caso 13 (dona 1): o imóvel A com um contrato sem proposta, assinado; o imóvel B com duas
      propostas aceitas — a ORC antiga gravada "em contrato" SEM contrato, a nova com contrato assinado. Pelo menu,
      "Seus fechamentos" tem três linhas: a ORC antiga "Por gerar", em primeiro, sem número de contrato e (E1141) com
      "Abrir fechamento" da estadia dela; cada contrato na sua linha, com o seu número (lido do banco). "Abrir
      fechamento" na outra linha abre-a.
      Print a 390 e a 1280 px.
   2. O que falta gerar vem primeiro, e a expirada não esconde as outras (dona 2): P aceita há mais tempo, por gerar; S
      aceita depois, contrato assinado; X a mais recente, pré-aceitação expirada e sem contrato. Pelo menu abre P; X
      não aparece; "Nenhuma candidatura aceita ainda" não aparece. Com ?c= de S, S fica marcada.
   3. Uma só (dona 3): sem bloco de lista; o assistente como antes.
   4. ?c= alheio (dona 3 com o ?c= de P, da dona 2): o aviso "Não encontramos esse fechamento"; só os fechos da dona 3;
      o imóvel e a moradora da dona 2 não estão na página.
   5. Todas expiradas e sem contrato (dona 4): o texto próprio, com o caminho para Interessados — não "Nenhuma
      candidatura aceita ainda".
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (nome: string, quem: string, role: "owner" | "tenant") => ({ email: `${quem}.t1786.${sufixo}@lab.vivanomads.test`, nome, role });
const D1 = conta("Dora Fechos Sobrenome", "dona1", "owner");
const D2 = conta("Diva Fechos Sobrenome", "dona2", "owner");
const D3 = conta("Dulce Fechos Sobrenome", "dona3", "owner");
const D4 = conta("Dalia Fechos Sobrenome", "dona4", "owner");
const M1 = conta("Marta Fechos Sobrenome", "mora1", "tenant");
const M2 = conta("Mirna Fechos Sobrenome", "mora2", "tenant");
const M3 = conta("Moema Fechos Sobrenome", "mora3", "tenant");

const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const haDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const T = {
  A: `[TESTE QA] Fecho A sem proposta ${sufixo}`,
  B: `[TESTE QA] Fecho B duas propostas ${sufixo}`,
  P: `[TESTE QA] Fecho P por gerar ${sufixo}`,
  S: `[TESTE QA] Fecho S assinado ${sufixo}`,
  X: `[TESTE QA] Fecho X expirado ${sufixo}`,
  U: `[TESTE QA] Fecho U unico ${sufixo}`,
  Z: `[TESTE QA] Fecho Z expirado ${sufixo}`,
};

async function aceitar(lead: string, quando: string) {
  const { error } = await adm().from("leads").update({ accepted_at: quando, accepted_plan: "essential", accepted_commission_rate: 0.12 }).eq("id", lead);
  if (error) throw error;
}

/** Uma proposta já acordada (ou expirada), gravada no banco com a versão atual. */
async function proposta(lead: string, imovel: string, dono: string, morador: string, status: string, aceitaEm: string, entrada: string): Promise<{ id: string; numero: string }> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: lead, property_id: imovel, owner_id: dono, tenant_id: morador, status, versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: aceitaEm })
    .select("id, numero")
    .single();
  if (error) throw error;
  const { error: ev } = await adm().from("proposta_versoes").insert({
    proposta_id: data.id, versao: 1, autor: "owner", valor_base: 2800, valor_mensal: 2800, meses: 2, data_entrada: entrada, total_mensal: 2800, total_contrato: 5600, mensagem: "Proposta da t1786.",
  });
  if (ev) throw ev;
  return { id: data.id as string, numero: data.numero as string };
}

/** Um contrato assinado pelas duas partes, gravado no banco (como nas t1720/t1726). */
async function contrato(lead: string, imovel: string, morador: string, propostaId: string | null, inicio: string, fim: string, criadoEm: string): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({ lead_id: lead, property_id: imovel, tenant_id: morador, proposta_id: propostaId, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 2800, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", periodo: `[${inicio},${fim}]`, created_at: criadoEm, assinado_proprietario_em: criadoEm, assinado_inquilino_em: criadoEm })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const numeroPublico = (id: string) => `VN-CT-${id.slice(0, 8).toUpperCase()}`;

async function noFechamento(browser: Browser, email: string, largura: 390 | 1280 = 1280, c?: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(c ? `/dashboard/fechamento?c=${c}` : "/dashboard/fechamento", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Fechamento", level: 1 })).toBeVisible({ timeout: 30_000 });
  return page;
}
const linha = (page: Page, lead: string) => page.locator(`[data-testid="fecho-linha"][data-candidatura="${lead}"]`);

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  for (const [k, c] of Object.entries({ D1, D2, D3, D4, M1, M2, M3 })) ids[k] = await criarConta(c, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", Object.values(ids));
  for (const [k, titulo] of Object.entries(T)) {
    const dono = k === "A" || k === "B" ? ids.D1 : k === "U" ? ids.D3 : k === "Z" ? ids.D4 : ids.D2;
    ids[`im${k}`] = await criarImovelPronto(dono, titulo, { ativo: true, preco: 2800 });
  }

  // Dona 1 — A: contrato sem proposta, assinado. B: ORC antiga "em contrato" sem contrato; ORC nova com contrato.
  ids.leadA = await criarLead(ids.D1, ids.M1, ids.imA, true);
  await aceitar(ids.leadA, haDias(20));
  ids.ctA = await contrato(ids.leadA, ids.imA, ids.M1, null, emDias(10), emDias(70), haDias(19));
  ids.leadB = await criarLead(ids.D1, ids.M2, ids.imB, true);
  await aceitar(ids.leadB, haDias(6));
  const antiga = await proposta(ids.leadB, ids.imB, ids.D1, ids.M2, "em_contrato", haDias(5), emDias(100));
  ids.orcAntiga = antiga.id;
  ids.numAntiga = antiga.numero;
  const nova = await proposta(ids.leadB, ids.imB, ids.D1, ids.M2, "contrato_assinado", haDias(4), emDias(20));
  ids.orcNova = nova.id;
  ids.ctB = await contrato(ids.leadB, ids.imB, ids.M2, nova.id, emDias(20), emDias(79), haDias(3));

  // Dona 2 — P por gerar (a mais antiga), S assinada, X expirada (a mais recente).
  ids.leadP = await criarLead(ids.D2, ids.M1, ids.imP, true);
  await aceitar(ids.leadP, haDias(15));
  ids.leadS = await criarLead(ids.D2, ids.M2, ids.imS, true);
  await aceitar(ids.leadS, haDias(10));
  ids.ctS = await contrato(ids.leadS, ids.imS, ids.M2, null, emDias(10), emDias(70), haDias(9));
  ids.leadX = await criarLead(ids.D2, ids.M3, ids.imX, true);
  await aceitar(ids.leadX, haDias(2));
  await proposta(ids.leadX, ids.imX, ids.D2, ids.M3, "expirada", haDias(2), emDias(30));

  // Dona 3 — uma só. Dona 4 — só uma expirada, sem contrato.
  ids.leadU = await criarLead(ids.D3, ids.M3, ids.imU, true);
  await aceitar(ids.leadU, haDias(3));
  ids.leadZ = await criarLead(ids.D4, ids.M1, ids.imZ, true);
  await aceitar(ids.leadZ, haDias(3));
  await proposta(ids.leadZ, ids.imZ, ids.D4, ids.M1, "expirada", haDias(3), emDias(30));
});

test.afterAll(async () => {
  const leads = Object.entries(ids).filter(([k]) => k.startsWith("lead")).map(([, v]) => v);
  if (leads.length) {
    await adm().from("contratos").delete().in("lead_id", leads);
    await adm().from("propostas").delete().in("lead_id", leads);
    await adm().from("leads").delete().in("id", leads);
  }
  const imoveis = Object.entries(ids).filter(([k]) => k.startsWith("im")).map(([, v]) => v);
  if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
  await apagarContas([ids.D1, ids.D2, ids.D3, ids.D4, ids.M1, ids.M2, ids.M3]);
});

test.describe("T1786 — E1090: o Fechamento mostra todos os fechos do dono @E1090", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  for (const largura of [1280, 390] as const) {
    test(`1. caso de produção + caso 13 (${largura} px): três linhas, cada contrato na sua; a ORC sem contrato é "Por gerar" e vem primeiro`, async ({ browser }) => {
      const page = await noFechamento(browser, D1.email, largura);
      const bloco = page.getByTestId("seus-fechamentos");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco.getByRole("heading", { name: "Seus fechamentos" })).toBeVisible();
      const linhas = bloco.getByTestId("fecho-linha");
      await expect(linhas).toHaveCount(3);

      // A primeira: a ORC antiga, sem contrato — "Por gerar", nenhum número de contrato, "Ver orçamento" e a frase.
      const primeira = linhas.first();
      await expect(primeira).toHaveAttribute("data-chave", `A:${ids.orcAntiga}`);
      await expect(primeira.getByTestId("fecho-estado")).toHaveText("Por gerar");
      await expect(primeira.getByTestId("fecho-orcamento")).toHaveText(ids.numAntiga);
      await expect(primeira.getByTestId("fecho-contrato")).toHaveCount(0);
      await expect(primeira.getByTestId("fecho-contrato-nao-gerado")).toHaveText("O contrato desta estadia ainda não foi gerado.");
      // E1141: a estadia anterior sem contrato abre o assistente dela (antes, "Ver orçamento").
      await expect(primeira.getByTestId("fecho-acao")).toHaveAttribute("href", `/dashboard/fechamento?c=${ids.leadB}&p=${ids.orcAntiga}`);

      // Cada contrato na sua linha, com o seu número (lido do banco).
      await expect(page.locator(`[data-testid="fecho-linha"][data-chave="A:${ids.orcNova}"]`).getByTestId("fecho-contrato")).toHaveText(numeroPublico(ids.ctB));
      await expect(page.locator(`[data-testid="fecho-linha"][data-chave="B:${ids.ctA}"]`).getByTestId("fecho-contrato")).toHaveText(numeroPublico(ids.ctA));
      await expect(page.locator(`[data-testid="fecho-linha"][data-chave="B:${ids.ctA}"]`).getByTestId("fecho-imovel")).toHaveText(T.A);

      // A linha aberta está marcada; "Abrir fechamento" na outra abre-a.
      const aberta = bloco.locator('[data-testid="fecho-linha"][data-atual="sim"]');
      await expect(aberta).toHaveCount(1);
      const outra = bloco.locator('[data-testid="fecho-linha"][data-atual="nao"] [data-acao="assistente"]').first();
      const destino = (await outra.getAttribute("href"))!;
      await outra.click();
      await page.waitForURL((u) => u.search === destino.slice(destino.indexOf("?")), { timeout: 30_000 });
      // E1141: o destino pode levar `&p=` (a estadia anterior); a candidatura lê-se do parâmetro `c`.
      const candidaturaDestino = new URLSearchParams(destino.slice(destino.indexOf("?"))).get("c");
      await expect(page.locator(`[data-testid="fecho-linha"][data-candidatura="${candidaturaDestino}"][data-atual="sim"]`)).toHaveCount(1, { timeout: 30_000 });
      await page.screenshot({ path: `${SAIDA}/t1786-caso1-${largura}.png`, fullPage: true });
      await page.context().close();
    });
  }

  test("2. o que falta gerar vem primeiro e a expirada não esconde as outras", async ({ browser }) => {
    const page = await noFechamento(browser, D2.email);
    const bloco = page.getByTestId("seus-fechamentos");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco.getByTestId("fecho-linha")).toHaveCount(2);
    await expect(bloco.getByTestId("fecho-linha").first()).toHaveAttribute("data-candidatura", ids.leadP);
    await expect(linha(page, ids.leadP)).toHaveAttribute("data-atual", "sim");
    await expect(linha(page, ids.leadX)).toHaveCount(0);
    await expect(page.getByText(T.X)).toHaveCount(0);
    await expect(page.getByText("Nenhuma candidatura aceita ainda")).toHaveCount(0);
    // O assistente aberto é o de P.
    await expect(page.locator("aside").getByText(T.P).first()).toBeVisible();
    await page.goto(`/dashboard/fechamento?c=${ids.leadS}`, { waitUntil: "domcontentloaded" });
    await expect(linha(page, ids.leadS)).toHaveAttribute("data-atual", "sim", { timeout: 30_000 });
    await expect(linha(page, ids.leadP)).toHaveAttribute("data-atual", "nao");
    await page.context().close();
  });

  test("3. uma só: sem bloco de lista, o assistente como antes", async ({ browser }) => {
    const page = await noFechamento(browser, D3.email);
    await expect(page.locator("aside").getByText(T.U).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("seus-fechamentos")).toHaveCount(0);
    await page.context().close();
  });

  test("4. ?c= alheio: o aviso e só os fechos próprios; nada da outra dona", async ({ browser }) => {
    const page = await noFechamento(browser, D3.email, 1280, ids.leadP);
    await expect(page.getByTestId("fechamento-nao-encontrado")).toHaveText("Não encontramos esse fechamento. Estes são os seus.", { timeout: 30_000 });
    await expect(page.getByTestId("fecho-linha")).toHaveCount(1);
    await expect(linha(page, ids.leadU)).toBeVisible();
    await expect(page.getByText(T.P)).toHaveCount(0);
    await expect(page.getByText(M1.nome)).toHaveCount(0);
    await page.context().close();
  });

  test("5. todas expiradas e sem contrato: o texto próprio, com o caminho para Interessados", async ({ browser }) => {
    const page = await noFechamento(browser, D4.email);
    await expect(page.getByTestId("estado-vazio").getByRole("heading", { name: "Nenhum fechamento por fazer agora" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Nenhuma candidatura aceita ainda")).toHaveCount(0);
    await expect(page.getByTestId("estado-vazio-acao").getByRole("link", { name: "Ver interessados" })).toHaveAttribute("href", "/dashboard/leads");
    await page.context().close();
  });
});
