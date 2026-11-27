import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T867 — E549 (chat principal, 04/11): em /dashboard/notificacoes os 7 interruptores de "Tipos de aviso" e "Canais"
  apareciam como ovais vazios (o trilho de carregamento) e não mostravam ligado/desligado. Agora a página lê as
  preferências no servidor: mesmo com as leituras do navegador sem resposta, os 7 chegam com o estado e nenhum trilho,
  no mesmo padrão do "Som de mensagem nova" (ligado = trilho verde). 390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `notif.t867.${sufixo}@lab.vivanomads.test`, nome: "Nara Notif", role: "tenant" as const };
const ids: Record<string, string> = {};
const SETE = ["notif-tipo-mensagens", "notif-tipo-lembretes", "notif-tipo-outros", "notif-tipo-sugestoes", "notif-canal-email", "notif-canal-push", "notif-canal-whatsapp"];

test.describe("T867 — interruptores das preferências com estado visível", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.pessoa]);
  });
  for (const w of [1280, 390] as const) {
    test(`a ${w} px: os 7 mostram o estado sem depender das leituras do navegador`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      // As leituras que a tela pedia do navegador (ações de servidor) ficam SEM RESPOSTA, como no relato: antes da
      // correção os 7 ficavam no trilho de carregamento; agora o estado vem da página e não depende delas.
      await p.route("**/dashboard/notificacoes", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? undefined : r.continue()));
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tela-notificacoes")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("notif-trilho-carregando")).toHaveCount(0);
      const corSom = await p.getByTestId("notif-som-mensagem").evaluate((e) => getComputedStyle(e).backgroundColor);
      for (const id of SETE) {
        const sw = p.getByTestId(id);
        await expect(sw, id).toHaveAttribute("aria-checked", "true");
        expect(await sw.evaluate((e) => getComputedStyle(e).backgroundColor), id).toBe(corSom);
      }
      await p.getByTestId("notif-canal-email").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t867-notificacoes-${w}.png` });
      await ctx.close();
    });
  }
});
