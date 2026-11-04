import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1077 — E489 (#2405, 04/11): "Ver todas" do sino leva à LISTA de avisos, não às preferências. No computador quem rola
 * é o <main> do painel e a âncora sozinha deixava a pessoa nas preferências (no topo de /dashboard/notificacoes). Pela
 * tela real, morador com 12 avisos, 390 e 1280:
 *   1. controle: /dashboard/notificacoes sem âncora abre no topo (preferências) e o foco NÃO vai para "Avisos recentes";
 *   2. com a página já aberta, sino → "Ver todas" (só no celular: no computador as telas da Conta não têm o sino no
 *      topo, desenho do E185): a URL ganha #avisos e "Avisos recentes" fica na vista (o foco neste caminho é o L-91);
 *   3. vindo de outra tela (/dashboard), sino → "Ver todas": chega já na lista, com o título na vista e com foco.
 * A regra pura (deveIrParaAvisos) fica com o e489-ver-todas.test.ts; o sino e a faixa de crítico, com a t830.
 *
 * L-91 (defeito de produto, achado nesta spec, 04/11; no celular, o único tamanho com o sino nas telas da Conta): com
 * /dashboard/notificacoes JÁ ABERTA, "Ver todas" leva a lista
 * à vista (o Next rola pela âncora), mas o foco NÃO vai para "Avisos recentes". O Link para a mesma página com #avisos
 * navega por history.pushState, que não dispara "hashchange" — e é esse evento que o IrParaAvisos escuta (o comentário
 * dele promete o caso). Fica no teste 2b, test.fail ligado ao L-91: quando o foco chegar, ele vira e acusa.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t1077.${sufixo}@lab.vivanomads.test`, nome: "Vera Vertodas Lima", role: "tenant" as const };
const ids: Record<string, string> = {};
const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

// No celular o topo do app também tem uma cópia escondida do sino: tudo pelo topo visível (como a t830).
const topo = (p: Page, w: number) => (w === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-morador"));
const px = (w: number) => (w === 390 ? "morador-celular" : "morador");
const focoNoTitulo = (p: Page) => p.evaluate(() => document.activeElement?.id === "h-avisos");

async function verTodasPeloSino(p: Page, w: number) {
  await topo(p, w).getByTestId(`sino-${px(w)}`).click();
  const painel = topo(p, w).getByTestId(`sino-${px(w)}-painel`);
  await expect(painel).toBeVisible({ timeout: 20_000 });
  await painel.getByTestId(`sino-${px(w)}-ver-todas`).click();
}

test.describe("T1077 — E489: 'Ver todas' do sino leva à lista de avisos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    const linhas = Array.from({ length: 12 }, (_, i) => ({
      usuario_id: ids.morador, evento: "dica", prioridade: "normal", titulo: `Aviso t1077 número ${i + 1}`, url: "/dashboard", criado_em: horas(i + 1),
    }));
    const { error } = await adm().from("avisos").insert(linhas);
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("avisos").delete().eq("usuario_id", ids.morador ?? "");
    await apagarContas([ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle sem âncora; Ver todas com a página aberta (lista na vista); Ver todas vindo do painel (vista e foco) (${w})`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const titulo = p.locator("#h-avisos");

      // 1. Controle: sem âncora, a página abre no topo e o foco não vai para a lista.
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      await expect(titulo).toHaveText("Avisos recentes", { timeout: 30_000 });
      await p.waitForTimeout(500);
      expect(await focoNoTitulo(p), "sem #avisos o foco fica onde estava").toBe(false);
      const longe = !(await titulo.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight));
      test.info().annotations.push({ type: "controle", description: `@${w}: "Avisos recentes" ${longe ? "abaixo da dobra" : "já na vista"} sem a âncora` });

      // 2. Com a página já aberta: sino → Ver todas. Só no celular: no computador, nas telas da Conta o topo não repete o
      //    sino (E185 — o menu lateral já tem "Notificações"), então o caminho não existe ali.
      if (w === 1280) {
        await expect(topo(p, w).getByTestId(`sino-${px(w)}`), "E185: sem sino no topo das telas da Conta").toHaveCount(0);
      } else {
        await verTodasPeloSino(p, w);
        await expect(p).toHaveURL(/\/dashboard\/notificacoes#avisos$/);
        await expect(titulo).toBeInViewport({ timeout: 15_000 });
        await expect(p.locator("#avisos")).toContainText("Aviso t1077 número 1");
        // O foco neste caminho é o L-91 (teste 2b abaixo).
      }

      // 3. Vindo de outra tela: chega já na lista.
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(topo(p, w).getByTestId(`sino-${px(w)}`)).toBeVisible({ timeout: 30_000 });
      await verTodasPeloSino(p, w);
      await expect(p).toHaveURL(/\/dashboard\/notificacoes#avisos$/, { timeout: 30_000 });
      await expect(titulo).toBeInViewport({ timeout: 15_000 });
      await expect.poll(() => focoNoTitulo(p), { timeout: 10_000 }).toBe(true);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.context().close();
    });

    test(`2b. L-91: com a página aberta, Ver todas também leva o FOCO a "Avisos recentes" (${w})`, async ({ browser }) => {
      test.skip(w === 1280, "E185: no computador o topo das telas da Conta não tem sino — o caminho só existe no celular");
      test.fail(true, "L-91: o Link para a mesma página com #avisos usa pushState e não dispara hashchange; o IrParaAvisos não roda e o foco fica onde estava");
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      await expect(p.locator("#h-avisos")).toHaveText("Avisos recentes", { timeout: 30_000 });
      await verTodasPeloSino(p, w);
      await expect(p).toHaveURL(/\/dashboard\/notificacoes#avisos$/);
      try {
        await expect.poll(() => focoNoTitulo(p), { timeout: 10_000 }).toBe(true);
      } finally {
        await p.context().close();
      }
    });
  }
});
