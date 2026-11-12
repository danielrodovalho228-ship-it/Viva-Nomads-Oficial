import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1613 — E799 (D4): na mesma conta de proprietário (Paulo), a prévia do perfil ora mostrava "Paulo P. / Responde …% das
  conversas / É assim que o morador te vê no seu anúncio", ora "Paulo Teste Proprietário2 / E-mail confirmado / É assim que
  o proprietário te vê quando você pede para morar". Causa: a prévia decidia o papel por uma leitura feita no navegador
  depois de montar; enquanto ela não chegava — e quando falhava — caía no cartão de MORADOR.
  Regra: fonte única e estável — para quem anuncia (no modo proprietário), a prévia NUNCA mostra o cartão de morador:
  nem enquanto carrega, nem quando a leitura falha, nem entre recargas.
*/
const TITULO_MORADOR = "É assim que o proprietário te vê quando você pede para morar";
const TITULO_DONO = "É assim que o morador te vê no seu anúncio";
const senha = novaSenha();
const nomeCompleto = "Paulo Teste Proprietário2";
let id: string | undefined;
let email = "";

/** Registra TODO título e nome que a prévia mostrar, quadro a quadro (MutationObserver desde o 1º byte). */
function sonda() {
  const w = window as unknown as { __vistos: { titulos: string[]; nomes: string[] } };
  w.__vistos = { titulos: [], nomes: [] };
  const anotar = () => {
    for (const el of document.querySelectorAll('[data-testid="espelho-titulo"]')) {
      const t = (el.textContent ?? "").trim();
      if (t && !w.__vistos.titulos.includes(t)) w.__vistos.titulos.push(t);
    }
    for (const el of document.querySelectorAll('[data-testid="espelho-nome"], [data-testid="espelho-dono-nome"]')) {
      const t = (el.textContent ?? "").trim();
      if (t && !w.__vistos.nomes.includes(t)) w.__vistos.nomes.push(t);
    }
  };
  new MutationObserver(anotar).observe(document, { subtree: true, childList: true, characterData: true });
  document.addEventListener("DOMContentLoaded", anotar);
}
const vistos = (p: Page) => p.evaluate(() => (window as unknown as { __vistos: { titulos: string[]; nomes: string[] } }).__vistos);

/** As ações do servidor da tela (POST com o cabeçalho Next-Action): atrasa ou derruba. */
async function interceptarAcoes(p: Page, modo: "atrasar" | "falhar") {
  // "atrasar": só as ações da 1ª janela da carga (é nela que a prévia decidia o cartão) esperam 4 s. Atrasar TODAS, o
  // tempo todo, empilhava a fila de ações do Next (uma por vez) e passava de 30 s no CI (lab-critico do #3753).
  let inicio = 0;
  await p.route("**/dashboard/conta/perfil**", async (route) => {
    const r = route.request();
    if (r.method() !== "POST" || !r.headers()["next-action"]) return route.continue();
    if (modo === "falhar") return route.abort("failed");
    if (!inicio) inicio = Date.now();
    if (Date.now() - inicio < 3_000) await new Promise((ok) => setTimeout(ok, 4_000));
    return route.continue();
  });
}

test.describe("T1613 — E799 a prévia do perfil do proprietário é estável", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    email = `e799.t1613.${novoSufixo()}@lab.vivanomads.test`;
    id = await criarConta({ email, nome: nomeCompleto, role: "owner" }, senha);
    await criarImovelPronto(id, "Studio do Paulo (t1613)");
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const caso of ["atrasar", "falhar"] as const) {
    test(`leitura da prévia ${caso === "atrasar" ? "atrasada" : "falhando"}: nunca aparece o cartão de morador`, async ({ browser }) => {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.addInitScript(sonda);
      await interceptarAcoes(page, caso);
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("perfil-tela").first()).toBeAttached({ timeout: 30_000 });
      // Cobre a janela inteira da leitura (atrasada 4 s) e depois dela.
      await page.waitForTimeout(6_000);
      const v = await vistos(page);
      expect(v.titulos, `títulos vistos: ${JSON.stringify(v.titulos)}`).not.toContain(TITULO_MORADOR);
      expect(v.nomes, `nomes vistos: ${JSON.stringify(v.nomes)}`).not.toContain(nomeCompleto);
      if (caso === "atrasar") {
        // As ações do servidor vão em fila (cada uma atrasada 4 s): a da prévia pode chegar depois das outras.
        await expect(page.locator('[data-testid="espelho-titulo"]:visible').first()).toHaveText(TITULO_DONO, { timeout: 30_000 });
        const depois = await vistos(page);
        expect(depois.titulos, `títulos vistos: ${JSON.stringify(depois.titulos)}`).toEqual([TITULO_DONO]);
      } else {
        // A falha é dita (com "tentar de novo"), nunca vira outro cartão.
        await expect(page.locator('[data-testid="espelho-falha"]:visible').first()).toBeVisible();
      }
      await page.context().close();
    });
  }

  test("três carregamentos seguidos: o mesmo título e o mesmo nome", async ({ browser }) => {
    const page = await entrar(browser, email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(sonda);
    const leituras: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="espelho-titulo"]:visible').first()).toHaveText(TITULO_DONO, { timeout: 30_000 });
      await page.waitForTimeout(1_500);
      const v = await vistos(page);
      expect(v.titulos).toEqual([TITULO_DONO]);
      leituras.push(JSON.stringify(v));
    }
    expect(new Set(leituras).size, leituras.join("\n")).toBe(1);
    await page.context().close();
  });
});
