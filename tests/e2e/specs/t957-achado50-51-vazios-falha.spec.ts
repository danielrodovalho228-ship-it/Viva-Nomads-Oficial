import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T957 — #2070 (varredura de erros, rodada 5, achados 50 e 51): falha de leitura não vira "vazio" onde o usuário age.
 *   • Achado 51 — a ficha de pets aparecia vazia na falha e o morador recadastrava. Agora: "Não foi possível carregar
 *     seus pets agora." com "Tentar de novo" (Conta › Perfil);
 *   • Achado 50 — os calendários importados sumiam na falha (e o limite de 3 links deixava de contar). Agora:
 *     "Não foi possível carregar os calendários importados agora." com "Tentar de novo" (editar o anúncio).
 * Pela tela real, 390 e 1280: a ação do servidor que lê os pets / os links responde 500 (o efeito do "throw" novo) → o aviso, nunca a
 * lista vazia; "Tentar de novo" com o servidor de volta → o pet / o link gravado volta. A falha do banco em si fica com
 * o teste de unidade do #2070 (achado49-51-vazios.test.ts); o achado 49 (interessados para proposta) é lido no servidor.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t957.${sufixo}@lab.vivanomads.test`, nome: "Mila Pets", role: "tenant" as const };
const dono = { email: `dono.t957.${sufixo}@lab.vivanomads.test`, nome: "Davi Calendário", role: "owner" as const };
const ids: { mor?: string; dono?: string; imovel?: string } = {};
const PET = `Thor ${sufixo}`;
// Domínio único: a resposta de listarImportacoes traz o domínio (não o link) — é a marca da falha simulada.
const DOMINIO = `cal-t957-${sufixo}.example.com`;
const LINK = `https://${DOMINIO}/calendario.ics`;

/** Diagnóstico: as ações vistas pela rota de falha (status, tamanho, se trazem a marca). */
const vistas: string[] = [];
/** Só a ação que devolve `marca` (os pets do morador) responde 500 — as outras ações da tela (o próprio perfil) passam. */
async function soAcaoComFalha(page: Page, padrao: string, marca: string, liga: boolean) {
  // Desliga esperando o handler em andamento terminar (senão o pedido do "Tentar de novo" cai na rota velha).
  if (!liga) return page.unrouteAll({ behavior: "wait" });
  await page.route(padrao, async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      vistas.push(`${resp.status()} ${corpo.length}b ${corpo.includes(marca) ? "COM a marca" : "sem a marca"}`);
      if (corpo.includes(marca)) return await r.fulfill({ status: 500, body: "falha simulada (t957)" });
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T957 — #2070 achados 50/51: pets e calendários importados avisam a falha", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.mor = await criarConta(mor, senha);
    ids.dono = await criarConta(dono, senha);
    const { error } = await adm().from("pets_inquilino").insert({ user_id: ids.mor, nome: PET, especie: "cao", porte: "M", idade_anos: 2, castrado: true, vacinas_em_dia: true });
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, `Studio iCal t957 ${sufixo}`, { ativo: true });
    const { error: e2 } = await adm().from("calendario_importacoes").insert({ property_id: ids.imovel, owner_id: ids.dono, url: LINK, dominio: DOMINIO, origem: "outro" });
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("pets_inquilino").delete().eq("user_id", ids.mor ?? "");
    await adm().from("calendario_importacoes").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.mor, ids.dono]);
  });

  test("achado 51 — ficha de pets: falha avisa, 'Tentar de novo' traz o pet (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, mor.email, senha);
    const rota = "**/dashboard/conta/perfil**";
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await soAcaoComFalha(page, rota, PET, true);
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      const falha = page.getByTestId("pets-falha");
      await expect(falha).toBeVisible({ timeout: 30_000 });
      await expect(falha).toContainText("Não foi possível carregar seus pets agora.");
      await expect(falha).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("pets-lista")).toHaveCount(0);
      await soAcaoComFalha(page, rota, PET, false);
      await page.getByTestId("pets-tentar").click();
      await expect(page.getByTestId("pets-lista")).toContainText(PET, { timeout: 30_000 });
      await expect(page.getByTestId("pets-falha")).toHaveCount(0);
    }
    const { count } = await adm().from("pets_inquilino").select("id", { count: "exact", head: true }).eq("user_id", ids.mor!);
    expect(count, "nenhum pet recadastrado").toBe(1);
    await page.context().close();
  });

  test("achado 50 — calendários importados: falha avisa, 'Tentar de novo' traz o link (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const rota = `**/dashboard/imoveis/${ids.imovel}/editar**`;
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await soAcaoComFalha(page, rota, DOMINIO, true);
      await page.goto(`/dashboard/imoveis/${ids.imovel}/editar#calendario`, { waitUntil: "domcontentloaded" });
      const painel = page.getByTestId("importar-calendario");
      await painel.scrollIntoViewIfNeeded({ timeout: 30_000 });
      const falha = painel.getByTestId("importacoes-falha");
      try {
        await expect(falha).toBeVisible({ timeout: 30_000 });
      } catch (e) {
        throw new Error(`t957 diag @${largura}: ações vistas = ${JSON.stringify(vistas)}; itens = ${await painel.getByTestId("importacao-item").count()}\n${(e as Error).message}`);
      }
      await expect(falha).toContainText("Não foi possível carregar os calendários importados agora.");
      await expect(painel.getByTestId("importacao-item")).toHaveCount(0);
      await soAcaoComFalha(page, rota, DOMINIO, false);
      await painel.getByTestId("importacoes-tentar").click();
      await expect(painel.getByTestId("importacao-item")).toHaveCount(1, { timeout: 30_000 });
      await expect(painel.getByTestId("importacoes-falha")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.context().close();
  });
});
