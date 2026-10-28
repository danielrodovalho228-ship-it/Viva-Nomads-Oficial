import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T583 — E181 (#1423), guarda permanente da Pista C, no que a t490 da Pista A não cobre: com 1 item por lista, um
  contador fixo em "1" (ou "10", pelo toContainText) passaria. Aqui, com 3 favoritos e 2 buscas salvas:
   - a home do morador mostra EXATAMENTE "3" em Favoritos e "2" em Buscas salvas;
   - /dashboard/favoritos tem 3 cartões e /dashboard/buscas tem 2 buscas — os mesmos números.
  A 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t583.${sufixo}@lab.vivanomads.test`, nome: "Duda Conta", role: "owner" as const };
const morador = { email: `mor.t583.${sufixo}@lab.vivanomads.test`, nome: "Maia Conta", role: "tenant" as const };
const ids: Record<string, string> = {};

/** O número do StatCard (o <p> grande dentro do atalho). */
const numero = (p: Page, href: string, rotulo: string) => p.locator(`main a[href="${href}"]`).filter({ hasText: rotulo }).first().locator("p").first();

test.describe("T583 — E181: contadores da home do morador = o tamanho exato das listas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    for (const n of [1, 2, 3]) {
      const imovel = await criarImovelPronto(ids.dono, `Studio conta ${n} t583 ${sufixo}`, { ativo: true });
      const { error } = await adm().from("favorites").insert({ tenant_id: ids.morador, property_id: imovel });
      if (error) throw error;
    }
    const { error } = await adm()
      .from("buscas_salvas")
      .insert([
        { usuario_id: ids.morador, parametros: "local=Uberl%C3%A2ndia", resumo: `Uberlândia t583 ${sufixo}` },
        { usuario_id: ids.morador, parametros: "local=Patos%20de%20Minas", resumo: `Patos de Minas t583 ${sufixo}` },
      ]);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("buscas_salvas").delete().eq("usuario_id", ids.morador ?? "");
    await adm().from("favorites").delete().eq("tenant_id", ids.morador ?? "");
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: Favoritos 3 e Buscas salvas 2 na home, e as listas com 3 e 2`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(numero(p, "/dashboard/favoritos", "Favoritos")).toHaveText("3", { timeout: 30_000 });
      await expect(numero(p, "/dashboard/buscas", "Buscas salvas")).toHaveText("2");
      await p.screenshot({ path: `tests/laboratorio/saida/t583-home-${w}.png` });

      await p.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("favoritos-grade").getByTestId("cartao-imovel")).toHaveCount(3, { timeout: 30_000 });
      await p.goto("/dashboard/buscas", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("buscas-salvas").getByTestId("alerta-busca-botao")).toHaveCount(2, { timeout: 30_000 });
      await p.context().close();
    });
  }
});
