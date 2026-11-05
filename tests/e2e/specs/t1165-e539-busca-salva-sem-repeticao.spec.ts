import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1165 — E539 (ii) (#2640, 05/11): busca salva sem repetição — a identidade são os FILTROS, não a ordenação. Em produção
 * a inquilino2 tinha duas "Todas as cidades" (ordem=recent e sem ordem). Agora a lista mostra uma só (a mais recente). O
 * E539 (ii) entrou só com teste de unidade; aqui é a tela de Buscas salvas, 390 e 1280, com três buscas gravadas:
 *   1. "local=A&ordem=recent" e "local=A" (a mesma busca, só a ordem muda) aparecem como UM item;
 *   2. "local=B" (outro filtro) aparece à parte — a regra não junta buscas diferentes;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `inq.t1165.${sufixo}@lab.vivanomads.test`, nome: "Bia Buscas", role: "tenant" as const };
const A = `Buscópolis ${sufixo}`;
const B = `Outrópolis ${sufixo}`;
const ids: { morador?: string } = {};

test.describe("T1165 — E539 (ii): a mesma busca com outra ordenação não aparece duas vezes", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    const p = (local: string, ordem?: string) => new URLSearchParams({ local, ...(ordem ? { ordem } : {}) }).toString();
    const agora = Date.now();
    const { error } = await adm().from("buscas_salvas").insert([
      { usuario_id: ids.morador, parametros: p(A, "recent"), resumo: `Imóveis em ${A}`, criado_em: new Date(agora - 120_000).toISOString() },
      { usuario_id: ids.morador, parametros: p(A), resumo: `Imóveis em ${A}`, criado_em: new Date(agora - 60_000).toISOString() },
      { usuario_id: ids.morador, parametros: p(B), resumo: `Imóveis em ${B}`, criado_em: new Date(agora).toISOString() },
    ]);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.morador) await adm().from("buscas_salvas").delete().eq("usuario_id", ids.morador);
    await apagarContas([ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`a busca de ${"A"} aparece uma vez; a de B, à parte (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), morador.email, senha);
        await p.goto("/dashboard/buscas", { waitUntil: "domcontentloaded" });
        const itens = p.getByTestId("busca-salva-item");
        await expect(itens.first()).toBeVisible({ timeout: 30_000 });
        await expect(itens.filter({ hasText: A })).toHaveCount(1);
        await expect(itens.filter({ hasText: B })).toHaveCount(1);
        await expect(itens).toHaveCount(2);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
