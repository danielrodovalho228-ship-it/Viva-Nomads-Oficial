import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1075 — E518 (#2399, GRAVE, 04/11): "Pedir para morar" não fica desativado para sempre quando a leitura do perfil
 * falha. No anúncio de teste ([TESTE]), o botão espera o is_teste do perfil (lido NO NAVEGADOR pelo AuthProvider);
 * antes, um erro devolvido pelo Supabase deixava o is_teste indefinido e o botão travado sem explicação. Pela tela real,
 * conta de teste (is_teste) num anúncio [TESTE] de outra conta, 390 (barra fixa) e 1280 (cartão):
 *   1. a leitura do perfil falha UMA vez (simulada: a chamada do navegador a /rest/v1/profiles responde 500) → a nova
 *      tentativa (3 s) lê o perfil: a faixa de equipe aparece e "Pedir para morar" fica ATIVO;
 *   2. a leitura falha SEMPRE → depois das tentativas o is_teste resolve como false: a faixa de visitante aparece e o
 *      botão fica desativado COM o texto que explica — nunca o "carregando" eterno sem faixa;
 *   3. controle, sem falha: equipe direto, botão ativo.
 * A regra (tenta de novo, sempre resolve, regra do botão igual) fica com o e518-pedir-para-morar.test.ts; a faixa e o
 * botão por tipo de conta, com a t398.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1075.${sufixo}@lab.vivanomads.test`, nome: "Telmo Teste Barros", role: "owner" as const };
const qa = { email: `qa.t1075.${sufixo}@lab.vivanomads.test`, nome: "Quésia Quadros Lima", role: "tenant" as const };
const ids: Record<string, string> = {};
const VISITANTE = "Anúncio de teste da equipe Viva — não é um imóvel disponível";
const EQUIPE = "Anúncio de teste: fora da busca e das listagens";

/** A leitura do perfil que o AuthProvider faz no navegador (select com papel_ativo e is_teste). */
const ehLeituraDoPerfil = (url: URL) => {
  const u = decodeURIComponent(url.toString());
  return u.includes("/rest/v1/profiles") && u.includes("is_teste") && u.includes("papel_ativo");
};

/** Falha as `vezes` primeiras leituras do perfil (Infinity: todas). Devolve quantas foram barradas. */
async function falharPerfil(p: Page, vezes: number) {
  const barradas = { n: 0 };
  await p.route(ehLeituraDoPerfil, async (r) => {
    if (r.request().method() !== "GET" || barradas.n >= vezes) return r.fallback();
    barradas.n++;
    return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "falha simulada t1075" }) });
  });
  return barradas;
}

const botao = (p: Page, w: number) => (w === 1280 ? p.getByTestId("cartao-solicitar") : p.getByTestId("barra-solicitar"));

test.describe("T1075 — E518: o perfil que falha não trava 'Pedir para morar' no anúncio de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.qa = await criarConta(qa, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.qa);
    if (error) throw error;
    ids.teste = await criarImovelPronto(ids.dono, `[TESTE] Studio do perfil t1075 ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.qa]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle; falha uma vez → libera na nova tentativa; falha sempre → faixa de visitante, nunca travado mudo (${w})`, async ({ browser }) => {
      const p = await entrar(browser, qa.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const faixa = p.getByTestId("faixa-anuncio-teste");

      // 3. Controle: sem falha, a conta de teste é equipe e pode pedir.
      await p.goto(`/imoveis/${ids.teste}`, { waitUntil: "domcontentloaded" });
      await expect(faixa).toHaveAttribute("data-modo", "equipe", { timeout: 30_000 });
      await expect(botao(p, w)).toBeEnabled();

      // 1. Falha uma vez: a nova tentativa lê o perfil e libera.
      const uma = await falharPerfil(p, 1);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect.poll(() => uma.n, { timeout: 20_000 }).toBe(1);
      await expect(faixa).toHaveAttribute("data-modo", "equipe", { timeout: 20_000 });
      await expect(faixa).toHaveText(EQUIPE);
      await expect(botao(p, w)).toBeEnabled();
      await expect(botao(p, w)).toContainText("Pedir para morar");
      await p.unrouteAll({ behavior: "wait" });

      // 2. Falha sempre: resolve como visitante (faixa que explica), não fica "carregando" para sempre.
      const todas = await falharPerfil(p, Number.POSITIVE_INFINITY);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(faixa).toHaveAttribute("data-modo", "visitante", { timeout: 30_000 });
      await expect(faixa).toHaveText(VISITANTE);
      expect(todas.n, "tentou de novo antes de desistir").toBeGreaterThanOrEqual(2);
      await expect(botao(p, w)).toBeDisabled();
      await expect(botao(p, w)).toContainText(VISITANTE);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.unrouteAll({ behavior: "wait" });
      await p.context().close();
    });
  }
});
