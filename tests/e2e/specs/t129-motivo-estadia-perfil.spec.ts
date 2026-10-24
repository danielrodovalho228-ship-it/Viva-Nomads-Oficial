import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { account, hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): re-teste dos instáveis do #1230 (run 40072532185) e do #1232 (run 40075189536).
 * L-43 (vigia, 24/10): a Conta não assenta em "networkidle"; espera até 10 s e segue para o elemento.
 * T129 — MOTIVO DA ESTADIA NO PERFIL (ordens a8bb8cfa e 9a723929). E64 (QA 24/10): Meus dados não tem mais o
 * seletor (390 e 1280 px); o motivo gravado no perfil ainda pré-preenche o pedido novo, e valor fora da lista é
 * recusado pelo servidor (check do banco). Devolve o motivo original no fim.
 * Vigia 24/10: no laboratório os dois tamanhos usam uma moradora própria. Com a conta "inquilino" compartilhada, a t17
 * salvava o mesmo formulário de Dados em paralelo e gravava por cima o motivo recém-salvo (lab-crítico do #1243).
 */
test.describe("T129 — Motivo da estadia no perfil", () => {
  test.use({ storageState: authFile("inquilino") });
  // Os dois tamanhos de tela salvam e restauram o motivo da MESMA conta: em paralelo um desfazia o do outro.
  test.describe.configure({ mode: "serial" });

  const propria = { email: `lab-t129-${novoSufixo()}@lab.vivanomads.test`, senha: novaSenha(), id: "" };
  test.beforeAll(async () => {
    if (NO_LABORATORIO) propria.id = await criarConta({ email: propria.email, nome: "Moradora T129", role: "tenant" }, propria.senha);
  });
  test.afterAll(async () => {
    if (propria.id) await apagarContas([propria.id]);
  });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`E64: Meus dados sem o seletor; o motivo do perfil ainda pré-preenche o pedido novo (${nome})`, async ({ page: padrao, browser }) => {
      test.skip(!propria.id, "Só no laboratório (a conta própria recebe o motivo pela chave de serviço).");
      const page = await entrar(browser, propria.email, propria.senha);
      await page.setViewportSize({ width: largura, height: altura });
      // E64 (QA 24/10): o motivo saiu de Meus dados (o desenho perfil-04 não tem); ele é perguntado no próprio pedido.
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("meus-dados")).toBeVisible();
      await expect(page.getByTestId("perfil-motivo-estadia")).toHaveCount(0);
      const novo = largura === 390 ? "viagem_longa" : "mudanca_familiar";
      expect((await adm().from("profiles").update({ motivo_estadia: novo }).eq("id", propria.id)).error).toBeNull();
      await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // Prompt 12: o motivo é um select nativo, pré-preenchido com o do perfil.
      await expect(page.getByTestId("pedido-motivo")).toHaveValue(novo);
      if (page !== padrao) await page.context().close();
    });
  }

  test("valor fora da lista é recusado pelo servidor", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!url || !anon || !hasAccount("inquilino"), "Sem URL/chave do Supabase ou conta de teste.");
    const sb = createClient(url!, anon!, { auth: { persistSession: false } });
    const a = account("inquilino");
    const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
    expect(error).toBeNull();
    const r = await sb.from("profiles").update({ motivo_estadia: "ligue 34 99999-0000" }).eq("id", data.user!.id);
    expect(r.error).not.toBeNull();
  });
});
