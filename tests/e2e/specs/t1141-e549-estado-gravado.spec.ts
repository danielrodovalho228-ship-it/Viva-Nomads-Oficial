import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1141 — E549 (#2572, 05/11): os interruptores de /dashboard/notificacoes nascem com o estado GRAVADO, lido pela página
 * no servidor. A t867 (da Pista A) cobre a conta nova, tudo ligado; aqui a conta tem preferências desligadas gravadas
 * (Mensagens e Sugestões fora, E-mail e WhatsApp desligados), e as leituras do navegador ficam sem resposta, para provar
 * que o estado vem do servidor e não é o padrão "tudo ligado". 390 e 1280:
 *   1. os 4 desligados chegam com aria-checked="false" e os 3 restantes com "true", sem nenhum trilho de carregamento;
 *   2. ligado e desligado têm cores diferentes (o ligado é o verde do "Som de mensagem nova");
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `notif.t1141.${sufixo}@lab.vivanomads.test`, nome: "Nilo Notif", role: "tenant" as const };
const ids: Record<string, string> = {};
const DESLIGADOS = ["notif-tipo-mensagens", "notif-tipo-sugestoes", "notif-canal-email", "notif-canal-whatsapp"];
const LIGADOS = ["notif-tipo-lembretes", "notif-tipo-outros", "notif-canal-push"];

test.describe("T1141 — E549: os interruptores chegam com as preferências gravadas, não com o padrão", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { error } = await adm()
      .from("profiles")
      .update({ notif_categorias_desligadas: ["mensagens", "sugestoes"], notif_email: false, notif_whatsapp: false })
      .eq("id", ids.pessoa);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.pessoa]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: desligados chegam desligados, sem as leituras do navegador`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
        // As ações de servidor que a tela chamaria do navegador ficam sem resposta: só o estado vindo da página vale.
        await p.route("**/dashboard/notificacoes", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? undefined : r.continue()));
        await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("tela-notificacoes")).toBeVisible({ timeout: 20_000 });
        await expect(p.getByTestId("notif-trilho-carregando")).toHaveCount(0);

        const corLigado = await p.getByTestId("notif-som-mensagem").evaluate((e) => getComputedStyle(e).backgroundColor);
        for (const id of DESLIGADOS) {
          const sw = p.getByTestId(id);
          await expect(sw, id).toHaveAttribute("aria-checked", "false");
          expect(await sw.evaluate((e) => getComputedStyle(e).backgroundColor), id).not.toBe(corLigado);
        }
        for (const id of LIGADOS) await expect(p.getByTestId(id), id).toHaveAttribute("aria-checked", "true");

        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
