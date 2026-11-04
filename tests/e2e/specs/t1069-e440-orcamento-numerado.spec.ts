import { test, expect, type Browser } from "@playwright/test";
import { adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, NO_LABORATORIO, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1069 — E440 (#2383, orçamento numerado, 04/11): o pedido do morador ganha número público (VN-PD-…), o morador pede o
 * orçamento pelo chat e a tela do contrato mostra o pedido e o orçamento que viraram contrato. Pela tela real, 390 e 1280:
 *   1. Minhas candidaturas, pedido ACEITO sem contrato: "Pedido nº VN-PD-XXXXXXXX" e "Pedir orçamento"; clicar manda ao
 *      dono, no chat, "…orçamento pela plataforma para o pedido VN-PD-…" (gravado em messages) e o botão trava;
 *   2. pedido aceito com orçamento ainda em aberto: o botão aparece, mas o servidor recusa ("Este pedido não pode pedir
 *      orçamento agora.") e nada vai ao chat;
 *   3. contrato nascido do pedido, com o orçamento aceito: /dashboard/contratos/<id> mostra "Pedido do morador: VN-PD-… ·
 *      Orçamento: ORC-…" para o morador e para o dono; o pedido com contrato não mostra mais "Pedir orçamento".
 * As regras puras (numeroPublicoPedido, podePedirOrcamento, a leitura que falha) ficam com o e440-orcamento-numerado.test.ts.
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const dono = { email: `dono.t1069.${sufixo}@lab.vivanomads.test`, nome: "Otávio Orçamento Lima", role: "owner" as const };
const inq = { email: `inq.t1069.${sufixo}@lab.vivanomads.test`, nome: "Nara Numerada Reis", role: "tenant" as const };
const ids: Record<string, string> = {};
const T_PEDE = `Studio do pedido t1069 ${sufixo}`;
const T_ABERTO = `Studio do orçamento aberto t1069 ${sufixo}`;
const T_CONTRATO = `Studio do contrato t1069 ${sufixo}`;
const numeroPedido = (lead: string) => `VN-PD-${lead.slice(0, 8).toUpperCase()}`;
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
let orcamentoContrato = "";

async function proposta(lead: string, imovel: string, status: string): Promise<string> {
  const { data: numero, error: e0 } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  if (e0) throw e0;
  const { error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: lead, property_id: imovel, owner_id: ids.dono, tenant_id: ids.inq, status, versao_atual: 1, validade_dias: 7, valida_ate: emDias(7) + "T23:00:00Z" });
  if (error) throw error;
  return numero as string;
}

async function abrir(browser: Browser, email: string, w: number) {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  return p;
}
const sobra = (p: import("@playwright/test").Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1069 — E440: pedido numerado, Pedir orçamento e os números na tela do contrato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imPede = await criarImovelPronto(ids.dono, T_PEDE, { ativo: true, preco: 3200 });
    ids.imAberto = await criarImovelPronto(ids.dono, T_ABERTO, { ativo: true, preco: 3300 });
    ids.imContrato = await criarImovelPronto(ids.dono, T_CONTRATO, { ativo: true, preco: 3400 });
    ids.leadPede = await criarLead(ids.dono, ids.inq, ids.imPede, true);
    ids.leadAberto = await criarLead(ids.dono, ids.inq, ids.imAberto, true);
    ids.leadContrato = await criarLead(ids.dono, ids.inq, ids.imContrato, true);
    await proposta(ids.leadAberto, ids.imAberto, "enviada");
    orcamentoContrato = await proposta(ids.leadContrato, ids.imContrato, "aceita");
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.leadContrato, property_id: ids.imContrato, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3400, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 816, qtd_ocupantes: 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("messages").delete().eq("sender_id", ids.inq);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await adm().from("propostas").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`candidaturas: o número do pedido, Pedir orçamento vai ao chat; orçamento aberto é recusado (${w})`, async ({ browser }) => {
      await adm().from("messages").delete().eq("sender_id", ids.inq);
      const p = await abrir(browser, inq.email, w);
      await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      const item = (t: string) => p.getByTestId("candidatura-item").filter({ hasText: t });

      const pede = item(T_PEDE);
      await expect(pede.getByTestId("candidatura-numero-pedido")).toHaveText(numeroPedido(ids.leadPede), { timeout: 30_000 });
      const botao = pede.getByTestId("candidatura-pedir-orcamento-botao");
      await expect(botao).toBeEnabled();
      expect(await sobra(p)).toBeLessThanOrEqual(1);
      await botao.click();
      await expect(pede.getByTestId("candidatura-pedir-orcamento-msg")).toHaveText("Pedido de orçamento enviado ao proprietário no chat.", { timeout: 30_000 });
      await expect(botao).toBeDisabled();
      const { data: msgs } = await adm().from("messages").select("body, receiver_id, property_id").eq("sender_id", ids.inq);
      expect(msgs ?? []).toHaveLength(1);
      expect(msgs![0].receiver_id).toBe(ids.dono);
      expect(msgs![0].property_id).toBe(ids.imPede);
      expect(msgs![0].body).toContain(`orçamento pela plataforma para o pedido ${numeroPedido(ids.leadPede)}`);

      // Orçamento ainda em aberto: o botão aparece (a tela não sabe), o servidor recusa e nada vai ao chat.
      const aberto = item(T_ABERTO);
      await expect(aberto.getByTestId("candidatura-numero-pedido")).toHaveText(numeroPedido(ids.leadAberto));
      await aberto.getByTestId("candidatura-pedir-orcamento-botao").click();
      await expect(aberto.getByTestId("candidatura-pedir-orcamento-msg")).toHaveText("Este pedido não pode pedir orçamento agora.", { timeout: 30_000 });
      const { count } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("sender_id", ids.inq);
      expect(count, "a recusa não manda mensagem").toBe(1);

      // Com contrato, o pedido não pede mais orçamento.
      await expect(item(T_CONTRATO)).toBeVisible();
      await expect(item(T_CONTRATO).getByTestId("candidatura-pedir-orcamento")).toHaveCount(0);
      await p.context().close();
    });

    for (const quem of ["morador", "dono"] as const) {
      test(`contrato: "Pedido do morador: VN-PD-… · Orçamento: ORC-…" para o ${quem} (${w})`, async ({ browser }) => {
        const p = await abrir(browser, quem === "morador" ? inq.email : dono.email, w);
        await p.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
        const linha = p.getByTestId("contrato-numeros");
        await expect(linha).toHaveText(`Pedido do morador: ${numeroPedido(ids.leadContrato)} · Orçamento: ${orcamentoContrato}`, { timeout: 30_000 });
        await expect(p.getByTestId("contrato-numeros-falhou")).toHaveCount(0);
        expect(await sobra(p)).toBeLessThanOrEqual(1);
        await p.context().close();
      });
    }
  }
});
