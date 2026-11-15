import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1647 — E143 (Família 7, ORDEM-DUET-027): o nível fica todo no Passo 5. A 390 e 1280 px, só no laboratório.
   1. A página antiga "Nível, ruído e extras" aberta para um RASCUNHO redireciona ao Passo 5 (#nivel-cadastro).
   2. No Passo 5, o bloco do nível tem o link do guia da comprovação (PDF), e a rota devolve um PDF.
   3. O anúncio publicado segue com a página (o Passo 5 é do cadastro) — a captura e a avaliação moram lá.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1647.${sufixo}@lab.vivanomads.test`, nome: "Nívea Nível", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1647 — E143: o nível no Passo 5", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho nível t1647 ${sufixo}`);
    ids.ativo = await criarImovelPronto(ids.dono, `Ativo nível t1647 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — rascunho: a página antiga leva ao Passo 5, com o guia em PDF`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/${ids.rascunho}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(new RegExp(`/dashboard/imoveis/novo\\?draft=${ids.rascunho}&etapa=comodidades`), { timeout: 30_000 });
      const guia = p.getByTestId("nivel-cadastro-guia-pdf");
      await expect(guia).toBeVisible({ timeout: 30_000 });
      await expect(guia).toHaveAttribute("href", "/api/guia-nivel");
      const r = await p.request.get("/api/guia-nivel");
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("application/pdf");
      expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
      await p.context().close();
    });
  }

  test("publicado: a página do nível continua (o Passo 5 é do cadastro)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto(`/dashboard/imoveis/${ids.ativo}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("nivel-resumo")).toBeVisible({ timeout: 30_000 });
    await expect(p).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.ativo}/nivel`));
    await p.context().close();
  });
});
