import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T587 — E200 (#1431), guarda permanente da Pista C: o #1431 trouxe só testes de regra. Na tela, com o link
  /dashboard/mensagens?conversa=<id> do contrato da Ana (sem nenhuma mensagem entre ela e o dono):
   1. o dono — que tem OUTRA conversa, com mensagens, com o Beto — abre a conversa da Ana VAZIA ("Nenhuma mensagem
      ainda. Escreva a primeira.") e nunca a do Beto;
   2. a Ana abre a mesma conversa vazia;
   3. a Clara, que não é parte do contrato (e tem uma conversa sua, sobre outro imóvel), vê "Esta conversa não está na
      sua lista…" e nenhuma conversa abre sozinha — nem a da Ana, nem a dela.
  A 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t587.${sufixo}@lab.vivanomads.test`, nome: "Dario Conversa", role: "owner" as const };
const ana = { email: `ana.t587.${sufixo}@lab.vivanomads.test`, nome: "Ana Contrato", role: "tenant" as const };
const beto = { email: `beto.t587.${sufixo}@lab.vivanomads.test`, nome: "Beto Conversa", role: "tenant" as const };
const clara = { email: `clara.t587.${sufixo}@lab.vivanomads.test`, nome: "Clara Fora", role: "tenant" as const };
const ids: Record<string, string> = {};
const MSG_BETO = `Olá, tenho interesse — mensagem do Beto t587 ${sufixo}`;
const MSG_CLARA = `Oi, é a Clara — t587 ${sufixo}`;
const VAZIA = "Nenhuma mensagem ainda. Escreva a primeira.";
const NAO_ENCONTRADA = "Esta conversa não está na sua lista. Escolha uma conversa abaixo.";
let link = "";

test.describe("T587 — E200: a conversa do contrato sem mensagem abre vazia, nunca a de outra pessoa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ana = await criarConta(ana, senha);
    ids.beto = await criarConta(beto, senha);
    ids.clara = await criarConta(clara, senha);
    ids.imovelAna = await criarImovelPronto(ids.dono, `Contrato da Ana t587 ${sufixo}`, { ativo: true });
    ids.imovelBeto = await criarImovelPronto(ids.dono, `Conversa do Beto t587 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.ana, ids.imovelAna, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovelAna, tenant_id: ids.ana, lead_id: ids.lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    // A outra conversa do dono, a primeira da lista dele.
    await gravarMensagem(ids.beto, ids.dono, ids.imovelBeto, MSG_BETO, conversationId(ids.beto, ids.dono, ids.imovelBeto));
    // A Clara tem uma conversa SUA (sobre outro imóvel): a lista dela não está vazia e nenhuma conversa pode abrir sozinha.
    await gravarMensagem(ids.clara, ids.dono, ids.imovelBeto, MSG_CLARA, conversationId(ids.clara, ids.dono, ids.imovelBeto));
    link = `/dashboard/mensagens?conversa=${conversationId(ids.ana, ids.dono, ids.imovelAna)}`;
    const { count } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("property_id", ids.imovelAna);
    if (count) throw new Error("o cenário é SEM mensagem no contrato da Ana");
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().in("property_id", [ids.imovelAna, ids.imovelBeto].filter(Boolean));
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.ana, ids.beto, ids.clara]);
  });

  for (const w of [1280, 390] as const) {
    for (const [quem, conta] of [["dono", dono], ["Ana", ana]] as const) {
      test(`a ${w} px — ${quem}: o link do contrato abre a conversa vazia, sem a mensagem do Beto`, async ({ browser }) => {
        const p = await entrar(browser, conta.email, senha);
        await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await p.goto(link, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("conversa-nova-vazia")).toHaveText(VAZIA, { timeout: 30_000 });
        await expect(p.getByTestId("mensagens-conversa-nao-encontrada")).toHaveCount(0);
        // A conversa aberta é a do contrato da Ana — nunca a do Beto. A mensagem do Beto pode aparecer só como prévia na
        // lista de conversas do dono (no máximo uma vez), nunca dentro da conversa aberta.
        await expect(p.getByTestId("conversa-contexto")).toContainText(`Contrato da Ana t587 ${sufixo}`);
        await expect(p.getByTestId("conversa-contexto")).not.toContainText(`Conversa do Beto t587 ${sufixo}`);
        expect(await p.locator("main").getByText(MSG_BETO).count(), "a mensagem do Beto dentro da conversa aberta").toBeLessThanOrEqual(1);
        await p.screenshot({ path: `tests/laboratorio/saida/t587-${quem.toLowerCase()}-${w}.png` });
        await p.context().close();
      });
    }

    test(`a ${w} px — Clara (fora do contrato): 'não está na sua lista' e nenhuma conversa abre`, async ({ browser }) => {
      const p = await entrar(browser, clara.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(link, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("mensagens-conversa-nao-encontrada")).toHaveText(NAO_ENCONTRADA, { timeout: 30_000 });
      await expect(p.getByTestId("conversa-nova-vazia")).toHaveCount(0);
      // Nenhuma conversa abre sozinha — nem a da Ana, nem a da própria Clara (a 1ª da lista dela).
      await expect(p.getByTestId("conversa-contexto")).toHaveCount(0);
      await expect(p.locator("main")).not.toContainText(MSG_BETO);
      await expect(p.locator("main")).not.toContainText(`Contrato da Ana t587 ${sufixo}`);
      await p.screenshot({ path: `tests/laboratorio/saida/t587-fora-${w}.png` });
      await p.context().close();
    });
  }
});
