import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2042 — Pista 3, lote 2, item F3 @E481 @E533 (sem @ao-vivo-seguro: precisa de login e do laboratório). Regra: marcar como lida zera a lista e o sino SEM
  RECARREGAR — "Marcar todas como lidas" tira a contagem do sino na hora e cada aviso do painel fica lido; marcar UM
  (clicar nele) tira um da contagem; e o banco confirma (depois de recarregar, continua zerado).
  Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t2042.${sufixo}@lab.vivanomads.test`, nome: "Lia Lida", role: "tenant" as const };
const ids: Record<string, string> = {};
const naoLidos = async () => ((await adm().from("avisos").select("id").eq("usuario_id", ids.morador).is("lido_em", null)).data ?? []).length;

async function semear(n: number) {
  await adm().from("avisos").delete().eq("usuario_id", ids.morador);
  const linhas = Array.from({ length: n }, (_, k) => ({ usuario_id: ids.morador, evento: "dica", prioridade: "normal", titulo: `Novidade ${k + 1} ${sufixo}`, url: "/dashboard", criado_em: new Date(Date.now() - (k + 1) * 60_000).toISOString() }));
  const { error } = await adm().from("avisos").insert(linhas);
  if (error) throw error;
}
function sino(p: Page, largura: number) {
  return largura === 390 ? p.getByTestId("topo-celular").getByTestId("sino-morador-celular") : p.getByTestId("topo-morador").getByTestId("sino-morador");
}

test.describe("T2042 — F3: marcar como lida zera o sino sem recarregar @E481", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().eq("usuario_id", ids.morador ?? "");
    await apagarContas([ids.morador]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — um, depois todos`, async ({ browser }) => {
      await semear(3);
      const px = largura === 390 ? "morador-celular" : "morador";
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(sino(p, largura)).toHaveAttribute("aria-label", "Notificações: 3 não lidas", { timeout: 30_000 });

      // Um: clicar no aviso tira um da contagem (o destino é a própria /dashboard, sem recarga de página).
      await sino(p, largura).click();
      await p.getByTestId(`sino-${px}-painel`).getByTestId("sino-aviso").filter({ hasText: `Novidade 1 ${sufixo}` }).click();
      await expect(sino(p, largura)).toHaveAttribute("aria-label", "Notificações: 2 não lidas", { timeout: 15_000 });
      await expect.poll(naoLidos, { timeout: 15_000 }).toBe(2);

      // Todos: "Marcar todas como lidas" zera na hora, no sino e no painel — sem nenhuma navegação de página.
      let navegacoes = 0;
      p.on("framenavigated", (f) => { if (f === p.mainFrame()) navegacoes++; });
      await sino(p, largura).click();
      const painel = (largura === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-morador")).getByTestId(`sino-${px}-painel`);
      await painel.getByTestId(`sino-${px}-marcar-todas`).click();
      await expect(sino(p, largura).getByTestId(`sino-${px}-contagem`)).toHaveCount(0, { timeout: 5_000 });
      await expect(sino(p, largura)).toHaveAttribute("aria-label", "Notificações");
      await expect(painel.getByTestId("sino-aviso").filter({ hasText: sufixo })).toHaveCount(3);
      for (const item of await painel.getByTestId("sino-aviso").filter({ hasText: sufixo }).all()) await expect(item).toHaveAttribute("data-lido", "sim");
      await expect(painel.getByTestId(`sino-${px}-marcar-todas`)).toHaveCount(0);
      expect(navegacoes, "nenhuma recarga de página para zerar").toBe(0);
      await expect.poll(naoLidos, { timeout: 15_000 }).toBe(0);

      // O banco confirma: recarregando, continua zerado.
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(sino(p, largura)).toHaveAttribute("aria-label", "Notificações", { timeout: 30_000 });
      await p.context().close();
    });
  }
});
