import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";

/*
  T602 — E181 (família inteira, fila da vigia 29/10): TODOS os contadores da home do morador = o número de itens da
  lista de destino. Um fato, uma fonte (família E16/E113). Morador com 2 favoritos, 1 busca salva com alerta ligado,
  1 candidatura e 1 conversa: cada cartão da home mostra o número e a tela do cartão lista exatamente esses itens.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t602.${sufixo}@lab.vivanomads.test`, nome: "Dora Contagem", role: "owner" as const };
const morador = { email: `mor.t602.${sufixo}@lab.vivanomads.test`, nome: "Mel Contagem", role: "tenant" as const };
const ids: Record<string, string> = {};

/** Valor do cartão da home que leva a `href`. */
async function contador(p: Page, href: string): Promise<number> {
  const valor = p.locator(`main a[href="${href}"]`).getByTestId("stat-valor").first();
  await expect(valor).toBeVisible({ timeout: 30_000 });
  return Number((await valor.innerText()).trim());
}

const LISTAS: { href: string; rotulo: string; item: string; esperado: number }[] = [
  { href: "/dashboard/candidaturas", rotulo: "Candidaturas", item: '[data-testid="candidatura-item"]', esperado: 1 },
  { href: "/dashboard/favoritos", rotulo: "Favoritos", item: '[data-testid="cartao-imovel"]', esperado: 2 },
  { href: "/dashboard/buscas", rotulo: "Buscas salvas", item: '[data-testid="busca-salva-item"]', esperado: 1 },
  { href: "/dashboard/mensagens", rotulo: "Mensagens", item: '[data-testid="mensagens-conversa"]', esperado: 1 },
];

test.describe("T602 — E181: cada contador da home do morador = os itens da sua lista", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.a = await criarImovelPronto(ids.dono, `Studio A contagem t602 ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, `Studio B contagem t602 ${sufixo}`, { ativo: true });
    const f = await adm().from("favorites").insert([{ tenant_id: ids.morador, property_id: ids.a }, { tenant_id: ids.morador, property_id: ids.b }]);
    if (f.error) throw f.error;
    const b = await adm().from("buscas_salvas").insert({ usuario_id: ids.morador, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia", alerta_ativo: true });
    if (b.error) throw b.error;
    await criarLead(ids.dono, ids.morador, ids.a);
    await gravarMensagem(ids.morador, ids.dono, ids.a, "Olá! Tenho interesse no studio.", conversationId(ids.morador, ids.dono, ids.a));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("sender_id", ids.morador ?? "");
    await adm().from("leads").delete().eq("tenant_id", ids.morador ?? "");
    await adm().from("buscas_salvas").delete().eq("usuario_id", ids.morador ?? "");
    await adm().from("favorites").delete().eq("tenant_id", ids.morador ?? "");
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Candidaturas, Favoritos, Buscas salvas e Mensagens: contador = itens da lista`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      // Favoritos chega pelo aparelho (useFavoritos): espera o número parar no valor da conta.
      await expect.poll(() => contador(p, "/dashboard/favoritos"), { timeout: 30_000 }).toBe(2);
      const naHome: Record<string, number> = {};
      for (const l of LISTAS) naHome[l.href] = await contador(p, l.href);
      await p.screenshot({ path: `${SAIDA}/t602-home-contadores-${largura}.png` });

      for (const l of LISTAS) {
        await p.goto(l.href, { waitUntil: "domcontentloaded" });
        const itens = p.locator(`main ${l.item}`);
        await expect(itens.first()).toBeVisible({ timeout: 30_000 });
        await expect(itens, `${l.rotulo}: itens da lista`).toHaveCount(l.esperado);
        expect(naHome[l.href], `${l.rotulo}: contador da home × itens da lista`).toBe(await itens.count());
      }
      await p.context().close();
    });
  }
});
