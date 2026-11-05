import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1194 — E514 (#2730, 05/11): as cópias abertas de um rascunho ("1 cópia deste rascunho · ver") aparecem LOGO DEPOIS do
 * cartão-pai em Meus imóveis — antes, a ordem da lista (a cópia é mais antiga) a jogava para o fim. O E514 entrou só com
 * teste de unidade; aqui é a tela, a 390 e 1280: um rascunho repetido (o mais novo é o pai, a cópia tem 1 dia), e dois
 * anúncios com idade ENTRE os dois. Ao abrir a cópia, ela vem na posição seguinte à do pai, não no fim.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1194.${sufixo}@lab.vivanomads.test`, nome: "Tina Cópias", role: "owner" as const };
const ids: Record<string, string> = {};
const REPETIDO = `Studio repetido t1194 ${sufixo}`;
const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

test.describe("T1194 — E514: a cópia aberta vem logo depois do cartão-pai", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.copia = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    ids.meio1 = await criarImovelPronto(ids.dono, `Publicado meio 1 t1194 ${sufixo}`, { ativo: true, preco: 2800 });
    ids.meio2 = await criarImovelPronto(ids.dono, `Publicado meio 2 t1194 ${sufixo}`, { ativo: true, preco: 2900 });
    ids.pai = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    // Idades: pai (agora) > meio1 (2 h) > meio2 (4 h) > cópia (1 dia).
    for (const [k, h] of [["meio1", 2], ["meio2", 4], ["copia", 24]] as const) {
      await adm().from("properties").update({ created_at: horasAtras(h), updated_at: horasAtras(h) }).eq("id", ids[k]);
    }
    await adm().from("property_photos").delete().in("property_id", [ids.copia, ids.pai]);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: "ver" põe a cópia logo depois do pai`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(cartao(ids.pai)).toBeVisible({ timeout: 30_000 });
      await expect(cartao(ids.copia)).toHaveCount(0);
      await cartao(ids.pai).getByTestId("rascunho-copias").click();
      await expect(cartao(ids.copia)).toBeVisible();
      const ordem = await p.locator('[data-testid="meu-anuncio"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-imovel")));
      const nome = (id: string | null) => Object.entries(ids).find(([, v]) => v === id)?.[0] ?? id;
      expect(ordem.indexOf(ids.copia), `ordem: ${ordem.map(nome).join(" → ")}`).toBe(ordem.indexOf(ids.pai) + 1);
      expect(ordem.indexOf(ids.meio1)).toBeGreaterThan(ordem.indexOf(ids.copia));
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await p.context().close();
    });
  }
});
