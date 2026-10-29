import { test, expect, type Browser, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T600 — E200 (QA do Muse, 28/10, VN-CT-D5D50247): a conversa da estadia está na lista de Mensagens desde a criação do
  contrato, mesmo sem nenhuma mensagem, com o nome do outro lado (morador para o dono; dono para o morador) na lista e
  no cabeçalho. O botão "Mensagem" da estadia abre essa mesma conversa, e os contadores não mudam com o ?conversa=.
  Antes: sem o parâmetro a conversa não existia ("Todas 1 / Como proprietário 1" aqui); com ele era injetada só na tela,
  com "Morador" no lugar do nome.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t600.${sufixo}@lab.vivanomads.test`, nome: "Dalva Conversa", role: "owner" as const };
const ana = { email: `ana.t600.${sufixo}@lab.vivanomads.test`, nome: "Ana Isabela", role: "tenant" as const };
const lucas = { email: `lucas.t600.${sufixo}@lab.vivanomads.test`, nome: "Lucas Contato", role: "tenant" as const };
const ids: Record<string, string> = {};
const tituloEstadia = `Premium estadia t600 ${sufixo}`;
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}
const contagem = (p: Page, filtro: string) => p.getByTestId(`mensagens-filtro-${filtro}`).locator("span");
const conversaDaEstadia = (p: Page) => p.locator(`[data-testid="mensagens-conversa"][data-conversa="${ids.conversa}"]`);

test.describe("T600 — E200: a conversa da estadia aparece na lista desde a criação, com o nome do outro lado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ana = await criarConta(ana, senha);
    ids.lucas = await criarConta(lucas, senha);
    // Conversa normal (com mensagem) com outro morador, noutro imóvel do mesmo dono.
    ids.outroImovel = await criarImovelPronto(ids.dono, `Studio contato t600 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.lucas, ids.outroImovel);
    await gravarMensagem(ids.lucas, ids.dono, ids.outroImovel, "Olá! O studio está livre?", conversationId(ids.lucas, ids.dono, ids.outroImovel));
    // Contrato recém-criado com a Ana, sem NENHUMA mensagem entre os dois (como o VN-CT-D5D50247).
    ids.imovel = await criarImovelPronto(ids.dono, tituloEstadia, { ativo: true, preco: 3200 });
    const lead = await criarLead(ids.dono, ids.ana, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.ana, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(69), meses: 2, valor: 6400, caucao: 3200, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (eb) throw eb;
    ids.conversa = conversationId(ids.ana, ids.dono, ids.imovel);
    const { count } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", ids.conversa);
    expect(count).toBe(0);
  });

  test.afterAll(async () => {
    await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato ?? "00000000-0000-0000-0000-000000000000");
    await adm().from("contratos").delete().eq("id", ids.contrato ?? "00000000-0000-0000-0000-000000000000");
    await adm().from("messages").delete().in("property_id", [ids.imovel, ids.outroImovel].filter(Boolean));
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.ana, ids.lucas, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — dono: a conversa da estadia está na lista sem o ?conversa=, com o nome da moradora`, async ({ browser }) => {
      const p = await abrir(browser, dono.email, largura);
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      const item = conversaDaEstadia(p);
      await expect(item).toBeVisible({ timeout: 25_000 });
      await expect(item).toContainText("Ana I.");
      await expect(item).toContainText(tituloEstadia);
      await expect(item).not.toContainText("Morador");
      await expect(contagem(p, "todas")).toHaveText("2");
      await expect(contagem(p, "proprietario")).toHaveText("2");
      await item.click();
      await expect(p.getByTestId("conversa-nome")).toHaveText("Ana I.");
      await expect(p.getByTestId("conversa-nova-vazia")).toBeVisible();
      await expect(p.getByTestId("conversa-abrir-estadia")).toHaveAttribute("href", `/dashboard/estadia/${ids.contrato}`);
      await p.screenshot({ path: `${SAIDA}/t600-dono-lista-${largura}.png` });
      await p.context().close();
    });
  }

  test("1280 px — dono: o botão Mensagem da estadia abre a mesma conversa, e os contadores não mudam", async ({ browser }) => {
    const p = await abrir(browser, dono.email, 1280);
    await p.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const botao = p.getByTestId("estadia-acao-mensagem");
    await expect(botao).toHaveAttribute("href", `/dashboard/mensagens?conversa=${ids.conversa}`, { timeout: 25_000 });
    await botao.click();
    await p.waitForURL(`**/dashboard/mensagens?conversa=${ids.conversa}`);
    await expect(p.getByTestId("conversa-nome")).toHaveText("Ana I.", { timeout: 25_000 });
    await expect(p.getByTestId("conversa-nova-vazia")).toBeVisible();
    await expect(p.getByTestId("mensagens-conversa-nao-encontrada")).toHaveCount(0);
    await expect(contagem(p, "todas")).toHaveText("2");
    await expect(contagem(p, "proprietario")).toHaveText("2");
    await expect(p.getByTestId("mensagens-conversa")).toHaveCount(2);
    await p.screenshot({ path: `${SAIDA}/t600-dono-pela-estadia-1280.png` });
    await p.context().close();
  });

  test("390 px — moradora: a conversa da estadia está na lista com o nome do dono", async ({ browser }) => {
    const p = await abrir(browser, ana.email, 390);
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    const item = conversaDaEstadia(p);
    await expect(item).toBeVisible({ timeout: 25_000 });
    await expect(item).toContainText("Dalva C.");
    await expect(contagem(p, "inquilino")).toHaveText("1");
    await item.click();
    await expect(p.getByTestId("conversa-nome")).toHaveText("Dalva C.");
    await expect(p.getByTestId("conversa-nova-vazia")).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t600-moradora-lista-390.png` });
    await p.context().close();
  });

  test("a primeira mensagem vai para a mesma conversa (sem duplicar na lista)", async ({ browser }) => {
    await gravarMensagem(ids.dono, ids.ana, ids.imovel, "Bem-vinda! Qualquer dúvida, me chame aqui.", ids.conversa);
    const p = await abrir(browser, dono.email, 1280);
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await expect(conversaDaEstadia(p)).toHaveCount(1, { timeout: 25_000 });
    await expect(conversaDaEstadia(p)).toContainText("Bem-vinda!");
    await expect(contagem(p, "todas")).toHaveText("2");
    await p.context().close();
  });
});
