import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T956 — #2072 (varredura de erros, rodada 6, achados 52/53): em Conta › Notificações, a leitura das preferências que
 * falhava abria a tela com tudo LIGADO (categorias "[]", canais e-mail/push/WhatsApp ligados) — e "Salvar" religava o
 * que a pessoa tinha desligado, inclusive "Sugestões e novidades". Agora a tela não abre com valores padrão: mostra o
 * aviso com "Tentar de novo". Pela tela real (/dashboard/notificacoes), 390 e 1280, com "Sugestões e novidades"
 * desligada no banco:
 *   1. as ações do servidor da tela falham (resposta 500 — o mesmo efeito do "throw" novo): "Não foi possível carregar
 *      suas preferências de aviso agora. Nada foi alterado." com "Tentar de novo"; nenhum interruptor, nenhum "Salvar";
 *      o banco segue com "sugestoes" desligada;
 *   2. "Tentar de novo" com o servidor de volta: os interruptores aparecem com o que está gravado — "Sugestões e
 *      novidades" desligada, as outras ligadas.
 * A falha do banco em si fica com o teste de unidade do #2072 (achado52-54-preferencias.test.ts).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `pref.t956.${sufixo}@lab.vivanomads.test`, nome: "Paula Preferências", role: "tenant" as const };
const ids: { conta?: string } = {};
const ROTA = "**/dashboard/notificacoes**";

async function servidorFalha(page: Page, liga: boolean) {
  if (!liga) return page.unroute(ROTA);
  await page.route(ROTA, (r) =>
    r.request().method() === "POST" && r.request().headers()["next-action"] ? r.fulfill({ status: 500, body: "falha simulada (t956)" }) : r.continue(),
  );
}
async function desligadas(): Promise<string[]> {
  const { data } = await adm().from("profiles").select("notif_categorias_desligadas").eq("id", ids.conta!).single();
  return ((data as { notif_categorias_desligadas?: string[] } | null)?.notif_categorias_desligadas ?? []).slice().sort();
}

test.describe("T956 — #2072 achados 52/53: preferências de aviso não abrem com valores padrão na falha", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm().from("profiles").update({ notif_categorias_desligadas: ["sugestoes"] }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  test("falha → aviso sem interruptores; 'Tentar de novo' → o que está gravado (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await servidorFalha(page, true);
      await page.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      const falha = page.getByTestId("tela-notificacoes-falha");
      await expect(falha).toBeVisible({ timeout: 30_000 });
      await expect(falha).toContainText("Não foi possível carregar suas preferências de aviso agora. Nada foi alterado.");
      await expect(falha).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("tela-notificacoes")).toHaveCount(0);
      await expect(page.getByTestId("notif-salvar")).toHaveCount(0);
      await expect(page.getByTestId("notif-tipo-sugestoes")).toHaveCount(0);
      expect(await desligadas(), "nada regravado").toEqual(["sugestoes"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await servidorFalha(page, false);
      await page.getByTestId("tela-notificacoes-tentar").click();
      await expect(page.getByTestId("tela-notificacoes")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("notif-tipo-sugestoes")).toHaveAttribute("aria-checked", "false");
      for (const c of ["mensagens", "lembretes", "outros"]) await expect(page.getByTestId(`notif-tipo-${c}`)).toHaveAttribute("aria-checked", "true");
      await expect(page.getByTestId("notif-salvar")).toBeVisible();
      expect(await desligadas()).toEqual(["sugestoes"]);
    }
    await page.context().close();
  });
});
