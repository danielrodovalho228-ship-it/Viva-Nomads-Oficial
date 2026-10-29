import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Regressão das Ondas 1–3 (Pista C, 28/10): a suíte completa estoura o tempo antes de chegar aqui; roda no portão do PR.
/*
  T490 — E181 (QA ao vivo 25/10): os contadores da home do morador refletem as listas. Com 1 busca salva (alerta
  ligado) e 1 favorito, a home mostra "Buscas salvas 1" e "Favoritos 1" — os mesmos números de /dashboard/buscas e
  /dashboard/favoritos (antes: 0 fixo).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t490.${sufixo}@lab.vivanomads.test`, nome: "Duda Contagem", role: "owner" as const };
const morador = { email: `morador.t490.${sufixo}@lab.vivanomads.test`, nome: "Maia Contagem", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T490 — E181: contadores da home do morador = as listas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio contagem t490 ${sufixo}`, { ativo: true });
    const f = await adm().from("favorites").insert({ tenant_id: ids.morador, property_id: ids.imovel });
    if (f.error) throw f.error;
    const b = await adm().from("buscas_salvas").insert({ usuario_id: ids.morador, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia" });
    if (b.error) throw b.error;
  });
  test.afterAll(async () => {
    await adm().from("buscas_salvas").delete().eq("usuario_id", ids.morador ?? "");
    await adm().from("favorites").delete().eq("tenant_id", ids.morador ?? "");
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Favoritos 1 e Buscas salvas 1, iguais às listas`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const fav = p.locator('main a[href="/dashboard/favoritos"]').filter({ hasText: "Favoritos" }).first();
      const buscas = p.locator('main a[href="/dashboard/buscas"]').filter({ hasText: "Buscas salvas" }).first();
      await expect(fav).toContainText("1", { timeout: 30_000 });
      await expect(buscas).toContainText("1", { timeout: 30_000 });
      await p.screenshot({ path: `${SAIDA}/t490-home-contadores-${largura}.png` });
      // As listas de destino têm o mesmo número.
      await p.goto("/dashboard/buscas", { waitUntil: "domcontentloaded" });
      await expect(p.getByText("Uberlândia").first()).toBeVisible({ timeout: 30_000 });
      await p.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(`Studio contagem t490 ${sufixo}`).first()).toBeVisible({ timeout: 30_000 });
      await p.context().close();
    });
  }
});
