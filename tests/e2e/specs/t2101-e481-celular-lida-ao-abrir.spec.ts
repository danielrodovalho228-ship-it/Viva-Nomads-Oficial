import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2101 — E481 no celular @E481 (laboratório; decisão do Gerente, DUET-0605): a conversa só conta como lida quando a
  pessoa a abre e vê. A 390 px a lista de Mensagens não mostra conteúdo: carregar a lista NÃO marca a conversa do topo
  como lida (a mensagem continua sem lido_em e a contagem fica na lista); tocar na conversa, sim. A 1280 a vista
  dividida mostra a conversa aberta ao lado da lista: marcar ao carregar continua certo.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2101.${sufixo}@lab.vivanomads.test`, nome: "Dora Lidaaoabrir", role: "owner" as const };
const inq = { email: `inq.t2101.${sufixo}@lab.vivanomads.test`, nome: "Iara Lidaaoabrir", role: "tenant" as const };
const ids: Record<string, string> = {};

async function lidoEm(): Promise<string | null> {
  const { data } = await adm().from("messages").select("lido_em").eq("receiver_id", ids.inq).eq("property_id", ids.imovel).order("created_at").limit(1).maybeSingle();
  return (data?.lido_em as string | null) ?? null;
}

test.describe("T2101 — E481 no celular: a conversa só fica lida quando é aberta @E481", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio lida ao abrir ${sufixo}`, { ativo: true });
  });
  test.beforeEach(async () => {
    // Uma mensagem NÃO lida do dono para o inquilino, a cada caso.
    await adm().from("messages").delete().eq("property_id", ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! A visita pode ser amanhã?", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("390: carregar a lista não marca lida; abrir a conversa marca", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    const item = p.getByTestId("mensagens-conversa").first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    // Dá tempo de sobra para a marcação ao carregar (que era o defeito) chegar ao banco.
    await p.waitForTimeout(4_000);
    expect(await lidoEm(), "só a lista na tela: a mensagem continua não lida").toBeNull();
    await expect(item).toHaveAttribute("data-nao-lidas", "1");

    await item.click();
    await expect(p.getByTestId("mensagem-campo")).toBeVisible();
    await expect.poll(lidoEm, { timeout: 15_000, message: "aberta a conversa, a mensagem fica lida" }).not.toBeNull();
    await p.context().close();
  });

  test("1280: a vista dividida mostra a conversa aberta — marcar ao carregar continua", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await expect(p.getByTestId("mensagens-conversa").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(lidoEm, { timeout: 15_000, message: "conversa aberta ao lado da lista: lida" }).not.toBeNull();
    await p.context().close();
  });
});
