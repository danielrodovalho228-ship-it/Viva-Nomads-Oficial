import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2103 — E481 no celular (Pista 3; lote D) @E481 — sem @ao-vivo-seguro: precisa de sessão e do laboratório.
  Era trava vermelha até a correção do Code 2 (#3918, Família 6, Mensagens); com ela na main, entra no lote D (DUET-2420).
  Regra decidida pelo Gerente (DUET-0605, resposta B à dúvida do t2100): a conversa só conta como lida quando a pessoa a
  ABRE e vê. A 390 px a lista de Mensagens não mostra conteúdo nenhum de conversa — carregar a lista NÃO marca leitura;
  abrir a conversa, sim. (No computador a vista dividida mostra a conversa do topo aberta, e lá marcar é o certo: t2100.)
  O defeito na main de hoje: messages-client.tsx abre a 1ª conversa da lista como "ativa" também no celular e o efeito
  do E481 grava lido_em ao carregar — o "não lido" some sem a pessoa ter visto nada (é a unidade do E970).
  O que se confere, a 390 px:
    1. carregada a lista (e o servidor parado), a conversa do topo continua com 1 não lida na tela e no banco;
    2. tocar nela abre a conversa e aí, sim, a leitura é gravada.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2103.${sufixo}@lab.vivanomads.test`, nome: "Celina Celular", role: "owner" as const };
const inq = { email: `inq.t2103.${sufixo}@lab.vivanomads.test`, nome: "Rui Remetente", role: "tenant" as const };
const ids: Record<string, string> = {};
let conversa = "";

async function naoLidasNoBanco(): Promise<number> {
  const { count, error } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversa).eq("receiver_id", ids.dono).is("lido_em", null);
  if (error) throw error;
  return count ?? -1;
}

test.describe("T2103 — E481: no celular, carregar a lista não marca a conversa do topo como lida; abrir marca @E481", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do celular ${sufixo}`, { ativo: true });
    conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    const { error } = await adm().from("messages").insert({ conversation_id: conversa, sender_id: ids.inq, receiver_id: ids.dono, property_id: ids.imovel, body: "Olá! O studio ainda está livre?" });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("conversation_id", conversa);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("390 px — a lista carregada não grava leitura; abrir a conversa grava", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });

    const item = p.locator(`[data-testid="mensagens-conversa"][data-conversa="${conversa}"]`);
    await expect(item, "a conversa na lista").toBeVisible({ timeout: 30_000 });
    // A lista é o que se vê no celular: nenhuma conversa aberta ao lado.
    await expect(p.getByPlaceholder("Escreva uma mensagem...")).toBeHidden();
    // Espera o servidor parar (a marcação, se houver, é uma chamada logo ao montar a lista).
    await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(item, "carregar a lista não zera a contagem na tela").toHaveAttribute("data-nao-lidas", "1");
    await expect(item.getByTestId("mensagens-nao-lidas")).toHaveText("1");
    expect(await naoLidasNoBanco(), "carregar a lista não grava lido_em").toBe(1);

    // Abrir a conversa é que conta como ler.
    await item.click();
    await expect(p.getByText("Olá! O studio ainda está livre?").last()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => naoLidasNoBanco(), { message: "abrir a conversa grava lido_em", timeout: 15_000 }).toBe(0);
    await p.context().close();
  });
});
