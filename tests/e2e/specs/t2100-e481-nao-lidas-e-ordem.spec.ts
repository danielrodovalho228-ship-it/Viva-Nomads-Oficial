import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2100 — E481 (Pista 3; varredura "sem spec" das 142, lote D) @E481 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E481; unitário e481-nao-lidas.test.ts):
    - a lista de Mensagens vem na ordem da ATIVIDADE (a última mensagem), não na ordem da 1ª mensagem;
    - as não lidas aparecem em destaque com a contagem da conversa;
    - abrir a conversa zera a contagem dela na tela e no banco (lido_em).
  Só a 1280 px: no computador a conversa do topo abre sozinha e fica à vista, então ser marcada como lida é o esperado.
  No celular (390 px) a regra foi decidida pelo Gerente (DUET-0605, resposta B): carregar a lista NÃO marca leitura;
  abrir a conversa, sim. Essa parte é o t2101-e481-celular-lida-ao-abrir do Code 2 (#3918), já na main.
  Montagem: o dono tem dois anúncios. A conversa "antiga" começou primeiro (há 3 dias) e tem 2 não lidas, a última de
  há 2 dias. A "recente" começou depois (há 1 hora) com 1 não lida. Pela 1ª mensagem a antiga viria primeiro; pela
  atividade, a recente vem primeiro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2100.${sufixo}@lab.vivanomads.test`, nome: "Nadia Naolidas", role: "owner" as const };
const inqA = { email: `inqa.t2100.${sufixo}@lab.vivanomads.test`, nome: "Antonio Antigo", role: "tenant" as const };
const inqB = { email: `inqb.t2100.${sufixo}@lab.vivanomads.test`, nome: "Rita Recente", role: "tenant" as const };
const ids: Record<string, string> = {};
const conv: { antiga?: string; recente?: string } = {};
const ha = (ms: number) => new Date(Date.now() - ms).toISOString();
const HORA = 3_600_000;

async function naoLidasNoBanco(conversa: string): Promise<number> {
  const { count, error } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversa).eq("receiver_id", ids.dono).is("lido_em", null);
  if (error) throw error;
  return count ?? -1;
}

test.describe("T2100 — E481: Mensagens na ordem da atividade, não lidas com a contagem, abrir zera @E481", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    ids.imovelA = await criarImovelPronto(ids.dono, `Studio da conversa antiga ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Studio da conversa recente ${sufixo}`, { ativo: true });
    conv.antiga = conversationId(ids.inqA, ids.dono, ids.imovelA);
    conv.recente = conversationId(ids.inqB, ids.dono, ids.imovelB);
    const msg = (de: string, imovel: string, conversa: string, body: string, criada: string) => ({ conversation_id: conversa, sender_id: de, receiver_id: ids.dono, property_id: imovel, body, created_at: criada });
    const { error } = await adm()
      .from("messages")
      .insert([
        msg(ids.inqA, ids.imovelA, conv.antiga, "Oi, ainda está disponível?", ha(72 * HORA)),
        msg(ids.inqA, ids.imovelA, conv.antiga, "Consigo visitar no sábado?", ha(48 * HORA)),
        msg(ids.inqB, ids.imovelB, conv.recente, "Olá! Aceita pet pequeno?", ha(1 * HORA)),
      ]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().in("conversation_id", [conv.antiga ?? "", conv.recente ?? ""]);
    await apagarContas([ids.dono, ids.inqA, ids.inqB]);
  });

  test("1280 px — a recente primeiro, a antiga com 2 não lidas; abrir a antiga zera na tela e no banco", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });

    const lista = p.getByTestId("mensagens-conversa");
    const antiga = p.locator(`[data-testid="mensagens-conversa"][data-conversa="${conv.antiga}"]`);
    const recente = p.locator(`[data-testid="mensagens-conversa"][data-conversa="${conv.recente}"]`);
    await expect(antiga).toBeVisible({ timeout: 30_000 });
    await expect(recente).toBeVisible();

    // Ordem pela atividade: a conversa com a mensagem mais recente fica no topo.
    await expect.poll(() => lista.evaluateAll((bs) => bs.map((b) => b.getAttribute("data-conversa"))), { message: "ordem da lista (a recente primeiro)" }).toEqual([conv.recente, conv.antiga]);

    // A antiga (não aberta) mostra as 2 não lidas em destaque.
    await expect(antiga, "a antiga conta 2 não lidas").toHaveAttribute("data-nao-lidas", "2");
    await expect(antiga.getByTestId("mensagens-nao-lidas")).toHaveText("2");
    await expect(antiga.getByTestId("mensagens-nao-lidas")).toHaveAttribute("aria-label", "2 não lidas");
    expect(await naoLidasNoBanco(conv.antiga!), "no banco a antiga ainda tem 2 não lidas").toBe(2);

    // Abrir a antiga zera a contagem dela na tela e grava a leitura.
    await antiga.click();
    await expect(antiga, "abrir zera a contagem na lista").toHaveAttribute("data-nao-lidas", "0");
    await expect(antiga.getByTestId("mensagens-nao-lidas")).toHaveCount(0);
    await expect.poll(() => naoLidasNoBanco(conv.antiga!), { message: "abrir grava lido_em nas mensagens da antiga", timeout: 15_000 }).toBe(0);

    // Recarregada, a leitura continua e a ordem também (a atividade não muda por ler).
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(antiga).toBeVisible({ timeout: 30_000 });
    await expect(antiga).toHaveAttribute("data-nao-lidas", "0");
    await expect.poll(() => lista.evaluateAll((bs) => bs.map((b) => b.getAttribute("data-conversa")))).toEqual([conv.recente, conv.antiga]);
    await p.context().close();
  });
});
