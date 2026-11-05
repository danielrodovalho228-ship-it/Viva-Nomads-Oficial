import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1214 — E403 (#2810, 05/11): o medidor "Complete seu perfil" só muda por ação da pessoa. Antes, 88% de manhã e 86% à
 * tarde sem ação nenhuma: "Profissão" saía da conta quando a conta ganhava um imóvel (um rascunho) e "Celular verificado"
 * sumia quando a sonda do provedor de SMS falhava. Agora a profissão vale pelo cadastro (morador) e o celular verificado
 * conta sempre. O E403 entrou só com teste de unidade; aqui é a tela, a 390 e 1280, com uma moradora do laboratório:
 *   1. lê o medidor (porcentagem e quantos itens faltam);
 *   2. recarrega sem fazer nada → o mesmo;
 *   3. a conta ganha um rascunho de imóvel (sem mexer no perfil) → o medidor continua o mesmo.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};

async function lerMedidor(p: Page): Promise<string> {
  const painel = p.getByTestId("complete-perfil");
  await expect(painel).toBeVisible({ timeout: 30_000 });
  if ((await painel.getAttribute("data-completo")) === "sim") return "100% (completo)";
  const pct = (await p.getByTestId("perfil-progresso").innerText()).trim();
  const faltam = await p.getByTestId("perfil-falta").getAttribute("data-faltam");
  return `${pct} · faltam ${faltam}`;
}

test.describe("T1214 — E403: o medidor do perfil só muda por ação da pessoa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas(Object.values(ids));
  });

  for (const w of [390, 1280] as const) {
    test(`recarga e rascunho novo não mexem no medidor (${w})`, async ({ browser }) => {
      const morador = { email: `mor.t1214.${w}.${sufixo}@lab.vivanomads.test`, nome: "Marta Medidor", role: "tenant" as const };
      ids[`m${w}`] = await criarConta(morador, senha);
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      const antes = await lerMedidor(p);

      await p.reload({ waitUntil: "domcontentloaded" });
      expect(await lerMedidor(p), "recarregar sem ação não muda o medidor").toBe(antes);

      // A conta ganha um rascunho de imóvel (o caso do E403: "Profissão" saía da conta e a porcentagem mudava).
      await criarImovelPronto(ids[`m${w}`], `Rascunho da moradora t1214 ${w} ${sufixo}`);
      await p.reload({ waitUntil: "domcontentloaded" });
      expect(await lerMedidor(p), "um rascunho na conta não muda o medidor").toBe(antes);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
