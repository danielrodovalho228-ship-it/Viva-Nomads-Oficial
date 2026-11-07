import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1399 — E674 (#3166): outra conta no mesmo navegador não herda o modo ativo nem o papel "parceiro" da anterior. A conta A
  entra e o navegador guarda (localStorage "vivanomads-auth") modo "parceiro" ativo; a sessão de A acaba (cookies limpos,
  o guardado fica) e a conta B entra pela tela de entrada no MESMO navegador: o guardado passa a ser de B, sem o modo da A
  e com o relógio de 24h reiniciado. 1280 px e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contaA = { email: `a.t1399.${sufixo}@lab.vivanomads.test`, nome: "Lucas Anterior", role: "tenant" as const };
const contaB = { email: `b.t1399.${sufixo}@lab.vivanomads.test`, nome: "Paulo Seguinte", role: "owner" as const };
const ids: { a?: string; b?: string } = {};

type Guardado = { state?: { user?: { id?: string } | null; activeMode?: string | null; parceiroAtivo?: boolean; sessionStartedAt?: number | null } };
const ler = async (p: import("@playwright/test").Page): Promise<Guardado> => JSON.parse((await p.evaluate(() => localStorage.getItem("vivanomads-auth"))) ?? "{}");

test.describe("T1399 — E674: troca de conta no mesmo navegador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.a = await criarConta(contaA, senha);
    ids.b = await criarConta(contaB, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.a, ids.b]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: a conta seguinte não herda o modo da anterior`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await ctx.newPage();
      await entrarNaPagina(p, contaA.email, senha);
      await expect.poll(async () => (await ler(p)).state?.user?.id, { timeout: 30_000 }).toBe(ids.a);
      // A conta A fica com o modo "parceiro" ativo no navegador.
      await p.evaluate(() => {
        const g = JSON.parse(localStorage.getItem("vivanomads-auth") ?? "{}");
        g.state = { ...g.state, activeMode: "parceiro", parceiroAtivo: true, sessionStartedAt: 1_000 };
        localStorage.setItem("vivanomads-auth", JSON.stringify(g));
      });
      // A sessão acaba (cookies), o que é da conta A continua guardado no navegador.
      await ctx.clearCookies();
      await entrarNaPagina(p, contaB.email, senha);
      await expect.poll(async () => (await ler(p)).state?.user?.id, { timeout: 30_000 }).toBe(ids.b);
      const g = (await ler(p)).state!;
      expect(g.parceiroAtivo, "o papel parceiro da conta anterior não vale para a seguinte").toBeFalsy();
      expect(g.activeMode, "o modo ativo da conta anterior não vale para a seguinte").not.toBe("parceiro");
      expect(g.sessionStartedAt ?? 0, "o relógio de 24h recomeça").toBeGreaterThan(1_000);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
