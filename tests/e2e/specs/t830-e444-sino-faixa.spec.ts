import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T830 — E444 itens 3 e 4 (Relay 57, Pista A; a base é da Pista B: tabela "avisos", 0286). Morador, 390 e 1280.
  3. Sino no topo: número de não lidas (até "9+") na cor da maior prioridade; o clique abre o painel com os últimos 8
     (crítico → urgente → mais recente) + "Ver todas" (/dashboard/notificacoes#avisos, que lista da tabela com filtro por
     prioridade). Clique no aviso: leva à tela do evento e marca como lido.
  4. Faixa no topo do painel para crítico não resolvido, com o botão da ação; resolvido, a faixa some.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t830.${sufixo}@lab.vivanomads.test`, nome: "Rita Sino", role: "tenant" as const };
const ids: Record<string, string> = {};

const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

async function semearAvisos() {
  await adm().from("avisos").delete().eq("usuario_id", ids.morador);
  const linhas = [
    // O crítico é o MAIS ANTIGO: mesmo assim abre o painel (crítico → urgente → mais recente).
    { evento: "contract_status", prioridade: "critico", titulo: "Seu contrato está pronto para assinar", url: "/dashboard/contratos", ref_id: `c-${sufixo}`, criado_em: horas(48) },
    { evento: "new_message", prioridade: "urgente", titulo: "Você recebeu uma mensagem", url: "/dashboard/mensagens", criado_em: horas(30) },
    ...Array.from({ length: 10 }, (_, i) => ({ evento: "dica", prioridade: "normal", titulo: `Novidade ${i + 1}`, url: "/dashboard", criado_em: horas(i + 1) })),
  ].map((l) => ({ usuario_id: ids.morador, ...l }));
  const { data, error } = await adm().from("avisos").insert(linhas).select("id, evento");
  if (error) throw error;
  for (const r of data as { id: string; evento: string }[]) ids[r.evento] = r.id;
}

const lidoEm = async (id: string) => ((await adm().from("avisos").select("lido_em").eq("id", id).single()).data as { lido_em: string | null }).lido_em;

// No celular o topo do app (AppHeader) também tem uma cópia escondida do sino: tudo pelo topo visível.
function topo(p: Page, largura: number) {
  return largura === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-morador");
}
function sino(p: Page, largura: number) {
  return topo(p, largura).getByTestId(largura === 390 ? "sino-morador-celular" : "sino-morador");
}

test.describe("T830 — E444: sino com prioridade e faixa de crítico", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().eq("usuario_id", ids.morador ?? "");
    await apagarContas([ids.morador]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px`, async ({ browser }) => {
      await semearAvisos();
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const px = largura === 390 ? "morador-celular" : "morador";
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });

      // 3a. Número "9+" na cor da maior prioridade (crítico).
      const contagem = topo(p, largura).getByTestId(`sino-${px}-contagem`);
      await expect(contagem).toHaveText("9+", { timeout: 30_000 });
      await expect(contagem).toHaveAttribute("data-prioridade", "critico");
      await expect(sino(p, largura)).toHaveAttribute("aria-label", "Notificações: 12 não lidas");

      // 4. Faixa do crítico, com o botão da ação.
      const faixa = p.getByTestId("faixa-critico");
      await expect(faixa).toContainText("Seu contrato está pronto para assinar");
      await expect(p.getByTestId("faixa-critico-acao")).toHaveText("Assinar o contrato");
      expect(await p.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t830-faixa-${largura}.png` });

      // 3b. Painel: os últimos 8, crítico primeiro, depois o urgente, depois os mais recentes; "Ver todas".
      await sino(p, largura).click();
      const painel = topo(p, largura).getByTestId(`sino-${px}-painel`);
      await expect(painel).toBeVisible();
      const itens = painel.getByTestId("sino-aviso");
      await expect(itens).toHaveCount(8);
      await expect(itens.nth(0)).toContainText("Seu contrato está pronto para assinar");
      await expect(itens.nth(1)).toContainText("Você recebeu uma mensagem");
      await expect(itens.nth(2)).toContainText("Novidade 1");
      await expect(painel.getByTestId(`sino-${px}-ver-todas`)).toHaveAttribute("href", "/dashboard/notificacoes#avisos");
      const caixa = await painel.boundingBox();
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(largura);
      await p.screenshot({ path: `${SAIDA}/t830-sino-${largura}.png` });

      // 3c. Clique no aviso: vai à tela do evento e marca como lido.
      await itens.nth(1).click();
      await expect(p).toHaveURL(/\/dashboard\/mensagens/, { timeout: 30_000 });
      await expect.poll(() => lidoEm(ids.new_message), { timeout: 15_000 }).not.toBeNull();

      // 3d. "Ver todas": a lista da tabela com filtro por prioridade.
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      const lista = p.getByTestId("avisos-caixa");
      await expect(lista.getByTestId("avisos-item")).toHaveCount(12, { timeout: 30_000 });
      await p.getByTestId("avisos-filtro-critico").click();
      await expect(lista.getByTestId("avisos-item")).toHaveCount(1);
      await expect(lista.getByTestId("avisos-item")).toHaveAttribute("data-prioridade", "critico");
      await p.getByTestId("avisos-filtro-urgente").click();
      await expect(lista.getByTestId("avisos-item")).toHaveAttribute("data-lido", "sim");
      // E502: o lido fica branco e sem ponto; o não lido (o crítico) tem fundo verde-claro e o ponto.
      const lidoItem = lista.getByTestId("avisos-item");
      await expect(lidoItem.getByTestId("aviso-ponto-nao-lido")).toHaveCount(0);
      expect(await lidoItem.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(255, 255, 255)");
      await p.getByTestId("avisos-filtro-critico").click();
      const naoLido = lista.getByTestId("avisos-item");
      await expect(naoLido).toHaveAttribute("data-lido", "nao");
      await expect(naoLido.getByTestId("aviso-ponto-nao-lido")).toHaveCount(1);
      expect(await naoLido.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(238, 246, 239)");
      expect(await p.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t830-lista-${largura}.png`, fullPage: true });

      // 4b. Botão da faixa: leva à ação e marca lido; a faixa só some quando o servidor resolve.
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await p.getByTestId("faixa-critico-acao").click();
      await expect(p).toHaveURL(/\/dashboard\/contratos/, { timeout: 30_000 });
      await expect.poll(() => lidoEm(ids.contract_status), { timeout: 15_000 }).not.toBeNull();
      await adm().from("avisos").update({ resolvido_em: new Date().toISOString() }).eq("id", ids.contract_status);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(contagem).toHaveText("9+", { timeout: 30_000 });
      await expect(p.getByTestId("faixa-critico")).toHaveCount(0);
      await expect(contagem).toHaveAttribute("data-prioridade", "normal");
      await p.context().close();
    });
  }
});
