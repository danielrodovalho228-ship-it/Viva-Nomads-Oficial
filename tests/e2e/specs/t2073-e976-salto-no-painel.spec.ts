import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2073 — E976 parte 2 (Pista 3; autorizado pelo Gerente na ronda 03:49Z) @E976 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave de serviço).
  Regra decidida (WCAG 2.4.1, E976 estendido ao painel logado): no painel, o PRIMEIRO focável é o link "Pular para o
  conteúdo principal" — o primeiro Tab cai nele (nunca no "Fale com a Viva" flutuante nem no menu); focado, ele aparece
  inteiro e por cima de tudo; seguido, o foco vai para o conteúdo do painel (o <main>), que começa abaixo do topo.
  Hoje o painel não tem link de pular (#3889, Dúvida 3). Proprietário e morador, 390 e 1280 px, em /dashboard.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2073.${sufixo}@lab.vivanomads.test`, nome: "Dalia Salto", role: "owner" as const };
const inq = { email: `inq.t2073.${sufixo}@lab.vivanomads.test`, nome: "Ivan Salto", role: "tenant" as const };
const ids: Record<string, string> = {};
const SALTO = "Pular para o conteúdo principal";

async function confereSalto(p: Page, largura: number) {
  await p.setViewportSize({ width: largura, height: largura >= 1024 ? 900 : 844 });
  await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const main = p.locator("main[data-painel-main]");
  await expect(main).toBeVisible({ timeout: 30_000 });
  await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Começa do topo do documento (nada focado).
  await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await p.keyboard.press("Tab");
  const primeiro = await p.evaluate(() => (document.activeElement?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60));
  expect(primeiro, `o primeiro Tab do painel caiu em "${primeiro}"`).toBe(SALTO);

  const salto = p.getByRole("link", { name: SALTO });
  await expect
    .poll(
      () =>
        salto.evaluate((a) => {
          const r = a.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight) return "fora da tela";
          const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return alvo && (alvo === a || a.contains(alvo)) ? "ok" : `coberto por <${alvo?.tagName.toLowerCase()}>`;
        }),
      { message: "o salto focado fica à vista", timeout: 3_000 },
    )
    .toBe("ok");

  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  const foco = await p.evaluate(() => {
    const m = document.querySelector("main[data-painel-main]");
    const a = document.activeElement;
    return { noConteudo: !!m && !!a && a !== document.body && (a === m || m.contains(a)), tag: a?.tagName.toLowerCase() };
  });
  expect(foco.noConteudo, `depois do salto o foco ficou em <${foco.tag}>`).toBe(true);
}

test.describe("T2073 — E976 parte 2: o salto para o conteúdo é o primeiro Tab do painel @E976", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const [quem, conta] of [["proprietário", dono], ["morador", inq]] as const) {
    for (const largura of [390, 1280]) {
      test(`${quem}, ${largura} px — /dashboard: primeiro Tab no salto, à vista, e o salto leva o foco ao conteúdo`, async ({ browser }) => {
        const p = await entrar(browser, conta.email, senha);
        await confereSalto(p, largura);
        await p.context().close();
      });
    }
  }
});
